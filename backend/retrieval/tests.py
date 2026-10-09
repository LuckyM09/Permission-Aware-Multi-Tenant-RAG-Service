from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.context import UserContext
from documents.models import Chunk, Document, DocumentPermission
from ingestion.embedder import EmbeddingAdapter
from retrieval.services import RetrievalService
from tenants.models import Group, GroupMember, Membership, Role, Tenant

User = get_user_model()


class RetrievalEngineTests(TestCase):
    """
    Rigorously tests the SQL-level permission pre-filtering retrieval engine.
    Validates tenant isolation, ACL boundaries, role permissions, and zero data leakage.
    """

    def setUp(self):
        self.embedder = EmbeddingAdapter()
        self.retrieval_service = RetrievalService(embedder=self.embedder)

        # 1. Tenants
        self.tenant_acme = Tenant.objects.create(name="Acme Corp", slug="acme-corp")
        self.tenant_beta = Tenant.objects.create(name="Beta Labs", slug="beta-labs")

        # 2. Users
        self.alice = User.objects.create_user(
            email="alice@acme.com", password="Password123!", first_name="Alice"
        )
        self.bob = User.objects.create_user(
            email="bob@acme.com", password="Password123!", first_name="Bob"
        )
        self.charlie = User.objects.create_user(
            email="charlie@acme.com", password="Password123!", first_name="Charlie"
        )
        self.mallory = User.objects.create_user(
            email="mallory@betalabs.com", password="Password123!", first_name="Mallory"
        )

        # 3. Memberships
        Membership.objects.create(
            tenant=self.tenant_acme, user=self.alice, role=Role.ADMIN
        )
        Membership.objects.create(
            tenant=self.tenant_acme, user=self.bob, role=Role.MEMBER
        )
        Membership.objects.create(
            tenant=self.tenant_acme, user=self.charlie, role=Role.MEMBER
        )
        Membership.objects.create(
            tenant=self.tenant_beta, user=self.mallory, role=Role.MEMBER
        )

        # 4. Groups in Acme
        self.group_hr = Group.objects.create(tenant=self.tenant_acme, name="HR")
        GroupMember.objects.create(
            group=self.group_hr, user=self.charlie
        )  # Charlie is in HR

        # 5. Seed Documents and Chunks in Acme Corp
        # A. Tenant-Wide Document
        self.doc_handbook = Document.objects.create(
            tenant=self.tenant_acme,
            owner=self.alice,
            title="Acme Company Handbook",
            content_hash="hash_handbook",
            visibility=Document.Visibility.TENANT,
            status=Document.Status.READY,
        )
        self._create_chunk(
            self.tenant_acme,
            self.doc_handbook,
            0,
            "Welcome to Acme Corp. All staff are eligible for annual flexible wellness benefits.",
        )

        # B. Group-Restricted Document (HR Group only)
        self.doc_salaries = Document.objects.create(
            tenant=self.tenant_acme,
            owner=self.alice,
            title="Executive Compensation and Salaries 2026",
            content_hash="hash_salaries",
            visibility=Document.Visibility.GROUP,
            status=Document.Status.READY,
        )
        DocumentPermission.objects.create(
            document=self.doc_salaries, group=self.group_hr
        )
        self._create_chunk(
            self.tenant_acme,
            self.doc_salaries,
            0,
            "Confidential executive compensation figures: CEO base salary is $450,000.",
        )

        # C. Private Document (Alice's personal notes)
        self.doc_private = Document.objects.create(
            tenant=self.tenant_acme,
            owner=self.alice,
            title="Alice Private Performance Review",
            content_hash="hash_private",
            visibility=Document.Visibility.PRIVATE,
            status=Document.Status.READY,
        )
        self._create_chunk(
            self.tenant_acme,
            self.doc_private,
            0,
            "Private self-evaluation notes for promotion to Senior Director.",
        )

        # 6. Seed Document in Beta Labs (Mallory's tenant)
        self.doc_beta = Document.objects.create(
            tenant=self.tenant_beta,
            owner=self.mallory,
            title="Beta Labs Secret Projects",
            content_hash="hash_beta",
            visibility=Document.Visibility.TENANT,
            status=Document.Status.READY,
        )
        self._create_chunk(
            self.tenant_beta,
            self.doc_beta,
            0,
            "Beta Labs is developing quantum computing chips in secret stealth mode.",
        )

    def _create_chunk(self, tenant, document, position, text):
        embedding = self.embedder.get_embedding(text)
        return Chunk.objects.create(
            tenant=tenant,
            document=document,
            position=position,
            text=text,
            embedding=embedding,
            metadata={"word_count": len(text.split())},
        )

    def test_cross_tenant_isolation_zero_data_leakage(self):
        """
        Mallory (Beta Labs) must NEVER retrieve any chunks belonging to Acme Corp,
        even when querying for Acme's exact keywords.
        """
        mallory_ctx = UserContext(
            tenant_id=self.tenant_beta.id,
            user_id=self.mallory.id,
            email=self.mallory.email,
            role=Role.MEMBER,
            group_ids=(),
        )

        results = self.retrieval_service.search(
            user_ctx=mallory_ctx,
            query="flexible wellness benefits and compensation salary",
            top_k=10,
        )

        # Zero data leakage: Mallory must NEVER see any chunk from Acme Corp
        acme_doc_ids = {
            str(self.doc_handbook.id),
            str(self.doc_salaries.id),
            str(self.doc_private.id),
        }
        retrieved_doc_ids = {r["document_id"] for r in results}
        self.assertTrue(acme_doc_ids.isdisjoint(retrieved_doc_ids))

        # Searching for her own tenant's content should succeed
        beta_results = self.retrieval_service.search(
            user_ctx=mallory_ctx,
            query="quantum computing chips",
            top_k=10,
        )
        self.assertEqual(len(beta_results), 1)
        self.assertEqual(beta_results[0]["document_title"], "Beta Labs Secret Projects")

    def test_group_acl_filtering(self):
        """
        HR-restricted documents must only be visible to HR members and Admins.
        Bob (non-HR member) must NEVER see HR chunks.
        Charlie (HR member) must retrieve the document.
        """
        bob_ctx = UserContext(
            tenant_id=self.tenant_acme.id,
            user_id=self.bob.id,
            email=self.bob.email,
            role=Role.MEMBER,
            group_ids=(),  # Not in HR
        )

        charlie_ctx = UserContext(
            tenant_id=self.tenant_acme.id,
            user_id=self.charlie.id,
            email=self.charlie.email,
            role=Role.MEMBER,
            group_ids=(self.group_hr.id,),  # In HR
        )

        query = "CEO base salary executive compensation"

        # Bob must NEVER receive the HR-restricted salaries document
        bob_results = self.retrieval_service.search(
            user_ctx=bob_ctx, query=query, top_k=5
        )
        self.assertFalse(
            any(r["document_id"] == str(self.doc_salaries.id) for r in bob_results)
        )

        # Charlie (HR member) can access the HR document
        charlie_results = self.retrieval_service.search(
            user_ctx=charlie_ctx, query=query, top_k=5
        )
        self.assertTrue(
            any(r["document_id"] == str(self.doc_salaries.id) for r in charlie_results)
        )

    def test_tenant_admin_override(self):
        """
        Alice (Tenant Admin) can retrieve all documents within Acme Corp,
        including group-scoped documents.
        """
        alice_ctx = UserContext(
            tenant_id=self.tenant_acme.id,
            user_id=self.alice.id,
            email=self.alice.email,
            role=Role.ADMIN,
            group_ids=(),
        )

        query = "executive compensation salary"
        results = self.retrieval_service.search(
            user_ctx=alice_ctx, query=query, top_k=5
        )

        self.assertGreaterEqual(len(results), 1)
        self.assertTrue(
            any(r["document_id"] == str(self.doc_salaries.id) for r in results)
        )

    def test_private_document_owner_isolation(self):
        """
        Private documents are only accessible by their owner.
        Bob cannot access Alice's private review. Alice can.
        """
        bob_ctx = UserContext(
            tenant_id=self.tenant_acme.id,
            user_id=self.bob.id,
            email=self.bob.email,
            role=Role.MEMBER,
            group_ids=(),
        )
        alice_ctx = UserContext(
            tenant_id=self.tenant_acme.id,
            user_id=self.alice.id,
            email=self.alice.email,
            role=Role.ADMIN,
            group_ids=(),
        )

        query = "self-evaluation notes promotion Senior Director"

        # Bob must NEVER retrieve Alice's private performance review
        bob_results = self.retrieval_service.search(
            user_ctx=bob_ctx, query=query, top_k=5
        )
        self.assertFalse(
            any(r["document_id"] == str(self.doc_private.id) for r in bob_results)
        )

        # Alice (owner) retrieves her private document
        alice_results = self.retrieval_service.search(
            user_ctx=alice_ctx, query=query, top_k=5
        )
        self.assertTrue(
            any(r["document_id"] == str(self.doc_private.id) for r in alice_results)
        )

    def test_tenant_wide_sharing(self):
        """
        Tenant-wide documents can be retrieved by any member of the organization.
        """
        bob_ctx = UserContext(
            tenant_id=self.tenant_acme.id,
            user_id=self.bob.id,
            email=self.bob.email,
            role=Role.MEMBER,
            group_ids=(),
        )

        query = "flexible wellness benefits"
        results = self.retrieval_service.search(user_ctx=bob_ctx, query=query, top_k=5)

        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["document_title"], "Acme Company Handbook")
        self.assertGreater(results[0]["similarity"], 0.0)

    def test_hybrid_search_and_reranking(self):
        """
        Hybrid search combines dense vector and sparse keyword matching with RRF fusion
        and cross-encoder reranking.
        """
        alice_ctx = UserContext(
            tenant_id=self.tenant_acme.id,
            user_id=self.alice.id,
            email=self.alice.email,
            role=Role.ADMIN,
            group_ids=(),
        )

        results = self.retrieval_service.search(
            user_ctx=alice_ctx,
            query="wellness flexible benefits",
            mode="hybrid",
            rerank=True,
            top_k=5,
        )

        self.assertGreaterEqual(len(results), 1)
        top = results[0]
        self.assertTrue(top.get("reranked", False))
        self.assertIn("score", top)
        self.assertEqual(top["document_title"], "Acme Company Handbook")

    def test_sparse_keyword_search_enforces_zero_data_leakage(self):
        """
        Filters on ALL paths: Sparse (keyword) search MUST enforce strict
        tenant isolation and ACL filtering, identical to dense vector search.
        """
        # 1. Cross-Tenant: Mallory in Beta Labs searching keywords from Acme
        mallory_ctx = UserContext(
            tenant_id=self.tenant_beta.id,
            user_id=self.mallory.id,
            email=self.mallory.email,
            role=Role.MEMBER,
            group_ids=(),
        )
        mallory_results = self.retrieval_service.search(
            user_ctx=mallory_ctx,
            query="wellness benefits",
            mode="sparse",
            top_k=5,
        )
        # Mallory must NEVER see Acme's handbook
        self.assertFalse(
            any(r["document_id"] == str(self.doc_handbook.id) for r in mallory_results)
        )

        # 2. ACL Group Isolation: Bob (non-HR) keyword searching for "salary"
        bob_ctx = UserContext(
            tenant_id=self.tenant_acme.id,
            user_id=self.bob.id,
            email=self.bob.email,
            role=Role.MEMBER,
            group_ids=(),
        )
        bob_results = self.retrieval_service.search(
            user_ctx=bob_ctx,
            query="salary compensation",
            mode="sparse",
            top_k=5,
        )
        # Bob must NEVER see the HR salaries document
        self.assertFalse(
            any(r["document_id"] == str(self.doc_salaries.id) for r in bob_results)
        )


