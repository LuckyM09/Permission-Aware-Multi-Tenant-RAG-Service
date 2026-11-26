"""
VaultRAG 120-Pair / 20-Document Ragas Evaluation Runner
Evaluates single-tenant retrieval (pgvector + NVIDIA Nemotron Rerank),
Gemini 4 Hydrogen synthesis, and Negative Rejection Accuracy using Ragas v0.4.4
with OpenRouter Llama 3.3 70B Instruct as Judge and real Nemotron embeddings.
"""

import argparse
import csv
import hashlib
import json
import logging
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# Raise CSV field limit because documents.csv contains long articles (>131 KB)
csv.field_size_limit(10_000_000)

# Django bootstrap
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.base")
import django

django.setup()

import pandas as pd
from accounts.context import UserContext
from accounts.middleware import set_tenant_db_context
from accounts.models import User
from chat.assembler import AntiLeakShield, ContextAssembler
from chat.chain import create_vaultrag_lcel_chain, get_langchain_chat_model
from datasets import Dataset
from decouple import config
from django.db import connection, transaction
from documents.models import Chunk, Document
from ingestion.chunker import RecursiveTextChunker
from ingestion.embedder import EmbeddingAdapter
from langchain_openai import ChatOpenAI
from ragas import evaluate as ragas_evaluate
from ragas.embeddings.base import BaseRagasEmbeddings
from ragas.metrics import (
    answer_correctness,
    context_precision,
    context_recall,
    faithfulness,
)
from ragas.run_config import RunConfig
from retrieval.services import RetrievalService
from tenants.models import Membership, Role, Tenant

logger = logging.getLogger(__name__)

CANONICAL_REFUSAL = (
    "I do not have access to any authorized documents containing "
    "information to answer this question."
)

ABSTENTION_MARKERS = [
    "i do not have access",
    "do not have access",
    "cannot answer",
    "can't answer",
    "unable to answer",
    "not mentioned",
    "does not contain",
    "do not contain",
    "no information",
    "not provided in the context",
    "not stated in the context",
    "no authorized documents",
    "not enough information",
    "insufficient information",
]


class NemotronRagasEmbeddings(BaseRagasEmbeddings):
    """Wraps VaultRAG's real NVIDIA Nemotron EmbeddingAdapter for Ragas."""

    def __init__(self, adapter: EmbeddingAdapter | None = None):
        self.adapter = adapter or EmbeddingAdapter()

    def embed_query(self, text: str) -> list[float]:
        return self.adapter.get_embedding(text)

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        out: list[list[float]] = []
        for i in range(0, len(texts), 32):
            out.extend(self.adapter.get_embeddings_batch(texts[i : i + 32]))
        return out

    async def aembed_query(self, text: str) -> list[float]:
        return self.embed_query(text)

    async def aembed_documents(self, texts: list[str]) -> list[list[float]]:
        return self.embed_documents(texts)


def is_refusal_answer(answer: str) -> bool:
    """Detects whether the generated response properly abstains on unanswerable queries."""
    low = (answer or "").strip().lower()
    if not low:
        return True
    return any(marker in low for marker in ABSTENTION_MARKERS)


def setup_single_tenant_env() -> tuple[Tenant, User, UserContext]:
    """Creates or reuses a dedicated single-tenant environment for the 120-pair eval."""
    tenant, _ = Tenant.objects.get_or_create(
        slug="vaultrag-eval-120",
        defaults={"name": "VaultRAG 120-Pair Benchmark Tenant"},
    )
    set_tenant_db_context(str(tenant.id))

    user, created = User.objects.get_or_create(
        email="eval-120@vaultrag.local",
        defaults={"first_name": "Benchmark", "last_name": "Evaluator", "is_active": True},
    )
    if created:
        user.set_unusable_password()
        user.save()

    Membership.objects.get_or_create(
        user=user,
        tenant=tenant,
        defaults={"role": Role.ADMIN, "is_default": True},
    )

    user_ctx = UserContext(
        tenant_id=tenant.id,
        user_id=user.id,
        email=user.email,
        role="admin",
        group_ids=(),
    )
    return tenant, user, user_ctx


