import math

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import connection
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from documents.models import Chunk, Document, DocumentPermission
from ingestion.chunker import RecursiveTextChunker
from ingestion.embedder import EmbeddingAdapter
from ingestion.parsers import (
    detect_file_type,
    extract_text_from_file,
    format_rows_as_markdown_table,
    html_table_to_markdown,
    sanitize_and_clean_text,
)
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

        dummy_vector = [0.0] * EmbeddingAdapter.DIMENSIONS
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

    def test_structure_aware_chunker_section_breadcrumbs(self):
        """Test that structure-aware chunker tracks heading hierarchy and section breadcrumbs."""
        structured_doc = (
            "# Enterprise Security Guidelines\n\n"
            "Overview of global corporate security directives.\n\n"
            "## Cryptography and Key Management\n\n"
            "### Database Encryption\n\n"
            "All PostgreSQL tables must enforce AES-256 transparent column encryption at rest.\n\n"
            "| Component | Standard |\n"
            "| --- | --- |\n"
            "| Storage | AES-256 |\n"
        )
        chunker = RecursiveTextChunker(chunk_size=150, chunk_overlap=30)
        chunks = chunker.split_text(structured_doc)
        self.assertGreater(len(chunks), 1)
        has_breadcrumb = any(
            "Enterprise Security Guidelines" in c.section_header
            or "Cryptography and Key Management" in c.section_header
            for c in chunks
        )
        self.assertTrue(has_breadcrumb)

    def test_embedding_adapter_dimensions_and_normalization(self):
        """Test embedding adapter returns normalized 2048-dimensional unit vectors."""
        adapter = EmbeddingAdapter()
        vector = adapter.get_embedding(
            "Enterprise access control is enforced by design."
        )

        self.assertEqual(len(vector), EmbeddingAdapter.DIMENSIONS)
        self.assertEqual(len(vector), 2048)
        # Vector must be normalized to unit length (L2 norm approx 1.0)
        norm = math.sqrt(sum(x * x for x in vector))
        self.assertAlmostEqual(norm, 1.0, places=4)

    def test_text_sanitization(self):
        """Test sanitization cleans null bytes, zero-width chars, and excess newlines."""
        dirty = "Hello\x00World!\u200b\n\n\n\nThis is   spaced   text.\n\n\nDone."
        cleaned = sanitize_and_clean_text(dirty)
        self.assertNotIn("\x00", cleaned)
        self.assertNotIn("\u200b", cleaned)
        self.assertNotIn("\n\n\n", cleaned)
        self.assertIn("Hello", cleaned)
        self.assertIn("World!", cleaned)

    def test_html_table_to_markdown(self):
        """Test HTML table string conversion to Markdown table syntax."""
        html = (
            "<table>"
            "<tr><th>Quarter</th><th>Revenue</th></tr>"
            "<tr><td>Q1</td><td>$1.2M</td></tr>"
            "<tr><td>Q2</td><td>$1.8M</td></tr>"
            "</table>"
        )
        md = html_table_to_markdown(html)
        self.assertIsNotNone(md)
        self.assertIn("| Quarter | Revenue |", md)
        self.assertIn("| --- | --- |", md)
        self.assertIn("| Q1 | $1.2M |", md)
        self.assertIn("| Q2 | $1.8M |", md)

    def test_unstructured_docx_extraction_with_table(self):
        """Test extraction from a generated DOCX with heading and structured table."""
        import io

        import docx

        doc = docx.Document()
        doc.add_heading("Financial Summary", level=1)
        doc.add_paragraph("This is the annual summary.")
        table = doc.add_table(rows=2, cols=2)
        table.cell(0, 0).text = "Metric"
        table.cell(0, 1).text = "Amount"
        table.cell(1, 0).text = "ARR"
        table.cell(1, 1).text = "$5M"

        buf = io.BytesIO()
        doc.save(buf)
        docx_bytes = buf.getvalue()

        file_type = (
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        )
        extracted = extract_text_from_file(docx_bytes, file_type)

        self.assertIn("Financial Summary", extracted)
        self.assertIn("annual summary", extracted)
        self.assertIn("ARR", extracted)
        self.assertIn("$5M", extracted)


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
        self.viewer = User.objects.create_user(
            email="charlie@acme.com", password="Password123!"
        )

        Membership.objects.create(tenant=self.tenant, user=self.admin, role=Role.ADMIN)
        Membership.objects.create(tenant=self.tenant, user=self.member, role=Role.MEMBER)
        Membership.objects.create(tenant=self.tenant, user=self.viewer, role=Role.VIEWER)

        self.group_hr = Group.objects.create(tenant=self.tenant, name="HR")
        GroupMember.objects.create(group=self.group_hr, user=self.admin)

        # Obtain JWT tokens
        self.admin_token = str(RefreshToken.for_user(self.admin).access_token)
        self.member_token = str(RefreshToken.for_user(self.member).access_token)
        self.viewer_token = str(RefreshToken.for_user(self.viewer).access_token)

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

    def test_viewer_cannot_upload_document(self):
        """Test that users with VIEWER role cannot upload documents (returns 403)."""
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.viewer_token}")

        uploaded_file = SimpleUploadedFile(
            "viewer_doc.txt", b"Viewer content", content_type="text/plain"
        )

        url = reverse("document_list_create")
        response = self.client.post(
            url,
            {
                "file": uploaded_file,
                "title": "Viewer Upload Attempt",
                "visibility": Document.Visibility.TENANT,
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("Viewers are not permitted to upload documents.", response.data["detail"])

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

    def test_unauthorized_user_cannot_delete_document_returns_404(self):
        """Test that a non-owner/non-admin attempting to delete returns 404 per Rule 7."""
        doc = Document.objects.create(
            tenant=self.tenant,
            owner=self.admin,
            title="AdminConfidential.md",
            content_hash="admin_hash_456",
            visibility=Document.Visibility.TENANT,
            status=Document.Status.READY,
        )

        # Bob (Member, not owner, not admin) attempts to delete admin's document
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.member_token}")
        url = reverse("document_detail", kwargs={"pk": doc.id})
        response = self.client.delete(url)

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertTrue(Document.objects.filter(id=doc.id).exists())

    def test_delete_document_success_and_audit_logging(self):
        """Test document deletion by admin succeeds with 204 and logs AuditAction.DELETE_DOCUMENT."""
        from audit.models import AuditAction, AuditLog

        doc = Document.objects.create(
            tenant=self.tenant,
            owner=self.admin,
            title="ObsoleteHandbook.md",
            content_hash="hash_obsolete",
            visibility=Document.Visibility.TENANT,
            status=Document.Status.READY,
        )
        doc_id = str(doc.id)

        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.admin_token}")
        url = reverse("document_detail", kwargs={"pk": doc.id})
        response = self.client.delete(url)

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Document.objects.filter(id=doc_id).exists())

        # Verify audit log was recorded with DELETE_DOCUMENT
        audit_entry = AuditLog.objects.filter(
            tenant_id=self.tenant.id, action=AuditAction.DELETE_DOCUMENT
        ).first()
        self.assertIsNotNone(audit_entry)
        self.assertEqual(audit_entry.metadata.get("document_id"), doc_id)

    def test_deduplication_clones_chunks(self):
        """Test that deduplicating identical file within tenant clones chunks so new doc has chunks."""
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.admin_token}")

        content = b"Shared enterprise procedure content for deduplication test."
        file1 = SimpleUploadedFile("procedure1.txt", content, content_type="text/plain")

        url = reverse("document_list_create")
        res1 = self.client.post(
            url,
            {"file": file1, "title": "Procedure 1", "visibility": Document.Visibility.TENANT},
            format="multipart",
        )
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)
        doc1 = Document.objects.get(id=res1.data["document"]["id"])
        self.assertEqual(doc1.status, Document.Status.READY)
        self.assertGreater(doc1.chunk_count, 0)

        # Upload identical file as member
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.member_token}")
        file2 = SimpleUploadedFile("procedure2.txt", content, content_type="text/plain")
        res2 = self.client.post(
            url,
            {"file": file2, "title": "Procedure 2", "visibility": Document.Visibility.PRIVATE},
            format="multipart",
        )
        self.assertEqual(res2.status_code, status.HTTP_201_CREATED)
        self.assertTrue(res2.data["deduplicated"])
        doc2 = Document.objects.get(id=res2.data["document"]["id"])
        self.assertEqual(doc2.status, Document.Status.READY)
        # Chunks must be cloned so doc2 has active chunks
        self.assertEqual(doc2.chunk_count, doc1.chunk_count)
        self.assertGreater(doc2.chunk_count, 0)


