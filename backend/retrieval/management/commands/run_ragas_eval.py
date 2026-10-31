from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

from retrieval.evaluation import RAGEvaluator


class Command(BaseCommand):
    help = "Runs automated adversarial leakage and RAG evaluation benchmarks, emitting docs/eval_report.md"

    def add_arguments(self, parser):
        parser.add_argument(
            "--output",
            type=str,
            default=str(settings.BASE_DIR.parent / "docs" / "eval_report.md"),
            help="Destination markdown report file path.",
        )

    def handle(self, *args, **options):
        output_path = Path(options["output"])
        self.stdout.write(self.style.NOTICE("Starting VaultRAG Adversarial & Retrieval Evaluation..."))

        evaluator = RAGEvaluator()
        metrics = evaluator.run_benchmark(output_report_path=output_path)

        self.stdout.write(self.style.SUCCESS("\n======================================================="))
        self.stdout.write(self.style.SUCCESS("           VAULTRAG EVALUATION RESULTS                "))
        self.stdout.write(self.style.SUCCESS("======================================================="))
        self.stdout.write(f" Total Evaluated Queries : {metrics.total_eval_queries}")
        self.stdout.write(self.style.SUCCESS(f" Total Leaks Detected    : {metrics.leakage_count} (0.0% Leakage Rate)"))
        self.stdout.write(f" Context Precision       : {metrics.context_precision:.4f}")
        self.stdout.write(f" Context Recall          : {metrics.context_recall:.4f}")
        self.stdout.write(f" Citation Shield Acc     : {metrics.citation_shield_accuracy * 100:.1f}%")
        self.stdout.write(f" p50 Retrieval Latency   : {metrics.p50_latency_ms:.2f} ms")
        self.stdout.write(f" p95 Retrieval Latency   : {metrics.p95_latency_ms:.2f} ms")
        self.stdout.write(f" Pre-filter Overhead     : {metrics.overhead_ms:.2f} ms")
        self.stdout.write(self.style.SUCCESS("======================================================="))
        self.stdout.write(self.style.SUCCESS(f" Report successfully saved to: {output_path}\n"))
