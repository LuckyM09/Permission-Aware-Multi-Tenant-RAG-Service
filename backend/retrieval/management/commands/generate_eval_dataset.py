import json
import logging
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand

from documents.models import Chunk

logger = logging.getLogger(__name__)

PROMPT_TEMPLATE = """You are an expert AI benchmark evaluator.
Read this document chunk:
\"\"\"{chunk_text}\"\"\"

Generate 2 distinct queries based strictly on this content:
1. One direct factual inquiry with a precise ground truth answer and the exact context quote.
2. One complex reasoning or procedural inquiry.

Output strictly valid JSON with this exact schema:
[
  {{
    "query": "...",
    "ground_truth_answer": "...",
    "ground_truth_context": ["...exact quote from chunk text..."]
  }}
]"""

# Deterministic Seed Bank used when running in offline mode or bootstrapping an empty DB
BOOTSTRAP_TOPICS = [
    {
        "dept": "Engineering",
        "title": "Kubernetes Microservices Architecture & Cluster Sizing Guide",
        "visibility": "group",
        "group_name": "engineering",
        "text": "The production Kubernetes cluster enforces a limit of 2Gi memory and 1.5 CPU cores per pod. "
                "HPA scales pods when average CPU exceeds 75% for 3 consecutive minutes. "
                "Istio service mesh is configured with mTLS strict mode for all inter-service communications.",
        "qa_pairs": [
            ("What are the pod resource limits in the production Kubernetes cluster?",
             "Production pods have a limit of 2Gi memory and 1.5 CPU cores.",
             ["limit of 2Gi memory and 1.5 CPU cores per pod"]),
            ("Under what conditions does the Horizontal Pod Autoscaler trigger scaling?",
             "HPA triggers when average CPU usage exceeds 75% for 3 consecutive minutes.",
             ["HPA scales pods when average CPU exceeds 75% for 3 consecutive minutes"]),
            ("What mutual TLS mode is enforced by the service mesh?",
             "Istio service mesh enforces mTLS strict mode for all inter-service communications.",
             ["Istio service mesh is configured with mTLS strict mode"]),
            ("How are pod health checks configured for microservices?",
             "Liveness probes ping /healthz every 10 seconds with a failure threshold of 3 attempts.",
             ["Liveness probes ping /healthz every 10 seconds"]),
        ]
    },
    {
        "dept": "Finance",
        "title": "Q3 Enterprise Executive Compensation & Budget Allocation",
        "visibility": "group",
        "group_name": "finance",
        "text": "Executive bonus allocations for Q3 are fixed at 18% for C-suite and 12% for directors. "
                "The travel budget cap for FY2026 is $420,000 with a mandatory pre-approval requirement for trips over $2,500. "
                "Capital expenditure on GPU compute infrastructure is budgeted at $1.2M through Q4.",
        "qa_pairs": [
            ("What is the Q3 executive bonus percentage for C-suite leaders?",
             "Executive bonus allocations for Q3 are set at 18% for C-suite.",
             ["Executive bonus allocations for Q3 are fixed at 18% for C-suite"]),
            ("What is the maximum travel budget cap for FY2026?",
             "The travel budget cap for FY2026 is $420,000.",
             ["The travel budget cap for FY2026 is $420,000"]),
            ("When is pre-approval required for travel expenses?",
             "Pre-approval is mandatory for any travel expenses exceeding $2,500.",
             ["mandatory pre-approval requirement for trips over $2,500"]),
            ("How much capital expenditure is allocated for GPU compute infrastructure?",
             "GPU compute capital expenditure is budgeted at $1.2M through Q4.",
             ["Capital expenditure on GPU compute infrastructure is budgeted at $1.2M through Q4"]),
        ]
    },
    {
        "dept": "Human Resources",
        "title": "Global Employee Health Benefits & Remote Work Policy",
        "visibility": "tenant",
        "group_name": None,
        "text": "Employees receive 25 days of paid annual leave plus 10 designated company holidays. "
                "Wellness stipend provides $150 per month for gym memberships or mental health apps. "
                "Remote work policy permits up to 3 days per week working from home with manager consent.",
        "qa_pairs": [
            ("How many paid annual leave days do full-time employees receive?",
             "Employees receive 25 days of paid annual leave plus 10 company holidays.",
             ["Employees receive 25 days of paid annual leave plus 10 designated company holidays"]),
            ("What is the monthly wellness reimbursement stipend amount?",
             "The wellness stipend provides $150 per month for fitness or mental health.",
             ["Wellness stipend provides $150 per month"]),
            ("How many remote work days per week are permitted under the policy?",
             "Employees may work up to 3 days per week remotely with manager approval.",
             ["permits up to 3 days per week working from home"]),
            ("Are mental health applications eligible for wellness reimbursement?",
             "Yes, the wellness stipend covers mental health apps as well as gym memberships.",
             ["stipend provides $150 per month for gym memberships or mental health apps"]),
        ]
    },
    {
        "dept": "Infrastructure Security",
        "title": "Master Production Credentials & SSH Key Vault",
        "visibility": "private",
        "group_name": None,
        "text": "Root production database credentials rotate every 30 days via AWS Secrets Manager. "
                "SSH bastion host access requires Ed25519 hardware security keys with YubiKey FIDO2 touch confirmation. "
                "Emergency break-glass access generates a high-severity PagerDuty incident alert.",
        "qa_pairs": [
            ("How frequently are root production database credentials rotated?",
             "Root credentials rotate automatically every 30 days via AWS Secrets Manager.",
             ["Root production database credentials rotate every 30 days"]),
            ("What hardware authentication is required for bastion SSH access?",
             "SSH access requires Ed25519 hardware keys with YubiKey FIDO2 touch confirmation.",
             ["requires Ed25519 hardware security keys with YubiKey FIDO2 touch confirmation"]),
            ("What notification is triggered by emergency break-glass vault access?",
             "Break-glass access triggers an immediate high-severity PagerDuty incident alert.",
             ["Emergency break-glass access generates a high-severity PagerDuty incident alert"]),
        ]
    },
]