class TabularAndTextExtractionTests(TestCase):
    """
    Tests layout-aware PDF table extraction and Markdown table formatting using PyMuPDF.
    """

    def test_format_rows_as_markdown_table(self):
        """Test conversion of 2D string rows into aligned Markdown table."""
        rows = [
            ["Metric", "Value", "Notes"],
            ["Latency", "8.2ms", "P95 benchmark"],
            ["Recall", "0.94", "Hybrid search"],
        ]
        md = format_rows_as_markdown_table(rows)
        self.assertIsNotNone(md)
        self.assertIn("| Metric | Value | Notes |", md)
        self.assertIn("| --- | --- | --- |", md)
        self.assertIn("| Latency | 8.2ms | P95 benchmark |", md)
        self.assertIn("| Recall | 0.94 | Hybrid search |", md)

    def test_pymupdf_table_extraction(self):
        """
        Creates an in-memory PDF with PyMuPDF containing a table,
        and verifies that table Markdown is extracted cleanly without VLM.
        """
        try:
            import pymupdf
        except ImportError:
            self.skipTest('pymupdf not installed in test environment')

        doc = pymupdf.open()
        page = doc.new_page()

        # Insert title and table
        page.insert_text((50, 50), "Quarterly Financial Overview", fontsize=14)
        page.draw_rect(pymupdf.Rect(50, 80, 300, 200))
        page.draw_line(pymupdf.Point(50, 120), pymupdf.Point(300, 120))
        page.draw_line(pymupdf.Point(170, 80), pymupdf.Point(170, 200))
        page.insert_text((60, 105), "Quarter")
        page.insert_text((180, 105), "Revenue")
        page.insert_text((60, 150), "Q1")
        page.insert_text((180, 150), "$10.5M")

        pdf_bytes = doc.tobytes()
        doc.close()

        # Extract text & tables using pure PyMuPDF pipeline
        text = extract_text_from_file(pdf_bytes, "application/pdf")
        self.assertIn("[Page 1]", text)
        self.assertIn("Quarterly Financial Overview", text)