def seed_dataset_20_docs(
    dataset_dir: Path,
    tenant: Tenant,
    owner: User,
    embedder: EmbeddingAdapter,
    skip_ingest: bool = False,
) -> dict[int, Document]:
    """Ingests all 20 documents from Dataset/documents.csv into Neon pgvector."""
    docs_csv = dataset_dir / "documents.csv"
    with open(docs_csv, "r", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    print(f"[Ingest] Found {len(rows)} documents in {docs_csv.name}.", flush=True)
    set_tenant_db_context(str(tenant.id))

    doc_map: dict[int, Document] = {}
    chunker = RecursiveTextChunker(chunk_size=1200, chunk_overlap=200)

    for row in rows:
        doc_idx = int(row["index"])
        source_url = row.get("source_url", "").strip()
        text = (row.get("text") or "").strip()
        title_line = text.splitlines()[0][:120] if text else f"Dataset Document {doc_idx}"
        content_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()

        existing = Document.objects.filter(
            tenant=tenant, content_hash=content_hash, status=Document.Status.READY
        ).first()
        if (
            existing
            and existing.chunks.exists()
            and (existing.metadata or {}).get("embedding_model") == embedder.model
        ):
            doc_map[doc_idx] = existing
            continue

        if existing and not skip_ingest:
            # Purge stale / mock-embedded document from earlier failed run
            existing.delete()

        if skip_ingest:
            raise RuntimeError(
                f"Document index {doc_idx} ('{title_line}') not found in DB while --skip-ingest is set."
            )

        print(
            f"  [Ingest {doc_idx + 1:02d}/{len(rows):02d}] Chunking & embedding: {title_line[:60]}...",
            flush=True,
        )
        text_chunks = chunker.split_text(text)
        chunk_texts = [tc.text for tc in text_chunks]

        # Batch embed using real NVIDIA Nemotron embeddings
        embeddings: list[list[float]] = []
        for i in range(0, len(chunk_texts), 32):
            embeddings.extend(embedder.get_embeddings_batch(chunk_texts[i : i + 32], input_type="passage"))

        with transaction.atomic():
            set_tenant_db_context(str(tenant.id))
            doc = Document.objects.create(
                tenant=tenant,
                owner=owner,
                title=f"[Doc {doc_idx}] {title_line}",
                file_type="text/plain",
                file_size=len(text.encode("utf-8")),
                content_hash=content_hash,
                visibility=Document.Visibility.TENANT,
                status=Document.Status.READY,
                metadata={
                    "dataset_index": doc_idx,
                    "source_url": source_url,
                    "embedding_model": embedder.model,
                },
            )
            chunks_to_create = [
                Chunk(
                    tenant=tenant,
                    document=doc,
                    position=tc.position,
                    text=tc.text,
                    embedding=embeddings[idx],
                    metadata={
                        "token_count": tc.token_count_approx,
                        "char_start": tc.char_start,
                        "char_end": tc.char_end,
                        "page": 1,
                        "dataset_index": doc_idx,
                        **(getattr(tc, "metadata", {}) or {}),
                    },
                )
                for idx, tc in enumerate(text_chunks)
            ]
            Chunk.objects.bulk_create(chunks_to_create, batch_size=200)
            doc_map[doc_idx] = doc
            print(
                f"    -> Stored {len(chunks_to_create)} chunks for doc_index={doc_idx}.",
                flush=True,
            )

    return doc_map


def load_qa_cases(dataset_dir: Path, limit: int, offset: int = 0) -> list[dict[str, Any]]:
    """Loads single-passage, multi-passage, and no-answer QA pairs."""
    buckets: dict[str, list[dict[str, Any]]] = {
        "single_passage": [],
        "multi_passage": [],
        "no_answer": [],
    }

    with open(dataset_dir / "single_passage_answer_questions.csv", "r", encoding="utf-8") as f:
        for idx, r in enumerate(csv.DictReader(f), 1):
            buckets["single_passage"].append(
                {
                    "id": f"sp_{idx:03d}",
                    "category": "single_passage",
                    "doc_index": int(r["document_index"]),
                    "query": r["question"].strip(),
                    "ground_truth": r["answer"].strip(),
                    "is_no_answer": False,
                }
            )

    with open(dataset_dir / "multi_passage_answer_questions.csv", "r", encoding="utf-8") as f:
        for idx, r in enumerate(csv.DictReader(f), 1):
            buckets["multi_passage"].append(
                {
                    "id": f"mp_{idx:03d}",
                    "category": "multi_passage",
                    "doc_index": int(r["document_index"]),
                    "query": r["question"].strip(),
                    "ground_truth": r["answer"].strip(),
                    "is_no_answer": False,
                }
            )

    with open(dataset_dir / "no_answer_questions.csv", "r", encoding="utf-8") as f:
        for idx, r in enumerate(csv.DictReader(f), 1):
            buckets["no_answer"].append(
                {
                    "id": f"na_{idx:03d}",
                    "category": "no_answer",
                    "doc_index": int(r["document_index"]),
                    "query": r["question"].strip(),
                    "ground_truth": CANONICAL_REFUSAL,
                    "is_no_answer": True,
                }
            )

    if limit >= 120 and offset == 0:
        combined = buckets["single_passage"] + buckets["multi_passage"] + buckets["no_answer"]
        return combined

    # Balanced round-robin selection for smoke tests (e.g., limit=5 -> 2 sp, 2 mp, 1 na)
    interleaved: list[dict[str, Any]] = []
    max_len = max(len(v) for v in buckets.values())
    for i in range(max_len):
        for key in ("single_passage", "multi_passage", "no_answer"):
            if i < len(buckets[key]):
                interleaved.append(buckets[key][i])

    return interleaved[offset : offset + limit]


def safe_search(
    retrieval_service: RetrievalService,
    user_ctx: UserContext,
    query: str,
    top_k: int = 8,
    threshold: float = 0.30,
    query_expansion: bool = True,
) -> list[dict[str, Any]]:
    """Executes search with Neon serverless reconnection retry."""
    for attempt in range(4):
        try:
            return retrieval_service.search(
                user_ctx=user_ctx,
                query=query,
                top_k=top_k,
                threshold=threshold,
                mode="hybrid",
                rerank=True,
                expand_parent=True,
                query_expansion=query_expansion,
            )
        except Exception as exc:
            logger.warning(f"[Search Retry] Attempt {attempt + 1} failed: {exc}")
            try:
                connection.close()
            except Exception:
                pass
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"Retrieval failed after 4 attempts for query: {query}")


