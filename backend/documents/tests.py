import math

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from documents.models import Chunk, Document, DocumentPermission
from ingestion.chunker import RecursiveTextChunker
from ingestion.embedder import EmbeddingAdapter
from ingestion.parsers import detect_file_type
from tenants.models import Group, GroupMember, Membership, Role, Tenant

User = get_user_model()


class DocumentModelTests(TestCase):
    def setUp(self):
        self.tenant = Tenant.objects.create(name="Acme Corp", slug="acme-corp")
        self.user = User.objects.create_user(
            email="alice@acme.com", password="Password123!"
        )
        Membership.objects.create(tenant=self.tenant, user=self.user, role=Role.ADMIN)

    def test_document_and_chunk_lifecycle(self):
        """Test document creation, chunk assignment, and cascading deletion."""
        doc = Document.objects.create(
            tenant=self.tenant,
            owner=self.user,
            title="Handbook.md",
            content_hash="abc123hash",
            visibility=Document.Visibility.TENANT,
            status=Document.Status.READY,
        )

        dummy_vector = [0.0] * 1536
        dummy_vector[0] = 1.0

        chunk1 = Chunk.objects.create(
            tenant=self.tenant,
            document=doc,
            position=0,
            text="First section of handbook.",
            embedding=dummy_vector,
        )
        chunk2 = Chunk.objects.create(
            tenant=self.tenant,
            document=doc,
            position=1,
            text="Second section of handbook.",
            embedding=dummy_vector,
        )

        self.assertEqual(doc.chunk_count, 2)
        self.assertEqual(Chunk.objects.filter(document=doc).count(), 2)

        # Deleting document should cascade and delete chunks
        doc_id = doc.id
        doc.delete()

        self.assertFalse(Document.objects.filter(id=doc_id).exists())
        self.assertEqual(Chunk.objects.filter(id=chunk1.id).count(), 0)
        self.assertEqual(Chunk.objects.filter(id=chunk2.id).count(), 0)


class IngestionEngineTests(TestCase):
    def test_magic_bytes_detection(self):
        """Test file sniffing accurately detects valid and invalid types."""
        # PDF magic bytes
        pdf_bytes = b"%PDF-1.4 sample content"
        mime, is_valid = detect_file_type(pdf_bytes, "report.pdf")
        self.assertEqual(mime, "application/pdf")
        self.assertTrue(is_valid)

        # Plain text
        txt_bytes = b"Hello, this is pure UTF-8 text."
        mime, is_valid = detect_file_type(txt_bytes, "notes.txt")
        self.assertEqual(mime, "text/plain")
        self.assertTrue(is_valid)

        # Binary executable masquerading as PDF
        fake_pdf = b"MZ\x90\x00\x03\x00\x00\x00malicious payload"
        mime, is_valid = detect_file_type(fake_pdf, "invoice.pdf")
        self.assertFalse(is_valid)

    def test_recursive_chunker(self):
        """Test recursive chunker generates clean segments with overlap."""
        text = (
            "Paragraph one introduces the architecture.\n\n"
            "Paragraph two explains the pre-filtering retrieval pipeline in detail.\n\n"
            "Paragraph three concludes with benchmarks and security proofs."
        )

        chunker = RecursiveTextChunker(chunk_size=100, chunk_overlap=20)
        chunks = chunker.split_text(text)

        self.assertGreater(len(chunks), 1)
        self.assertEqual(chunks[0].position, 0)
        self.assertIn("Paragraph one", chunks[0].text)

    def test_embedding_adapter_dimensions_and_normalization(self):
        """Test embedding adapter returns normalized 1536-dimensional unit vectors."""
        adapter = EmbeddingAdapter()
        vector = adapter.get_embedding(
            "Enterprise access control is enforced by design."
        )

        self.assertEqual(len(vector), 1536)
        # Vector must be normalized to unit length (L2 norm approx 1.0)
        norm = math.sqrt(sum(x * x for x in vector))
        self.assertAlmostEqual(norm, 1.0, places=4)


@override_settings(CELERY_TASK_ALWAYS_EAGER=True)
class DocumentAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.tenant = Tenant.objects.create(name="Acme Corp", slug="acme-corp")
        self.admin = User.objects.create_user(
            email="alice@acme.com", password="Password123!"
        )
        self.member = User.objects.create_user(
            email="bob@acme.com", password="Password123!"
        )

        Membership.objects.create(tenant=self.tenant, user=self.admin, role=Role.ADMIN)
        Membership.objects.create(
            tenant=self.tenant, user=self.member, role=Role.MEMBER
        )

        self.group_hr = Group.objects.create(tenant=self.tenant, name="HR")
        GroupMember.objects.create(group=self.group_hr, user=self.admin)

        # Obtain JWT tokens
        self.admin_token = str(RefreshToken.for_user(self.admin).access_token)
        self.member_token = str(RefreshToken.for_user(self.member).access_token)

    def test_upload_and_ingestion_api(self):
        """Test file upload endpoint creates document and generates chunks."""
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.admin_token}")

        file_content = (
            b"# Company Policies\n\nAll employees must follow zero-trust guidelines."
        )
        uploaded_file = SimpleUploadedFile(
            "policy.md", file_content, content_type="text/markdown"
        )

        url = reverse("document_list_create")
        response = self.client.post(
            url,
            {
                "file": uploaded_file,
                "title": "Company Policies",
                "visibility": Document.Visibility.TENANT,
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["document"]["title"], "Company Policies")
        self.assertEqual(
            response.data["document"]["visibility"], Document.Visibility.TENANT
        )

        # Verify document status in DB
        doc = Document.objects.get(id=response.data["document"]["id"])
        self.assertEqual(doc.status, Document.Status.READY)
        self.assertGreater(doc.chunk_count, 0)

    def test_group_permission_isolation_returns_404_for_unauthorized(self):
        """Test that group-restricted documents return 404 to users without group access."""
        # Admin creates HR-restricted document
        hr_doc = Document.objects.create(
            tenant=self.tenant,
            owner=self.admin,
            title="Salaries.md",
            content_hash="hash123",
            visibility=Document.Visibility.GROUP,
            status=Document.Status.READY,
        )
        DocumentPermission.objects.create(document=hr_doc, group=self.group_hr)

        # Bob (Member without HR group) requests the document
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.member_token}")
        url = reverse("document_detail", kwargs={"pk": hr_doc.id})
        response = self.client.get(url)

        # Must return 404 Not Found to prevent ID enumeration
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