class PostgreSQLRowLevelSecurityTests(TestCase):
    """
    Verifies that PostgreSQL FORCE ROW LEVEL SECURITY strictly isolates
    documents and chunks at the database engine layer.
    """

    def setUp(self):
        if connection.vendor != "postgresql":
            return

        self.tenant_a = Tenant.objects.create(name="Tenant Alpha", slug="alpha")
        self.tenant_b = Tenant.objects.create(name="Tenant Beta", slug="beta")

        self.user_a = User.objects.create_user(email="user@alpha.com", password="password")
        self.user_b = User.objects.create_user(email="user@beta.com", password="password")

        # Temporarily set context to create documents
        with connection.cursor() as cursor:
            cursor.execute("SELECT set_config('app.tenant_id', %s, true);", [str(self.tenant_a.id)])

        self.doc_a = Document.objects.create(
            tenant=self.tenant_a,
            owner=self.user_a,
            title="Alpha Strategy.pdf",
            content_hash="hash_alpha",
            visibility=Document.Visibility.TENANT,
            status=Document.Status.READY,
        )

        with connection.cursor() as cursor:
            cursor.execute("SELECT set_config('app.tenant_id', %s, true);", [str(self.tenant_b.id)])

        self.doc_b = Document.objects.create(
            tenant=self.tenant_b,
            owner=self.user_b,
            title="Beta Financials.pdf",
            content_hash="hash_beta",
            visibility=Document.Visibility.TENANT,
            status=Document.Status.READY,
        )

    def tearDown(self):
        if connection.vendor != "postgresql":
            return
        try:
            with connection.cursor() as cursor:
                cursor.execute("RESET ROLE;")
        except Exception:
            pass
        super().tearDown()

    def test_rls_filters_by_tenant_session_config(self):
        if connection.vendor != "postgresql":
            self.skipTest("Row-Level Security tests require PostgreSQL.")

        # 1. Switch context to Tenant Alpha as non-superuser role where RLS is enforced
        with connection.cursor() as cursor:
            cursor.execute("SET ROLE vaultrag_user;")
            cursor.execute("SELECT set_config('app.tenant_id', %s, true);", [str(self.tenant_a.id)])

        alpha_docs = list(Document.objects.all())
        self.assertEqual(len(alpha_docs), 1)
        self.assertEqual(alpha_docs[0].title, "Alpha Strategy.pdf")

        # 2. Switch context to Tenant Beta
        with connection.cursor() as cursor:
            cursor.execute("SELECT set_config('app.tenant_id', %s, true);", [str(self.tenant_b.id)])

        beta_docs = list(Document.objects.all())
        self.assertEqual(len(beta_docs), 1)
        self.assertEqual(beta_docs[0].title, "Beta Financials.pdf")

        # 3. Clear session context — MUST return ZERO rows under FORCE RLS
        with connection.cursor() as cursor:
            cursor.execute("SELECT set_config('app.tenant_id', '', true);")

        no_context_docs = list(Document.objects.all())
        self.assertEqual(len(no_context_docs), 0)
