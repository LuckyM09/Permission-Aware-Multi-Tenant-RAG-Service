from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

from retrieval.evaluation import RAGEvaluator


class Command(BaseCommand):
    help = "Runs comprehensive multi-parameter RAG evaluation (Faithfulness, Correctness, Recall, Precision, Relevance, and Zero-Leakage)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--output",
            type=str,
            default=str(settings.BASE_DIR.parent / "docs" / "eval_report.md"),
            help="Destination markdown report file path.",
        )
        parser.add_argument(
            "--dataset",
            type=str,
            default=str(settings.BASE_DIR.parent / "docs" / "eval_dataset_200.json"),
            help="Path to evaluation dataset JSON.",
        )
        parser.add_argument(
            "--limit",
            type=int,
            default=None,
            help="Limit number of queries to evaluate (e.g. 10 or 50 for quick test).",
        )

    def handle(self, *args, **options):
        output_path = Path(options["output"])
        dataset_path = Path(options["dataset"])
        limit_queries = options.get("limit")

        self.stdout.write(self.style.NOTICE("======================================================="))
        self.stdout.write(self.style.NOTICE("   VAULTRAG MULTI-PARAMETER BENCHMARK EVALUATOR       "))
        self.stdout.write(self.style.NOTICE("======================================================="))

        if dataset_path.exists():
            self.stdout.write(f"Using Dataset      : {dataset_path.name}")
        else:
            self.stdout.write("Using Dataset      : Reference Invariant Test Suite")

        evaluator = RAGEvaluator()
        metrics = evaluator.run_benchmark(
            output_report_path=output_path,
            dataset_path=dataset_path if dataset_path.exists() else None,
            limit_queries=limit_queries,
        )

        self.stdout.write(self.style.SUCCESS("\n======================================================="))
        self.stdout.write(self.style.SUCCESS("              EVALUATION BENCHMARK RESULTS             "))
        self.stdout.write(self.style.SUCCESS("======================================================="))
        self.stdout.write(f" Total Evaluated Queries : {metrics.total_eval_queries}")
        leakage_style = self.style.SUCCESS if metrics.leakage_count == 0 else self.style.ERROR
        self.stdout.write(leakage_style(f" Security Leaks Detected : {metrics.leakage_count} ({metrics.leakage_rate * 100:.2f}% Leakage Rate)"))
        self.stdout.write(f" Faithfulness (Grounded) : {metrics.faithfulness:.4f}")
        self.stdout.write(f" Answer Correctness      : {metrics.answer_correctness:.4f}")
        self.stdout.write(f" Context Recall          : {metrics.context_recall:.4f}")
        self.stdout.write(f" Context Precision       : {metrics.context_precision:.4f}")
        self.stdout.write(f" Answer Relevance        : {metrics.answer_relevance:.4f}")
        self.stdout.write(f" Citation Shield Acc     : {metrics.citation_shield_accuracy * 100:.1f}%")
        self.stdout.write(f" p50 Retrieval Latency   : {metrics.p50_latency_ms:.2f} ms")
        self.stdout.write(f" p95 Retrieval Latency   : {metrics.p95_latency_ms:.2f} ms")
        self.stdout.write(f" Pre-filter Overhead     : {metrics.overhead_ms:.2f} ms")
        self.stdout.write(self.style.SUCCESS("======================================================="))
        self.stdout.write(self.style.SUCCESS(f" Full Report successfully saved to: {output_path}\n"))
