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
from ingestion.parsers import (
    describe_image_with_vlm,
    detect_file_type,
    extract_images_from_pdf,
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

    def test_extract_images_from_pdf(self):
        """Test extraction of embedded raster figures from a PDF."""
        import io

        from PIL import Image

        # Generate a test image in a PDF
        img = Image.new("RGB", (250, 250), color="blue")
        pdf_buf = io.BytesIO()
        img.save(pdf_buf, format="PDF")
        pdf_bytes = pdf_buf.getvalue()

        extracted = extract_images_from_pdf(pdf_bytes, min_size_bytes=100)
        self.assertEqual(len(extracted), 1)
        self.assertEqual(extracted[0]["page"], 1)
        self.assertIn(extracted[0]["width"], (250, 500))
        self.assertIn(extracted[0]["height"], (250, 500))
        self.assertTrue(extracted[0]["filename"].startswith("page_1_fig_"))


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


class MultimodalIngestionTests(TestCase):
    """
    Tests layout-aware PDF extraction, Markdown table recovery,
    vector drawing clustering, and VLM semantic captioning fallbacks.
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

    def test_describe_image_with_vlm_fallback(self):
        """Test that VLM caption generator provides deterministic fallback in offline tests."""
        dummy_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"
        caption = describe_image_with_vlm(dummy_bytes, "fig_1.png", 1)
        self.assertTrue(len(caption) > 10)
        self.assertIn("fig_1.png", caption)

    def test_pymupdf_table_and_drawing_extraction(self):
        """
        Creates an in-memory PDF with PyMuPDF containing a table and vector cluster,
        and verifies that table Markdown and figure images are extracted cleanly.
        """
        import pymupdf

        doc = pymupdf.open()
        page = doc.new_page()

        # 1. Draw a vector box (diagram)
        page.draw_rect(pymupdf.Rect(50, 50, 250, 200), color=(0, 0, 1), fill=(0.9, 0.9, 1))
        page.insert_text((60, 90), "System Architecture Flow", fontsize=12)

        # 2. Draw a table
        page.draw_rect(pymupdf.Rect(50, 220, 300, 320))
        page.draw_line(pymupdf.Point(50, 260), pymupdf.Point(300, 260))
        page.draw_line(pymupdf.Point(170, 220), pymupdf.Point(170, 320))
        page.insert_text((60, 245), "Parameter")
        page.insert_text((180, 245), "Specification")
        page.insert_text((60, 295), "Embedding Dim")
        page.insert_text((180, 295), "2048")

        pdf_bytes = doc.tobytes()
        doc.close()

        # Extract text & tables
        text = extract_text_from_file(pdf_bytes, "application/pdf")
        self.assertIn("[Page 1]", text)
        self.assertIn("System Architecture Flow", text)

        # Extract figures & vector clusters
        images = extract_images_from_pdf(pdf_bytes, min_width=50, min_height=50, min_size_bytes=50)
        self.assertGreaterEqual(len(images), 1)
        first_img = images[0]
        self.assertEqual(first_img["page"], 1)
        self.assertEqual(first_img["format"], "PNG")
        self.assertGreater(first_img["width"], 0)
        self.assertGreater(len(first_img["data"]), 50)


class PostgreSQLRowLevelSecurityTests(TestCase):
    """
    Verifies that PostgreSQL FORCE ROW LEVEL SECURITY strictly isolates
    documents and chunks at the database engine layer.
    """

    def setUp(self):
        from django.db import connection

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
        from django.db import connection
        try:
            with connection.cursor() as cursor:
                cursor.execute("RESET ROLE;")
        except Exception:
            pass
        super().tearDown()

    def test_rls_filters_by_tenant_session_config(self):
        from django.db import connection

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