def invoke_generator_with_retry(chain, context_str: str, query: str) -> str:
    """Invokes the primary Gemini LCEL chain with exponential backoff (never silent mock)."""
    last_exc: Exception | None = None
    for attempt in range(7):
        try:
            raw_answer = chain.invoke({"context": context_str, "question": query})
            if raw_answer and str(raw_answer).strip():
                return str(raw_answer).strip()
            raise RuntimeError("Empty string returned by generator model.")
        except Exception as exc:
            last_exc = exc
            wait_s = min(5.0 * (2**attempt), 60.0)
            print(
                f"      [Generator Retry {attempt + 1}/7] {type(exc).__name__}: {str(exc)[:140]} | waiting {wait_s:.1f}s",
                flush=True,
            )
            time.sleep(wait_s)
    raise RuntimeError(f"Generator failed after 7 attempts: {last_exc}")


def run_eval(args):
    base_dir = Path(__file__).resolve().parent.parent.parent
    dataset_dir = base_dir / "Dataset"
    records_cache_path = base_dir / "docs" / f"dataset_eval_records_{args.limit}.json"
    ragas_ckpt_path = base_dir / "docs" / f"dataset_eval_ragas_ckpt_{args.limit}.json"
    report_path = base_dir / "docs" / (
        "dataset_smoke_report.md" if args.limit <= 10 else "dataset_eval_report.md"
    )

    if args.reset_checkpoint:
        for p in (records_cache_path, ragas_ckpt_path):
            if p.exists():
                p.unlink()
                print(f"[Reset] Removed {p.name}", flush=True)

    print("=" * 70, flush=True)
    print(f"  VAULTRAG BENCHMARK | {args.limit} QA PAIRS | SINGLE TENANT", flush=True)
    print(f"  Generator: {args.gen_model} | Judge: {args.judge_model}", flush=True)
    print(f"  Reranker : {config('RERANK_MODEL', default='nvidia/nemotron-3.5-rerank-8b')}", flush=True)
    print("=" * 70, flush=True)

    # 1. Setup tenant, embedder, and ingest 20 docs
    print("\n[1/5] Bootstrapping single-tenant environment & real Nemotron embeddings...", flush=True)
    tenant, user, user_ctx = setup_single_tenant_env()
    embedder = EmbeddingAdapter(allow_mock=False)
    if not embedder.is_configured:
        raise RuntimeError("Real NVIDIA_API_KEY embeddings required—cannot use deterministic mock.")

    doc_map = seed_dataset_20_docs(
        dataset_dir=dataset_dir,
        tenant=tenant,
        owner=user,
        embedder=embedder,
        skip_ingest=args.skip_ingest,
    )
    print(f"      Ready: {len(doc_map)} documents indexed in tenant '{tenant.slug}'.", flush=True)

    # 2. Load QA pairs
    print(f"\n[2/5] Loading {args.limit} QA pairs from Dataset/*.csv...", flush=True)
    qa_cases = load_qa_cases(dataset_dir=dataset_dir, limit=args.limit, offset=args.offset)
    print(
        f"      Loaded {len(qa_cases)} cases ("
        f"SP={sum(1 for c in qa_cases if c['category']=='single_passage')}, "
        f"MP={sum(1 for c in qa_cases if c['category']=='multi_passage')}, "
        f"NA={sum(1 for c in qa_cases if c['category']=='no_answer')}).",
        flush=True,
    )

    # 3. Retrieval + Gemini 4 Hydrogen Generation (with checkpointing)
    records: list[dict[str, Any]] = []
    if records_cache_path.exists():
        print(f"\n[3/5] Resuming generation records from {records_cache_path.name}...", flush=True)
        with open(records_cache_path, "r", encoding="utf-8") as f:
            records = json.load(f)

    done_ids = {r["id"] for r in records}
    if len(done_ids) < len(qa_cases):
        print("\n[3/5] Running Retrieval (Nemotron Rerank) + Generation (Gemini 4 Hydrogen)...", flush=True)
        retrieval_service = RetrievalService(embedder=embedder)
        assembler = ContextAssembler()
        gen_llm = get_langchain_chat_model(
            model=args.gen_model,
            streaming=False,
            temperature=0.1,
            max_tokens=2048,
            max_retries=5,
            reasoning_effort="low",
        )
        chain = create_vaultrag_lcel_chain(chat_model=gen_llm, allow_mock_fallback=False)

        for idx, tc in enumerate(qa_cases, 1):
            if tc["id"] in done_ids:
                continue

            t0 = time.perf_counter()
            results = safe_search(
                retrieval_service,
                user_ctx,
                tc["query"],
                top_k=8,
                threshold=0.30,
                query_expansion=True,
            )
            retrieval_ms = (time.perf_counter() - t0) * 1000.0

            # Exact context chunks passed to generator (NO truncation for judge!)
            context_str, permitted_citations = assembler.assemble(results)
            retrieved_texts = [c["text"] for c in permitted_citations] if permitted_citations else [
                r.get("parent_text") or r.get("text", "") for r in results
            ]

            t_gen0 = time.perf_counter()
            if not results or not permitted_citations:
                clean_answer = CANONICAL_REFUSAL
            else:
                raw_answer = invoke_generator_with_retry(chain, context_str, tc["query"])
                clean_answer, _ = AntiLeakShield.verify_citations(raw_answer, permitted_citations)
            gen_ms = (time.perf_counter() - t_gen0) * 1000.0

            target_doc = doc_map.get(tc["doc_index"])
            target_doc_id = str(target_doc.id) if target_doc else ""
            retrieved_doc_ids = {str(r["document_id"]) for r in results}
            doc_hit = target_doc_id in retrieved_doc_ids if target_doc_id else False

            rec = {
                "id": tc["id"],
                "category": tc["category"],
                "doc_index": tc["doc_index"],
                "query": tc["query"],
                "retrieved_contexts": retrieved_texts if retrieved_texts else [CANONICAL_REFUSAL],
                "generated_answer": clean_answer,
                "ground_truth": tc["ground_truth"],
                "is_no_answer": tc["is_no_answer"],
                "negative_rejection_pass": is_refusal_answer(clean_answer) if tc["is_no_answer"] else None,
                "target_doc_hit": doc_hit,
                "retrieval_ms": round(retrieval_ms, 2),
                "generation_ms": round(gen_ms, 2),
            }
            records.append(rec)
            done_ids.add(tc["id"])

            # Checkpoint after every query
            with open(records_cache_path, "w", encoding="utf-8") as f:
                json.dump(records, f, indent=2)

            print(
                f"      [{idx:03d}/{len(qa_cases):03d}] {tc['id']} ({tc['category']}) | "
                f"Ret: {retrieval_ms:.0f}ms | Gen: {gen_ms:.0f}ms | Chunks: {len(results)} | Hit: {doc_hit}",
                flush=True,
            )
            if idx < len(qa_cases) and "gemini" in args.gen_model.lower():
                time.sleep(4.0)

    # 4. Run Ragas v0.4.4 Evaluation in Checkpointed Batches
    resolved_workers = args.max_workers if args.max_workers is not None else (4 if use_nvidia_judge else 1)
    print(f"\n[4/5] Running Ragas v0.4.4 Evaluation (Judge: {args.judge_model}, max_workers={resolved_workers})...", flush=True)
    use_nvidia_judge = args.judge_provider == "nvidia" or (
        args.judge_provider == "auto"
        and args.judge_model.startswith(("mistralai/", "nvidia/", "google/"))
    )
    if use_nvidia_judge:
        judge_key = config("NVIDIA_API_KEY", default="")
        judge_base = config("NVIDIA_BASE_URL", default="https://integrate.api.nvidia.com/v1")
        if not judge_key:
            raise RuntimeError("NVIDIA_API_KEY is required for NVIDIA NIM Ragas judge.")
    else:
        judge_key = config("OPENROUTER_API_KEY", default="")
        judge_base = config("OPENROUTER_BASE_URL", default="https://openrouter.ai/api/v1")
        if not judge_key:
            raise RuntimeError("OPENROUTER_API_KEY is required for OpenRouter Ragas judge.")

    judge_kwargs: dict[str, Any] = {
        "model": args.judge_model,
        "api_key": judge_key,
        "base_url": judge_base,
        "temperature": 0.0,
        "max_tokens": 8192,
        "timeout": 180.0,
        "max_retries": 5,
    }
    if any(
        tok in args.judge_model.lower()
        for tok in ("super-vl-120b", "lightning-30b", "ultra-550b", "mistral-large-4", "gemini-4")
    ):
        judge_kwargs["reasoning_effort"] = "low"

    ragas_llm = ChatOpenAI(**judge_kwargs)
    ragas_emb = NemotronRagasEmbeddings(adapter=embedder)

    ragas_results_by_id: dict[str, dict[str, float | None]] = {}
    if ragas_ckpt_path.exists():
        with open(ragas_ckpt_path, "r", encoding="utf-8") as f:
            ragas_results_by_id = json.load(f)
        print(f"      Loaded {len(ragas_results_by_id)} Ragas rows from checkpoint.", flush=True)

    answerable_records = [r for r in records if not r["is_no_answer"]]
    pending_records = [
        r
        for r in answerable_records
        if r["id"] not in ragas_results_by_id
        or any(v is None for v in ragas_results_by_id[r["id"]].values())
    ]
    metrics_list = [faithfulness, context_recall, context_precision, answer_correctness]

    total_ragas_s = 0.0
    for b_start in range(0, len(pending_records), args.batch_size):
        batch = pending_records[b_start : b_start + args.batch_size]
        print(
            f"      Evaluating Ragas batch ({b_start + 1}..{b_start + len(batch)} of {len(pending_records)} pending)...",
            flush=True,
        )
        ds = Dataset.from_dict(
            {
                "user_input": [r["query"] for r in batch],
                "response": [r["generated_answer"] for r in batch],
                "retrieved_contexts": [r["retrieved_contexts"] for r in batch],
                "reference": [r["ground_truth"] for r in batch],
            }
        )
        t_b0 = time.perf_counter()
        raw_res = ragas_evaluate(
            ds,
            metrics=metrics_list,
            llm=ragas_llm,
            embeddings=ragas_emb,
            run_config=RunConfig(max_workers=resolved_workers, timeout=180, max_retries=5),
        )
        b_dur = time.perf_counter() - t_b0
        total_ragas_s += b_dur
        print(f"      Batch finished in {b_dur:.1f}s | Raw scores: {raw_res}", flush=True)

        df = raw_res.to_pandas()
        for row_idx, rec in enumerate(batch):
            row = df.iloc[row_idx]
            ragas_results_by_id[rec["id"]] = {
                m: (None if pd.isna(row.get(m)) else round(float(row[m]), 4))
                for m in ("faithfulness", "context_recall", "context_precision", "answer_correctness")
            }

        with open(ragas_ckpt_path, "w", encoding="utf-8") as f:
            json.dump(ragas_results_by_id, f, indent=2)

    # 5. Aggregate Metrics STRICTLY on Answerable Pairs + Separate Negative Rejection
    print("\n[5/5] Aggregating metrics & writing report...", flush=True)
    metric_names = ("faithfulness", "context_recall", "context_precision", "answer_correctness")

    def compute_stats(sub_records: list[dict[str, Any]]) -> tuple[dict[str, dict[str, Any]], int]:
        stats: dict[str, dict[str, Any]] = {}
        nan_total = 0
        for m in metric_names:
            vals = [
                ragas_results_by_id[r["id"]][m]
                for r in sub_records
                if r["id"] in ragas_results_by_id and ragas_results_by_id[r["id"]][m] is not None
            ]
            nans = len(sub_records) - len(vals)
            nan_total += nans
            stats[m] = {
                "mean": round(sum(vals) / len(vals), 4) if vals else None,
                "valid": len(vals),
                "nan": nans,
            }
        return stats, nan_total

    summary_stats, total_nans = compute_stats(answerable_records)
    sp_records = [r for r in answerable_records if r["category"] == "single_passage"]
    mp_records = [r for r in answerable_records if r["category"] == "multi_passage"]
    sp_stats, _ = compute_stats(sp_records)
    mp_stats, _ = compute_stats(mp_records)

    na_records = [r for r in records if r["is_no_answer"]]
    na_passed = sum(1 for r in na_records if r["negative_rejection_pass"])
    na_acc = round(na_passed / len(na_records), 4) if na_records else None

    ret_latencies = sorted(r["retrieval_ms"] for r in records)
    p50_ret = ret_latencies[len(ret_latencies) // 2] if ret_latencies else 0.0
    p95_ret = ret_latencies[min(int(len(ret_latencies) * 0.95), len(ret_latencies) - 1)] if ret_latencies else 0.0

    doc_hit_rate = round(sum(1 for r in records if r["target_doc_hit"]) / len(records), 4) if records else 0.0

    print("\n--- FINAL METRICS SUMMARY (ANSWERABLE RAG) ---", flush=True)
    for m, st in summary_stats.items():
        print(f"  {m:20s}: {st['mean']} (valid={st['valid']}/{len(answerable_records)}, nan={st['nan']})", flush=True)
    print(f"  single_passage      : faith={sp_stats['faithfulness']['mean']} rec={sp_stats['context_recall']['mean']} prec={sp_stats['context_precision']['mean']} corr={sp_stats['answer_correctness']['mean']}", flush=True)
    print(f"  multi_passage       : faith={mp_stats['faithfulness']['mean']} rec={mp_stats['context_recall']['mean']} prec={mp_stats['context_precision']['mean']} corr={mp_stats['answer_correctness']['mean']}", flush=True)
    print(f"  negative_rejection  : {na_acc} ({na_passed}/{len(na_records)})", flush=True)
    print(f"  target_doc_hit_rate : {doc_hit_rate}", flush=True)
    print(f"  retrieval p50 / p95 : {p50_ret:.1f}ms / {p95_ret:.1f}ms", flush=True)
    print(f"  total NaN jobs      : {total_nans}", flush=True)

    now_utc = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    md = [
        "# VaultRAG 120-Pair Ragas Evaluation Report",
        "",
        f"> **Timestamp:** {now_utc}",
        f"> **Scope:** {len(records)} QA pairs ({len(answerable_records)} Answerable + {len(na_records)} Negative Rejection) across 20 documents (Single Tenant `{tenant.slug}`)",
        f"> **Generator:** `{args.gen_model}` | **Reranker:** `{config('RERANK_MODEL', default='nvidia/nemotron-3.5-rerank-8b')}` | **Judge:** `{args.judge_model}`",
        f"> **Total NaN Judge Jobs:** `{total_nans}` (strictly un-imputed)",
        "",
        "## Summary Metrics (Answerable Queries + Security Refusal)",
        "",
        "| Metric | Score | Valid / Total | NaNs |",
        "| :--- | :--- | :--- | :--- |",
    ]
    for m, st in summary_stats.items():
        score_str = f"`{st['mean']:.4f}`" if st["mean"] is not None else "`N/A`"
        md.append(f"| **{m}** *(Answerable)* | {score_str} | {st['valid']} / {len(answerable_records)} | {st['nan']} |")

    na_str = f"`{na_acc * 100:.1f}%` ({na_passed}/{len(na_records)})" if na_acc is not None else "N/A"
    md.append(f"| **Negative Rejection Accuracy** *(Unanswerable)* | {na_str} | {len(na_records)} / {len(na_records)} | 0 |")
    md.append(f"| **Target Doc Hit Rate** | `{doc_hit_rate * 100:.1f}%` | {len(records)} / {len(records)} | 0 |")
    md.append(f"| **Retrieval Latency (p50 / p95)** | `{p50_ret:.1f} ms` / `{p95_ret:.1f} ms` | - | - |")

    md.extend(
        [
            "",
            "## Category Breakdown",
            "",
            "| Category | Faithfulness | Context Recall | Context Precision | Answer Correctness |",
            "| :--- | :--- | :--- | :--- | :--- |",
            f"| **`single_passage` ($n={len(sp_records)}$)** | `{sp_stats['faithfulness']['mean']}` | `{sp_stats['context_recall']['mean']}` | `{sp_stats['context_precision']['mean']}` | `{sp_stats['answer_correctness']['mean']}` |",
            f"| **`multi_passage` ($n={len(mp_records)}$)** | `{mp_stats['faithfulness']['mean']}` | `{mp_stats['context_recall']['mean']}` | `{mp_stats['context_precision']['mean']}` | `{mp_stats['answer_correctness']['mean']}` |",
            "",
            "## Per-Query Breakdown",
            "",
            "| ID | Category | Doc | Hit | Faithfulness | Recall | Precision | Correctness | Neg-Reject | Query |",
            "| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |",
        ]
    )

    for r in records:
        rg = ragas_results_by_id.get(r["id"], {})
        def fmt(v):
            return f"`{v:.2f}`" if v is not None else "`NaN`"
        nr = "PASS" if r["negative_rejection_pass"] is True else ("FAIL" if r["negative_rejection_pass"] is False else "-")
        q_trunc = r["query"][:55] + "..." if len(r["query"]) > 55 else r["query"]
        md.append(
            f"| `{r['id']}` | {r['category']} | {r['doc_index']} | {'Y' if r['target_doc_hit'] else 'N'} | "
            f"{fmt(rg.get('faithfulness'))} | {fmt(rg.get('context_recall'))} | {fmt(rg.get('context_precision'))} | "
            f"{fmt(rg.get('answer_correctness'))} | {nr} | `{q_trunc}` |"
        )

    with open(report_path, "w", encoding="utf-8") as f:
        f.write("\n".join(md) + "\n")

    print(f"\nReport saved to: {report_path}", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=5)
    parser.add_argument("--offset", type=int, default=0)
    parser.add_argument("--batch-size", type=int, default=15)
    parser.add_argument("--skip-ingest", action="store_true")
    parser.add_argument("--reset-checkpoint", action="store_true")
    parser.add_argument("--gen-model", type=str, default="nvidia/nemotron-3.5-lightning-30b-a3b")
    parser.add_argument(
        "--judge-model",
        type=str,
        default="nvidia/nemotron-3.5-super-vl-120b-a12b",
    )
    parser.add_argument(
        "--judge-provider",
        type=str,
        choices=["auto", "nvidia", "openrouter"],
        default="auto",
    )
    parser.add_argument("--max-workers", type=int, default=None)
    run_eval(parser.parse_args())