class RetrievalAPITests(TestCase):
    """
    Tests the REST API endpoint POST /api/v1/retrieval/search/.
    """

    def setUp(self):
        self.client = APIClient()
        self.tenant = Tenant.objects.create(name="Acme Corp", slug="acme-corp")
        self.user = User.objects.create_user(
            email="alice@acme.com", password="Password123!"
        )
        Membership.objects.create(tenant=self.tenant, user=self.user, role=Role.ADMIN)

        self.token = str(RefreshToken.for_user(self.user).access_token)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token}")

        # Seed document
        self.embedder = EmbeddingAdapter()
        self.doc = Document.objects.create(
            tenant=self.tenant,
            owner=self.user,
            title="API Architecture Guidelines",
            visibility=Document.Visibility.TENANT,
            status=Document.Status.READY,
        )
        text = "All REST API endpoints must implement JWT authentication and structured errors."
        Chunk.objects.create(
            tenant=self.tenant,
            document=self.doc,
            position=0,
            text=text,
            embedding=self.embedder.get_embedding(text),
        )

    def test_unauthenticated_request_rejected(self):
        """Unauthenticated requests must be rejected with 401."""
        unauthenticated_client = APIClient()
        url = reverse("retrieval_search")
        response = unauthenticated_client.post(
            url, {"query": "REST API"}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_search_api_valid_query(self):
        """Authenticated valid search returns 200 with ranked results."""
        url = reverse("retrieval_search")
        response = self.client.post(
            url,
            {"query": "REST API endpoints authentication", "top_k": 3},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["query"], "REST API endpoints authentication")
        self.assertEqual(response.data["total_found"], 1)

        result = response.data["results"][0]
        self.assertEqual(result["document_title"], "API Architecture Guidelines")
        self.assertIn("similarity", result)
        self.assertIn("distance", result)
        self.assertIn("JWT authentication", result["text"])

    def test_search_api_empty_query_validation(self):
        """Empty query must be rejected with 400 Bad Request."""
        url = reverse("retrieval_search")
        response = self.client.post(url, {"query": "   "}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_search_api_hybrid_and_reranking_params(self):
        """API accepts mode, rerank, and alpha parameters."""
        url = reverse("retrieval_search")
        response = self.client.post(
            url,
            {
                "query": "REST API endpoints",
                "top_k": 3,
                "mode": "hybrid",
                "rerank": True,
                "alpha": 0.6,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["mode"], "hybrid")
        self.assertTrue(response.data["reranked"])
        self.assertGreaterEqual(response.data["total_found"], 1)