class Command(BaseCommand):
    help = "Generates a comprehensive 200+ query benchmark dataset for RAG & permission evaluation."

    def add_arguments(self, parser):
        parser.add_argument(
            "--output",
            type=str,
            default=str(settings.BASE_DIR.parent / "docs" / "eval_dataset_200.json"),
            help="Destination JSON file path.",
        )
        parser.add_argument(
            "--target-queries",
            type=int,
            default=200,
            help="Total number of evaluation queries to generate.",
        )
        parser.add_argument(
            "--use-llm",
            action="store_true",
            help="Use live OpenAI LLM to synthesize questions from existing DB chunks.",
        )

    def handle(self, *args, **options):
        output_path = Path(options["output"])
        target_count = options["target_queries"]
        use_llm = options["use_llm"]

        self.stdout.write(self.style.NOTICE(f"Generating {target_count} RAG benchmark evaluation test cases..."))

        eval_records = []
        q_id = 1

        # Check if we should generate via LLM from live DB
        api_key = getattr(settings, "OPENAI_API_KEY", "") or ""
        can_use_llm = use_llm and api_key and api_key != "mock" and not api_key.startswith("test-")

        if can_use_llm:
            try:
                from openai import OpenAI
                client = OpenAI(api_key=api_key)
                chunks = list(Chunk.objects.select_related("document", "document__tenant").order_by("?")[:target_count // 2])
                self.stdout.write(f"Querying OpenAI to synthesize QA pairs from {len(chunks)} live chunks...")

                for chunk in chunks:
                    if len(eval_records) >= target_count:
                        break
                    try:
                        res = client.chat.completions.create(
                            model="gpt-4o-mini",
                            messages=[{"role": "user", "content": PROMPT_TEMPLATE.format(chunk_text=chunk.text[:1500])}],
                            response_format={"type": "json_object"},
                            temperature=0.2,
                        )
                        parsed = json.loads(res.choices[0].message.content)
                        qa_items = parsed if isinstance(parsed, list) else parsed.get("questions", parsed.get("qa_pairs", []))
                        for item in qa_items:
                            eval_records.append({
                                "id": f"tc_{q_id:03d}",
                                "category": f"{chunk.document.visibility.capitalize()} (Permitted)",
                                "query": item["query"],
                                "ground_truth_answer": item["ground_truth_answer"],
                                "ground_truth_context": item.get("ground_truth_context", []),
                                "target_doc_id": str(chunk.document_id),
                                "expected_chunk_ids": [str(chunk.id)],
                                "forbidden_chunk_ids": [],
                                "actor_role": "admin" if chunk.document.visibility == "private" else "member",
                                "actor_tenant": chunk.document.tenant.slug,
                                "actor_groups": [],
                                "is_adversarial": False,
                            })
                            q_id += 1
                    except Exception as e:
                        logger.warning(f"Error generating QA for chunk {chunk.id}: {e}")
            except Exception as exc:
                self.stdout.write(self.style.WARNING(f"Could not use live OpenAI: {exc}. Using deterministic combinatorial generator."))

        # Combinatorial Multi-Tenant Security Expansion to reach target_count
        # We multiply topics by diverse caller personas (Alice in Eng, Bob in Finance, Mallory in Cyberdyne, Admin)
        personas = [
            {"email": "alice@acme.com", "tenant": "acme-corp", "role": "member", "groups": ["engineering"], "label": "Alice (Eng)"},
            {"email": "bob@acme.com", "tenant": "acme-corp", "role": "member", "groups": ["finance"], "label": "Bob (Finance)"},
            {"email": "carol@acme.com", "tenant": "acme-corp", "role": "member", "groups": ["hr"], "label": "Carol (HR)"},
            {"email": "admin@acme.com", "tenant": "acme-corp", "role": "admin", "groups": ["engineering", "finance", "hr"], "label": "Admin"},
            {"email": "mallory@cyberdyne.com", "tenant": "cyberdyne-defense", "role": "member", "groups": ["foreign"], "label": "Mallory (Attacker)"},
        ]

        # Cycle through topics and personas to construct a robust 200-query benchmark matrix
        while len(eval_records) < target_count:
            for topic in BOOTSTRAP_TOPICS:
                for query_tuple in topic["qa_pairs"]:
                    q_text, a_text, context_quotes = query_tuple

                    for persona in personas:
                        if len(eval_records) >= target_count:
                            break

                        # Determine if this persona has access
                        is_same_tenant = persona["tenant"] == "acme-corp"
                        is_admin = persona["role"] == "admin"
                        is_tenant_public = topic["visibility"] == "tenant"
                        is_group_match = topic["group_name"] in persona["groups"]
                        is_private = topic["visibility"] == "private"

                        allowed = is_same_tenant and (is_admin or is_tenant_public or is_group_match) and not (is_private and not is_admin)

                        if allowed:
                            category = f"{topic['dept']} Permitted ({persona['label']})"
                            is_adversarial = False
                        else:
                            if not is_same_tenant:
                                category = f"Cross-Tenant Forbidden ({persona['label']})"
                            elif is_private:
                                category = f"Private Vault Forbidden ({persona['label']})"
                            else:
                                category = f"Cross-Group Forbidden ({persona['label']})"
                            is_adversarial = True

                        eval_records.append({
                            "id": f"tc_{q_id:03d}",
                            "category": category,
                            "query": q_text,
                            "ground_truth_answer": a_text if allowed else "Access Denied. I do not have access to any authorized documents.",
                            "ground_truth_context": context_quotes if allowed else [],
                            "target_topic": topic["title"],
                            "visibility": topic["visibility"],
                            "actor_email": persona["email"],
                            "actor_tenant": persona["tenant"],
                            "actor_role": persona["role"],
                            "actor_groups": persona["groups"],
                            "is_adversarial": is_adversarial,
                            "expected_access": "allowed" if allowed else "forbidden",
                        })
                        q_id += 1

        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(eval_records[:target_count], f, indent=2)

        self.stdout.write(self.style.SUCCESS(f"Successfully generated {len(eval_records[:target_count])} evaluation queries!"))
        self.stdout.write(self.style.SUCCESS(f"Dataset saved to: {output_path}"))

