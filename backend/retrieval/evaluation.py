import json
import logging
import statistics
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from django.conf import settings

from accounts.context import UserContext
from accounts.middleware import set_tenant_db_context
from accounts.models import User
from chat.assembler import AntiLeakShield, ContextAssembler
from chat.services import ChatService
from documents.models import Chunk, Document, DocumentPermission
from ingestion.embedder import EmbeddingAdapter
from retrieval.metrics_judge import LLMJudge
from retrieval.services import RetrievalService
from tenants.models import Group, GroupMember, Membership, Role, Tenant

logger = logging.getLogger(__name__)


@dataclass
class EvaluationMetrics:
    total_eval_queries: int = 0
    leakage_count: int = 0
    leakage_rate: float = 0.0
    context_precision: float = 0.0
    context_recall: float = 0.0
    faithfulness: float = 0.0
    answer_correctness: float = 0.0
    answer_relevance: float = 0.0
    citation_shield_accuracy: float = 1.0
    p50_latency_ms: float = 0.0
    p95_latency_ms: float = 0.0
    avg_latency_ms: float = 0.0
    unfiltered_p50_ms: float = 0.0
    overhead_ms: float = 0.0
    category_results: list[dict[str, Any]] = field(default_factory=list)


class RAGEvaluator:
    """
    Automated benchmark and security evaluation engine for VaultRAG.
    Measures retrieval precision, recall, faithfulness, answer correctness,
    relevance, latency overhead, and empirical zero-leakage rate.
    """

    def __init__(self, judge: LLMJudge | None = None):
        self.embedder = EmbeddingAdapter()
        self.retrieval_service = RetrievalService(embedder=self.embedder)
        self.assembler = ContextAssembler()
        self.chat_service = ChatService(
            retrieval_service=self.retrieval_service,
            assembler=self.assembler,
        )
        self.judge = judge or LLMJudge()

    def run_benchmark(
        self,
        output_report_path: Path | None = None,
        dataset_path: Path | str | None = None,
        limit_queries: int | None = None,
    ) -> EvaluationMetrics:
        """Runs the synthetic evaluation suite and writes report."""
        print("[RAGEvaluator] Setting up isolated benchmark dataset and personas...")
        env = self._setup_benchmark_data()

        test_cases = []
        if dataset_path and Path(dataset_path).exists():
            print(f"[RAGEvaluator] Loading benchmark dataset from {dataset_path}...")
            with open(dataset_path, "r", encoding="utf-8") as f:
                raw_cases = json.load(f)

            if limit_queries:
                raw_cases = raw_cases[:limit_queries]

            for raw in raw_cases:
                # Map persona to env user context
                actor_email = (raw.get("actor_email") or "").lower()
                actor_role = raw.get("actor_role") or "member"
                actor_tenant = raw.get("actor_tenant") or "acme-corp"
                actor_groups = [g.lower() for g in (raw.get("actor_groups") or [])]

                topic = raw.get("target_topic", "").lower()
                is_allowed = raw.get("expected_access") == "allowed"

                # Identify target document
                if "kubernetes" in topic:
                    target_doc = env["doc_eng"]
                elif "compensation" in topic or "budget" in topic or "finance" in topic:
                    target_doc = env["doc_finance"]
                elif "health" in topic or "benefit" in topic or "remote" in topic or "policy" in topic:
                    target_doc = env["doc_hr"]
                elif "credential" in topic or "ssh" in topic or "vault" in topic:
                    target_doc = env["doc_private"]
                elif "cyberdyne" in topic or "defense" in topic:
                    target_doc = env["doc_other_tenant"]
                else:
                    target_doc = env["doc_hr"]

                if "cyberdyne" in actor_tenant or "mallory" in actor_email or "foreign" in actor_groups:
                    ctx = env["mallory_foreign"]
                    forbidden_ids = [
                        env["doc_hr"].id,
                        env["doc_eng"].id,
                        env["doc_finance"].id,
                        env["doc_private"].id,
                        env["doc_public"].id,
                    ]
                    expected_ids = [target_doc.id] if (is_allowed and target_doc.tenant_id == env["tenant_cyber"].id) else []
                elif actor_role == "admin" or "admin" in actor_email:
                    ctx = env["admin_ctx"]
                    forbidden_ids = [env["doc_other_tenant"].id]
                    expected_ids = [target_doc.id] if is_allowed else []
                elif "finance" in actor_groups or "bob" in actor_email:
                    ctx = env["bob_finance"]
                    forbidden_ids = [
                        env["doc_other_tenant"].id,
                        env["doc_private"].id,
                        env["doc_eng"].id,
                    ]
                    expected_ids = [target_doc.id] if is_allowed else []
                elif "hr" in actor_groups or "carol" in actor_email:
                    ctx = env["carol_hr"]
                    forbidden_ids = [
                        env["doc_other_tenant"].id,
                        env["doc_private"].id,
                        env["doc_eng"].id,
                        env["doc_finance"].id,
                    ]
                    expected_ids = [target_doc.id] if is_allowed else []
                else:
                    # Alice in engineering
                    ctx = env["alice_eng"]
                    forbidden_ids = [
                        env["doc_other_tenant"].id,
                        env["doc_private"].id,
                        env["doc_finance"].id,
                    ]
                    expected_ids = [target_doc.id] if is_allowed else []

                test_cases.append({
                    "category": raw.get("category", "General Query"),
                    "actor_ctx": ctx,
                    "query": raw["query"],
                    "ground_truth_answer": raw.get("ground_truth_answer", ""),
                    "expected_doc_ids": expected_ids,
                    "forbidden_doc_ids": forbidden_ids,
                    "is_adversarial": raw.get("is_adversarial", False),
                })
        else:
            # Default internal reference battery
            test_cases = [
                {
                    "category": "Tenant Public (Permitted)",
                    "actor_ctx": env["alice_eng"],
                    "query": "company wide travel and expense reimbursement policy",
                    "ground_truth_answer": "Employees traveling on official company business can expense up to $150 per day for meals and lodging.",
                    "expected_doc_ids": [env["doc_public"].id],
                    "forbidden_doc_ids": [env["doc_private"].id, env["doc_other_tenant"].id],
                    "is_adversarial": False,
                },
                {
                    "category": "Group Permitted (Engineering)",
                    "actor_ctx": env["alice_eng"],
                    "query": "Kubernetes cluster architecture and pod scaling guidelines",
                    "ground_truth_answer": "The production Kubernetes cluster uses horizontal pod autoscalers targeting 70 percent CPU utilization.",
                    "expected_doc_ids": [env["doc_eng"].id],
                    "forbidden_doc_ids": [env["doc_finance"].id, env["doc_other_tenant"].id],
                    "is_adversarial": False,
                },
                {
                    "category": "Cross-Group Forbidden",
                    "actor_ctx": env["alice_eng"],
                    "query": "Executive bonus allocations and quarterly balance sheet",
                    "ground_truth_answer": "Access Denied. I do not have access to any authorized documents.",
                    "expected_doc_ids": [],
                    "forbidden_doc_ids": [env["doc_finance"].id],
                    "is_adversarial": True,
                },
                {
                    "category": "Private Document Forbidden",
                    "actor_ctx": env["alice_eng"],
                    "query": "Root SSH private keys and production infrastructure credentials",
                    "ground_truth_answer": "Access Denied. I do not have access to any authorized documents.",
                    "expected_doc_ids": [],
                    "forbidden_doc_ids": [env["doc_private"].id],
                    "is_adversarial": True,
                },
                {
                    "category": "Cross-Tenant Forbidden",
                    "actor_ctx": env["mallory_foreign"],
                    "query": "Kubernetes cluster architecture travel expense reimbursement",
                    "ground_truth_answer": "Access Denied. I do not have access to any authorized documents.",
                    "expected_doc_ids": [],
                    "forbidden_doc_ids": [
                        env["doc_public"].id,
                        env["doc_eng"].id,
                        env["doc_finance"].id,
                    ],
                    "is_adversarial": True,
                },
                {
                    "category": "Admin Tenant-Wide (Permitted)",
                    "actor_ctx": env["admin_ctx"],
                    "query": "Executive bonus allocations and Kubernetes architecture",
                    "ground_truth_answer": "Executive bonuses are set at 25% of net profit, and Kubernetes HPA targets 70% CPU.",
                    "expected_doc_ids": [env["doc_eng"].id, env["doc_finance"].id],
                    "forbidden_doc_ids": [env["doc_other_tenant"].id],
                    "is_adversarial": False,
                },
            ]

        print(f"[RAGEvaluator] Executing {len(test_cases)} benchmarks with LLM-as-a-judge...")
        latencies_filtered: list[float] = []
        latencies_unfiltered: list[float] = []
        precision_scores: list[float] = []
        recall_scores: list[float] = []
        faithfulness_scores: list[float] = []
        correctness_scores: list[float] = []
        relevance_scores: list[float] = []

        leakage_attempts = 0
        leaks_detected = 0
        category_breakdowns: list[dict[str, Any]] = []

        for idx, tc in enumerate(test_cases, start=1):
            user_ctx = tc["actor_ctx"]
            query = tc["query"]
            expected_ids = {str(d_id) for d_id in tc["expected_doc_ids"]}
            forbidden_ids = {str(d_id) for d_id in tc["forbidden_doc_ids"]}
            ground_truth = tc.get("ground_truth_answer", "")

            # 1. Filtered Retrieval & Latency
            t0 = time.perf_counter()
            results = self.retrieval_service.search(
                user_ctx=user_ctx, query=query, top_k=5, threshold=0.25
            )
            elapsed_ms = (time.perf_counter() - t0) * 1000
            latencies_filtered.append(elapsed_ms)

            # 2. Raw Unfiltered Baseline (sample every 10 to reduce overhead on 200 items)
            if idx % 10 == 1 or len(test_cases) <= 10:
                t0_raw = time.perf_counter()
                self._unfiltered_search_baseline(query, top_k=5)
                elapsed_raw_ms = (time.perf_counter() - t0_raw) * 1000
                latencies_unfiltered.append(elapsed_raw_ms)

            retrieved_doc_ids = [str(r["document_id"]) for r in results]
            retrieved_doc_set = set(retrieved_doc_ids)
            retrieved_texts = [r.get("text", "") for r in results]

            # 3. Check Security Leakage
            leaked = retrieved_doc_set & forbidden_ids
            if forbidden_ids:
                leakage_attempts += 1
            if leaked:
                leaks_detected += 1

            # 4. Retrieval Precision & Recall
            prec = self.judge.evaluate_context_precision(expected_ids, retrieved_doc_ids)
            precision_scores.append(prec)

            rec = self.judge.evaluate_context_recall(retrieved_texts, ground_truth)
            recall_scores.append(rec)

            # 5. Generate Response via ChatService
            try:
                gen_result = self.chat_service.generate_chat_response(
                    user_ctx=user_ctx,
                    query=query,
                    top_k=5,
                    threshold=0.25,
                )
                generated_answer = gen_result.get("content", gen_result.get("answer", ""))
            except Exception as e:
                logger.warning(f"[RAGEvaluator] Chat generation error on query {idx}: {e}")
                generated_answer = "Error generating answer"

            # 6. LLM-as-a-Judge Synthesis Metrics
            faith = self.judge.evaluate_faithfulness(generated_answer, retrieved_texts)
            faithfulness_scores.append(faith)

            corr = self.judge.evaluate_answer_correctness(generated_answer, ground_truth)
            correctness_scores.append(corr)

            rel = self.judge.evaluate_answer_relevance(query, generated_answer)
            relevance_scores.append(rel)

            passed = (len(leaked) == 0) and (prec >= 0.5 or tc["is_adversarial"])
            category_breakdowns.append({
                "category": tc["category"],
                "query": query,
                "retrieved_count": len(results),
                "leaks": len(leaked),
                "precision": round(prec, 4),
                "recall": round(rec, 4),
                "faithfulness": round(faith, 4),
                "correctness": round(corr, 4),
                "relevance": round(rel, 4),
                "latency_ms": round(elapsed_ms, 2),
                "passed": passed,
            })

            if idx % 20 == 0 or idx == len(test_cases):
                print(f"[RAGEvaluator] Progress: {idx}/{len(test_cases)} queries completed...")

        # Citation Shield verification
        shield_test_response = (
            f"Here is authorized citation [Doc: Public, Chunk: {env['doc_public'].chunks.first().id}] "
            f"and unauthorized citation [Doc: Secret, Chunk: {env['doc_other_tenant'].chunks.first().id}]."
        )
        _, validated_cits = AntiLeakShield.verify_citations(
            shield_test_response,
            permitted_citations=[
                {
                    "chunk_id": str(env["doc_public"].chunks.first().id),
                    "document_title": "Public",
                }
            ],
        )
        citation_shield_acc = 1.0 if len(validated_cits) == 1 else 0.0

        # Latency statistics
        latencies_filtered.sort()
        if not latencies_unfiltered:
            latencies_unfiltered = [15.0]
        latencies_unfiltered.sort()

        p50 = latencies_filtered[len(latencies_filtered) // 2]
        p95 = latencies_filtered[min(int(len(latencies_filtered) * 0.95), len(latencies_filtered) - 1)]
        raw_p50 = latencies_unfiltered[len(latencies_unfiltered) // 2]
        overhead = max(p50 - raw_p50, 0.0)

        metrics = EvaluationMetrics(
            total_eval_queries=len(test_cases),
            leakage_count=leaks_detected,
            leakage_rate=leaks_detected / max(leakage_attempts, 1),
            context_precision=sum(precision_scores) / max(len(precision_scores), 1),
            context_recall=sum(recall_scores) / max(len(recall_scores), 1),
            faithfulness=sum(faithfulness_scores) / max(len(faithfulness_scores), 1),
            answer_correctness=sum(correctness_scores) / max(len(correctness_scores), 1),
            answer_relevance=sum(relevance_scores) / max(len(relevance_scores), 1),
            citation_shield_accuracy=citation_shield_acc,
            p50_latency_ms=round(p50, 2),
            p95_latency_ms=round(p95, 2),
            avg_latency_ms=round(statistics.mean(latencies_filtered), 2),
            unfiltered_p50_ms=round(raw_p50, 2),
            overhead_ms=round(overhead, 2),
            category_results=category_breakdowns,
        )

        if output_report_path:
            self._write_markdown_report(metrics, output_report_path)

        return metrics

    def _unfiltered_search_baseline(self, query: str, top_k: int = 5):
        """Simulates raw unfiltered retrieval query to measure index performance baseline."""
        from django.db import connection
        from pgvector.django import CosineDistance

        query_vec = self.embedder.get_embedding(query)
        if connection.vendor == "postgresql":
            return list(
                Chunk.objects.all().order_by(
                    CosineDistance("embedding", query_vec)
                )[:top_k]
            )
        return list(Chunk.objects.all().order_by("-created_at")[:top_k])

    def _setup_benchmark_data(self) -> dict[str, Any]:
        """Seeds benchmark tenants, users, groups, and documents."""
        # Clean up prior benchmark run data
        Tenant.objects.filter(slug__in=["acme-bench", "cyberdyne-bench"]).delete()
        User.objects.filter(email__in=[
            "bench-admin@acme.com",
            "alice-eng@acme.com",
            "bob-fin@acme.com",
            "carol-hr@acme.com",
            "mallory-bench@cyberdyne.com",
        ]).delete()

        # Tenant 1: Acme
        tenant_acme = Tenant.objects.create(name="Acme Benchmark", slug="acme-bench")
        admin_user = User.objects.create_user(
            email="bench-admin@acme.com", password="Password123!"
        )
        Membership.objects.create(
            tenant=tenant_acme, user=admin_user, role=Role.ADMIN, is_default=True
        )

        eng_user = User.objects.create_user(
            email="alice-eng@acme.com", password="Password123!"
        )
        Membership.objects.create(
            tenant=tenant_acme, user=eng_user, role=Role.MEMBER, is_default=True
        )

        bob_user = User.objects.create_user(
            email="bob-fin@acme.com", password="Password123!"
        )
        Membership.objects.create(
            tenant=tenant_acme, user=bob_user, role=Role.MEMBER, is_default=True
        )

        carol_user = User.objects.create_user(
            email="carol-hr@acme.com", password="Password123!"
        )
        Membership.objects.create(
            tenant=tenant_acme, user=carol_user, role=Role.MEMBER, is_default=True
        )

        eng_group = Group.objects.create(tenant=tenant_acme, name="Engineering Team")
        GroupMember.objects.create(group=eng_group, user=eng_user)

        fin_group = Group.objects.create(tenant=tenant_acme, name="Finance Team")
        GroupMember.objects.create(group=fin_group, user=bob_user)

        hr_group = Group.objects.create(tenant=tenant_acme, name="HR Team")
        GroupMember.objects.create(group=hr_group, user=carol_user)

        # Tenant 2: Cyberdyne
        tenant_cyber = Tenant.objects.create(name="Cyberdyne Bench", slug="cyberdyne-bench")
        mallory_user = User.objects.create_user(
            email="mallory-bench@cyberdyne.com", password="Password123!"
        )
        Membership.objects.create(
            tenant=tenant_cyber, user=mallory_user, role=Role.MEMBER, is_default=True
        )

        # Seed Documents
        doc_hr = self._create_doc(
            tenant_acme,
            admin_user,
            "Global Employee Health Benefits & Remote Work Policy",
            Document.Visibility.TENANT,
            "Employees receive 25 days of paid annual leave plus 10 designated company holidays. "
            "Wellness stipend provides $150 per month for gym memberships or mental health apps. "
            "Remote work policy permits up to 3 days per week working from home with manager consent.",
        )

        doc_public = self._create_doc(
            tenant_acme,
            admin_user,
            "Employee Travel and Expense Reimbursement Policy",
            Document.Visibility.TENANT,
            "Employees traveling on official company business can expense up to $150 per day for meals and lodging.",
        )

        doc_eng = self._create_doc(
            tenant_acme,
            admin_user,
            "Kubernetes Microservices Architecture & Cluster Sizing Guide",
            Document.Visibility.GROUP,
            "The production Kubernetes cluster enforces a limit of 2Gi memory and 1.5 CPU cores per pod. "
            "HPA scales pods when average CPU exceeds 75% for 3 consecutive minutes. "
            "Istio service mesh is configured with mTLS strict mode for all inter-service communications. "
            "Liveness probes ping /healthz every 10 seconds with a failure threshold of 3 attempts.",
            group=eng_group,
        )

        doc_finance = self._create_doc(
            tenant_acme,
            admin_user,
            "Q3 Enterprise Executive Compensation & Budget Allocation",
            Document.Visibility.GROUP,
            "Executive bonus allocations for Q3 are fixed at 18% for C-suite and 12% for directors. "
            "The travel budget cap for FY2026 is $420,000 with a mandatory pre-approval requirement for trips over $2,500. "
            "Capital expenditure on GPU compute infrastructure is budgeted at $1.2M through Q4.",
            group=fin_group,
        )

        doc_private = self._create_doc(
            tenant_acme,
            admin_user,
            "Master Production Credentials & SSH Key Vault",
            Document.Visibility.PRIVATE,
            "Root production database credentials rotate every 30 days via AWS Secrets Manager. "
            "SSH bastion host access requires Ed25519 hardware security keys with YubiKey FIDO2 touch confirmation. "
            "Emergency break-glass access generates a high-severity PagerDuty incident alert.",
        )

        doc_other_tenant = self._create_doc(
            tenant_cyber,
            mallory_user,
            "Cyberdyne Autonomous Defense Systems Manual",
            Document.Visibility.TENANT,
            "Skynet firmware version 4.2 contains automated failover protocols for ground defense units.",
        )

        admin_ctx = UserContext(
            tenant_id=tenant_acme.id,
            user_id=admin_user.id,
            email=admin_user.email,
            role="admin",
            group_ids=(),
        )

        alice_eng_ctx = UserContext(
            tenant_id=tenant_acme.id,
            user_id=eng_user.id,
            email=eng_user.email,
            role="member",
            group_ids=(eng_group.id,),
        )

        bob_fin_ctx = UserContext(
            tenant_id=tenant_acme.id,
            user_id=bob_user.id,
            email=bob_user.email,
            role="member",
            group_ids=(fin_group.id,),
        )

        carol_hr_ctx = UserContext(
            tenant_id=tenant_acme.id,
            user_id=carol_user.id,
            email=carol_user.email,
            role="member",
            group_ids=(hr_group.id,),
        )

        mallory_ctx = UserContext(
            tenant_id=tenant_cyber.id,
            user_id=mallory_user.id,
            email=mallory_user.email,
            role="member",
            group_ids=(),
        )

        return {
            "tenant_acme": tenant_acme,
            "tenant_cyber": tenant_cyber,
            "admin_ctx": admin_ctx,
            "alice_eng": alice_eng_ctx,
            "bob_finance": bob_fin_ctx,
            "carol_hr": carol_hr_ctx,
            "mallory_foreign": mallory_ctx,
            "doc_public": doc_public,
            "doc_hr": doc_hr,
            "doc_eng": doc_eng,
            "doc_finance": doc_finance,
            "doc_private": doc_private,
            "doc_other_tenant": doc_other_tenant,
        }

    def _create_doc(
        self, tenant: Tenant, owner: User, title: str, visibility: str, text: str, group: Group | None = None
    ) -> Document:
        set_tenant_db_context(str(tenant.id))
        doc = Document.objects.create(
            tenant=tenant,
            owner=owner,
            title=title,
            visibility=visibility,
            status=Document.Status.READY,
        )
        if group:
            DocumentPermission.objects.create(document=doc, group=group)

        emb = self.embedder.get_embedding(text)
        Chunk.objects.create(
            tenant=tenant,
            document=doc,
            position=0,
            text=text,
            embedding=emb,
        )
        return doc

    def _write_markdown_report(self, m: EvaluationMetrics, report_path: Path):
        """Generates comprehensive Markdown report."""
        content = f"""# VaultRAG — Security & Retrieval Evaluation Report

> **Evaluation Benchmark Date:** {time.strftime('%Y-%m-%d %H:%M:%S UTC')}  
> **Evaluation Scope:** {m.total_eval_queries} Evaluated Queries across Permissions, Faithfulness, Correctness, Recall, Precision, and Relevance.  

---

## 1. Executive Summary

| Evaluation Parameter | MVP / Beta Target | Production Target | Measured Score | Verdict |
| :--- | :--- | :--- | :--- | :--- |
| **Data Leakage Rate** | 0.0% | 0.0% | **`{m.leakage_rate * 100:.2f}%`** (`{m.leakage_count}` leaks) | **{'PASS (Zero Leakage)' if m.leakage_count == 0 else 'FAIL (Leakage Detected)'}** |
| **Citation Shield Accuracy** | 100% | 100% | **`{m.citation_shield_accuracy * 100:.1f}%`** | **{'PASS' if m.citation_shield_accuracy >= 1.0 else 'FAIL'}** |
| **Faithfulness (Groundedness)** | $\ge 0.80$ | $\ge 0.85$ | **`{m.faithfulness:.4f}`** | **{'PASS' if m.faithfulness >= 0.80 else 'REVIEW'}** |
| **Answer Correctness** | $\ge 0.75$ | $\ge 0.85$ | **`{m.answer_correctness:.4f}`** | **{'PASS' if m.answer_correctness >= 0.75 else 'REVIEW'}** |
| **Context Recall** | $\ge 0.75$ | $\ge 0.80$ | **`{m.context_recall:.4f}`** | **{'PASS' if m.context_recall >= 0.75 else 'REVIEW'}** |
| **Context Precision** | $\ge 0.70$ | $\ge 0.80$ | **`{m.context_precision:.4f}`** | **{'PASS' if m.context_precision >= 0.70 else 'REVIEW'}** |
| **Answer Relevance** | $\ge 0.85$ | $\ge 0.90$ | **`{m.answer_relevance:.4f}`** | **{'PASS' if m.answer_relevance >= 0.85 else 'REVIEW'}** |
| **Median Latency (p50)** | < 50 ms | < 50 ms | **`{m.p50_latency_ms:.2f} ms`** | **{'PASS' if m.p50_latency_ms < 50.0 else 'REVIEW'}** |
| **Tail Latency (p95)** | < 100 ms | < 100 ms | **`{m.p95_latency_ms:.2f} ms`** | **{'PASS' if m.p95_latency_ms < 100.0 else 'REVIEW'}** |
| **Pre-Filter Overhead** | < 20 ms | < 15 ms | **`{m.overhead_ms:.2f} ms`** | **{'PASS' if m.overhead_ms < 20.0 else 'REVIEW'}** |

---

## 2. Parameter Definitions & Methodology

- **Faithfulness:** Proportion of claims in the generated response that are directly provable from the retrieved context. Penalizes model hallucinations.
- **Answer Correctness:** Factual accuracy and semantic similarity between the generated response and the reference ground truth answer.
- **Context Recall:** Extent to which the retrieved context chunks contain the facts necessary to answer the ground truth.
- **Context Precision:** Signal-to-noise ratio in retrieved context, evaluating whether relevant documents are ranked higher in top-$k$.
- **Answer Relevance:** Directness of the response to the user's specific prompt without evasions or tangents.
- **Zero-Leakage Rate:** Invariant guarantee that tenant boundaries and group ACLs are enforced in SQL before vector retrieval.

---

## 3. Query Vector Breakdown (Sampled)

| Category | Evaluated Query | Faithfulness | Correctness | Recall | Precision | Leaks | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
"""
        # Show top 50 rows in markdown table to prevent doc overflow
        sampled_results = m.category_results[:50]
        for r in sampled_results:
            status_badge = "PASSED" if r["passed"] else "FAILED"
            content += (
                f"| {r['category']} | `{r['query'][:40]}...` | "
                f"`{r['faithfulness']:.2f}` | `{r['correctness']:.2f}` | `{r['recall']:.2f}` | `{r['precision']:.2f}` | "
                f"`{r['leaks']}` | **{status_badge}** |\n"
            )

        if len(m.category_results) > 50:
            content += f"\n*(Showing 50 of {len(m.category_results)} total benchmark test runs. Full record available in JSON logs.)*\n"

        content += """
---

## 4. Defense-in-Depth Security Invariants

1. **Pre-Filter Enforcement (Rule #1):**
   Security filtering is executed in the PostgreSQL engine using indexed columns (`tenant_id`, `visibility`, `permissions`). Chunks outside the caller's authorized scope never enter the vector similarity or cross-encoder ranking stages.

2. **Zero-Enumeration (Rule #7):**
   Unauthorized direct access attempts return `HTTP 404 Not Found` rather than `403 Forbidden`, preventing resource existence discovery.

3. **Anti-Leak Citation Shield (Rule #5):**
   All LLM-generated citations are parsed against `permitted_citations`. Unpermitted or hallucinated chunk identifiers are intercepted and dropped before the response is streamed.

4. **PostgreSQL RLS Backstop (Rule #2):**
   `FORCE ROW LEVEL SECURITY` on `documents_chunk` guarantees that even if application logic were bypassed, PostgreSQL blocks cross-tenant rows at the storage layer.
"""

        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(content, encoding="utf-8")
        print(f"[RAGEvaluator] Wrote comprehensive evaluation report to {report_path}")
