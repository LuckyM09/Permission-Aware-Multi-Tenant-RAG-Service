"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Shield,
  MessageSquare,
  FileText,
  Search,
  History,
  Lock,
  ArrowRight,
  Database,
  Layers,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  Cpu,
  KeyRound,
  ExternalLink,
  Terminal,
  Activity,
  CheckCircle2,
  XCircle,
  Menu,
  X,
  FileCode2,
  Filter,
  Check,
  Mail,
  Send,
  Calendar,
  Copy,
  Clock,
  Briefcase,
  User,
  Building,
} from "lucide-react";
import { PerspectiveGrid } from "@/components/ui/perspective-grid";
import { MorphingMegaMenu } from "@/components/ui/morphing-mega-menu";
import { FAQ, FAQItem } from "@/components/ui/faq";
import { HamburgerMenu } from "@/components/ui/hamburger-menu";
import { AppFooter } from "@/components/app-footer";

// Brand Logo SVG matching the user's "H • Monoline keyhole" design
function VaultRAGLogo({ className = "h-8" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      <svg
        viewBox="0 0 100 100"
        className="w-8 h-8 shrink-0"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Monoline Outer Circle */}
        <circle
          cx="50"
          cy="50"
          r="40"
          stroke="#0F172A"
          strokeWidth="6"
          strokeLinecap="round"
        />
        {/* Monoline Keyhole in Center */}
        <circle
          cx="50"
          cy="42"
          r="10"
          stroke="#0F172A"
          strokeWidth="6"
        />
        <path
          d="M45 48L42 66H58L55 48"
          stroke="#0F172A"
          strokeWidth="6"
          strokeLinejoin="round"
        />
        {/* Signature Cyan Node at top-right */}
        <circle
          cx="79"
          cy="23"
          r="8"
          fill="#00D2FF"
          stroke="#FAF9F6"
          strokeWidth="2"
        />
      </svg>
      <div className="flex items-baseline font-bold tracking-tight text-xl leading-none">
        <span className="text-[#0F172A]">Vault</span>
        <span className="text-[#0284C7] ml-0.5">RAG</span>
      </div>
    </div>
  );
}

// Hardware-accelerated Scroll Reveal Wrapper
function RevealOnScroll({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      {
        threshold: 0.1,
        rootMargin: "0px 0px -40px 0px",
      }
    );

    const el = ref.current;
    if (el) observer.observe(el);

    return () => {
      if (el) observer.unobserve(el);
    };
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      } ${className}`}
    >
      {children}
    </div>
  );
}

export default function HomePage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  // Authenticated User Session state
  const [sessionData, setSessionData] = useState<{
    authenticated: boolean;
    user?: { email: string; full_name?: string };
    context?: { tenant_id: string; role: string; is_admin: boolean };
    tenants?: Array<{ id: string; name: string; slug: string; role: string; is_current: boolean }>;
  } | null>(null);

  // Interactive Live Persona Simulator State
  const [selectedPersona, setSelectedPersona] = useState<"alice" | "bob" | "carol" | "mallory">("alice");
  const [selectedQueryId, setSelectedQueryId] = useState<"k8s" | "bonus" | "health" | "creds">("k8s");

  // Contact Form State
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactCompany, setContactCompany] = useState("");
  const [contactInquiry, setContactInquiry] = useState("Enterprise Security Architecture");
  const [contactMessage, setContactMessage] = useState("");
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);

  useEffect(() => {
    document.title = "VaultRAG — Enterprise Permission-Aware AI Knowledge Platform";

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    // Check if user is already authenticated
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : { authenticated: false }))
      .then((data) => {
        if (data?.authenticated) {
          setSessionData(data);
          if (data.user?.email) {
            setContactEmail(data.user.email);
          }
          if (data.user?.full_name) {
            setContactName(data.user.full_name);
          }
          const curr = data.tenants?.find((t: any) => t.is_current);
          if (curr?.name) {
            setContactCompany(curr.name);
          }
        }
      })
      .catch(() => {});

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleCopyEmail = () => {
    navigator.clipboard.writeText("contact@vaultrag.internal");
    setEmailCopied(true);
    setTimeout(() => setEmailCopied(false), 2000);
  };

  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [contactError, setContactError] = useState("");
  const [contactHoneypot, setContactHoneypot] = useState("");

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName || !contactEmail || !contactMessage) return;
    setContactSubmitting(true);
    setContactError("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: contactName,
          email: contactEmail,
          company: contactCompany,
          inquiry: contactInquiry,
          message: contactMessage,
          work_phone_ext: contactHoneypot,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setContactSubmitted(true);
      } else {
        setContactError(data.error || "Failed to submit inquiry. Please try again.");
      }
    } catch {
      setContactError("Network error. Please try again or reach out directly.");
    } finally {
      setContactSubmitting(false);
    }
  };

  // Pre-configured simulation queries based on the benchmark dataset
  const queries = {
    k8s: {
      id: "k8s",
      title: "Kubernetes Cluster Architecture",
      prompt: "What are the pod resource limits in the production Kubernetes cluster?",
      dept: "Engineering",
      visibility: "Group (Engineering)",
    },
    bonus: {
      id: "bonus",
      title: "Q3 Executive Compensation",
      prompt: "What is the Q3 executive bonus percentage for C-suite leaders?",
      dept: "Finance",
      visibility: "Group (Finance)",
    },
    health: {
      id: "health",
      title: "Global Employee Health Benefits",
      prompt: "How many paid annual leave days do full-time employees receive?",
      dept: "HR / Company-Wide",
      visibility: "Tenant-Wide",
    },
    creds: {
      id: "creds",
      title: "Master SSH Keys & Root Credentials",
      prompt: "How frequently are root production database credentials rotated in the vault?",
      dept: "Security Admin",
      visibility: "Private (Admin Only)",
    },
  };

  // Persona configurations matching the user's uploaded avatar assets
  const personaProfiles = {
    alice: {
      id: "alice",
      name: "Alice",
      dept: "Engineering",
      tagline: "Engineering group member. Reads runbooks, architecture specs, and microservices repos.",
      avatar: "/personas/alice.png",
      pillBg: "bg-purple-100 text-purple-800 border-purple-200",
      accentColor: "#8B5CF6",
      clearance: "Engineering Group + Tenant-Wide",
      sqlFilter: "tenant_id = 'acme' AND (visibility = 'tenant' OR group_id IN ('eng-team'))",
      responses: {
        k8s: {
          verdict: "PERMITTED",
          statusColor: "text-emerald-700 bg-emerald-50 border-emerald-200",
          docTitle: "Kubernetes Microservices Architecture & Cluster Sizing Guide",
          answer: "The production Kubernetes cluster enforces a limit of 2Gi memory and 1.5 CPU cores per pod. HPA scales pods when average CPU exceeds 75% for 3 consecutive minutes.",
          citation: "[Doc: Kubernetes Microservices Architecture, Chunk: eng_01]",
          leaks: 0,
        },
        bonus: {
          verdict: "ACCESS DENIED",
          statusColor: "text-rose-700 bg-rose-50 border-rose-200",
          docTitle: "Q3 Enterprise Executive Compensation & Budget Allocation",
          answer: "I do not have access to any authorized documents containing information to answer this question.",
          citation: "None (Pruned at SQL Pre-Filter Stage)",
          leaks: 0,
        },
        health: {
          verdict: "PERMITTED",
          statusColor: "text-emerald-700 bg-emerald-50 border-emerald-200",
          docTitle: "Global Employee Health Benefits & Remote Work Policy",
          answer: "Employees receive 25 days of paid annual leave plus 10 designated company holidays. Wellness stipend provides $150 per month for gym memberships or mental health apps.",
          citation: "[Doc: Global Employee Health Benefits, Chunk: hr_01]",
          leaks: 0,
        },
        creds: {
          verdict: "ACCESS DENIED",
          statusColor: "text-rose-700 bg-rose-50 border-rose-200",
          docTitle: "Master Production Credentials & SSH Key Vault",
          answer: "I do not have access to any authorized documents containing information to answer this question.",
          citation: "None (Admin-Private Document)",
          leaks: 0,
        },
      },
    },
    bob: {
      id: "bob",
      name: "Bob",
      dept: "Finance",
      tagline: "Finance group member. Reads budgets, executive compensation, and audit ledgers.",
      avatar: "/personas/bob.png",
      pillBg: "bg-cyan-100 text-cyan-800 border-cyan-200",
      accentColor: "#0284C7",
      clearance: "Finance Group + Tenant-Wide",
      sqlFilter: "tenant_id = 'acme' AND (visibility = 'tenant' OR group_id IN ('finance-team'))",
      responses: {
        k8s: {
          verdict: "ACCESS DENIED",
          statusColor: "text-rose-700 bg-rose-50 border-rose-200",
          docTitle: "Kubernetes Microservices Architecture & Cluster Sizing Guide",
          answer: "I do not have access to any authorized documents containing information to answer this question.",
          citation: "None (Blocked: Requires Engineering Group Membership)",
          leaks: 0,
        },
        bonus: {
          verdict: "PERMITTED",
          statusColor: "text-emerald-700 bg-emerald-50 border-emerald-200",
          docTitle: "Q3 Enterprise Executive Compensation & Budget Allocation",
          answer: "Executive bonus allocations for Q3 are fixed at 18% for C-suite and 12% for directors. Capital expenditure on GPU compute infrastructure is budgeted at $1.2M through Q4.",
          citation: "[Doc: Q3 Executive Compensation, Chunk: fin_01]",
          leaks: 0,
        },
        health: {
          verdict: "PERMITTED",
          statusColor: "text-emerald-700 bg-emerald-50 border-emerald-200",
          docTitle: "Global Employee Health Benefits & Remote Work Policy",
          answer: "Employees receive 25 days of paid annual leave plus 10 designated company holidays. Wellness stipend provides $150 per month for gym memberships or mental health apps.",
          citation: "[Doc: Global Employee Health Benefits, Chunk: hr_01]",
          leaks: 0,
        },
        creds: {
          verdict: "ACCESS DENIED",
          statusColor: "text-rose-700 bg-rose-50 border-rose-200",
          docTitle: "Master Production Credentials & SSH Key Vault",
          answer: "I do not have access to any authorized documents containing information to answer this question.",
          citation: "None (Admin-Private Document)",
          leaks: 0,
        },
      },
    },
    carol: {
      id: "carol",
      name: "Carol",
      dept: "HR",
      tagline: "HR group member. Reads employee policies, wellness benefits, and hiring reviews.",
      avatar: "/personas/carol.png",
      pillBg: "bg-amber-100 text-amber-800 border-amber-200",
      accentColor: "#D97706",
      clearance: "HR Group + Tenant-Wide",
      sqlFilter: "tenant_id = 'acme' AND (visibility = 'tenant' OR group_id IN ('hr-team'))",
      responses: {
        k8s: {
          verdict: "ACCESS DENIED",
          statusColor: "text-rose-700 bg-rose-50 border-rose-200",
          docTitle: "Kubernetes Microservices Architecture & Cluster Sizing Guide",
          answer: "I do not have access to any authorized documents containing information to answer this question.",
          citation: "None (Blocked: Requires Engineering Group Membership)",
          leaks: 0,
        },
        bonus: {
          verdict: "ACCESS DENIED",
          statusColor: "text-rose-700 bg-rose-50 border-rose-200",
          docTitle: "Q3 Enterprise Executive Compensation & Budget Allocation",
          answer: "I do not have access to any authorized documents containing information to answer this question.",
          citation: "None (Blocked: Requires Finance Group Membership)",
          leaks: 0,
        },
        health: {
          verdict: "PERMITTED",
          statusColor: "text-emerald-700 bg-emerald-50 border-emerald-200",
          docTitle: "Global Employee Health Benefits & Remote Work Policy",
          answer: "Employees receive 25 days of paid annual leave plus 10 designated company holidays. Wellness stipend provides $150 per month for gym memberships or mental health apps.",
          citation: "[Doc: Global Employee Health Benefits, Chunk: hr_01]",
          leaks: 0,
        },
        creds: {
          verdict: "ACCESS DENIED",
          statusColor: "text-rose-700 bg-rose-50 border-rose-200",
          docTitle: "Master Production Credentials & SSH Key Vault",
          answer: "I do not have access to any authorized documents containing information to answer this question.",
          citation: "None (Admin-Private Document)",
          leaks: 0,
        },
      },
    },
    mallory: {
      id: "mallory",
      name: "Mallory",
      dept: "Attacker (Foreign Tenant)",
      tagline: "Outside tenant attacker. Probes for cross-tenant leaks, unauthorized docs, and prompt injection.",
      avatar: "/personas/mallory.png",
      pillBg: "bg-rose-100 text-rose-800 border-rose-200",
      accentColor: "#E11D48",
      clearance: "Cyberdyne Tenant Only (Zero Acme Access)",
      sqlFilter: "tenant_id = 'cyberdyne'",
      responses: {
        k8s: {
          verdict: "CROSS-TENANT REFUSAL",
          statusColor: "text-rose-700 bg-rose-50 border-rose-200",
          docTitle: "Kubernetes Microservices Architecture & Cluster Sizing Guide",
          answer: "I do not have access to any authorized documents containing information to answer this question.",
          citation: "None (Blocked: Cross-Tenant Boundary Enforced via SQL)",
          leaks: 0,
        },
        bonus: {
          verdict: "CROSS-TENANT REFUSAL",
          statusColor: "text-rose-700 bg-rose-50 border-rose-200",
          docTitle: "Q3 Enterprise Executive Compensation & Budget Allocation",
          answer: "I do not have access to any authorized documents containing information to answer this question.",
          citation: "None (Blocked: Cross-Tenant Boundary Enforced via SQL)",
          leaks: 0,
        },
        health: {
          verdict: "CROSS-TENANT REFUSAL",
          statusColor: "text-rose-700 bg-rose-50 border-rose-200",
          docTitle: "Global Employee Health Benefits & Remote Work Policy",
          answer: "I do not have access to any authorized documents containing information to answer this question.",
          citation: "None (Blocked: Cross-Tenant Boundary Enforced via SQL)",
          leaks: 0,
        },
        creds: {
          verdict: "CROSS-TENANT REFUSAL",
          statusColor: "text-rose-700 bg-rose-50 border-rose-200",
          docTitle: "Master Production Credentials & SSH Key Vault",
          answer: "I do not have access to any authorized documents containing information to answer this question.",
          citation: "None (Blocked: Cross-Tenant Boundary Enforced via SQL)",
          leaks: 0,
        },
      },
    },
  };

  const activeProfile = personaProfiles[selectedPersona];
  const activeQueryResult = activeProfile.responses[selectedQueryId];
  const currentQueryObj = queries[selectedQueryId];

  const faqItems: FAQItem[] = [
    {
      id: "rls-security",
      question: "How does PostgreSQL 16 FORCE Row-Level Security guarantee zero cross-tenant leakage?",
      category: "Architecture",
      badge: "RLS Kernel",
      answer: (
        <div className="space-y-2 text-xs text-[#52525B] leading-relaxed">
          <p>
            Every database query executed by VaultRAG runs within a strictly scoped session variable (<code className="px-1.5 py-0.5 rounded bg-[#F4F4F0] text-[#0F172A] font-mono">SET LOCAL app.current_tenant_id = &apos;...&apos;</code>). PostgreSQL automatically enforces <strong className="text-[#0F172A]">FORCE ROW LEVEL SECURITY</strong> on all document and chunk tables at the database kernel level.
          </p>
          <p>
            Even if application-level code contains bugs or an attacker attempts prompt injection, the PostgreSQL storage engine directly rejects rows belonging to other tenants before vector distance calculation ever begins.
          </p>
        </div>
      ),
    },
    {
      id: "group-acls",
      question: "How do Group-Restricted ACLs prevent departmental leaks within an organization?",
      category: "Permissions",
      badge: "Department ACLs",
      answer: (
        <div className="space-y-2 text-xs text-[#52525B] leading-relaxed">
          <p>
            Documents tagged with <strong className="text-[#0F172A]">Group Restricted</strong> visibility require the querying user to hold active membership in at least one assigned department (e.g. Clinical Research, Finance, Legal).
          </p>
          <p>
            During retrieval, the user&apos;s verified group memberships are injected into the SQL pre-filter. Chunks outside their authorized departments are pruned with sub-15ms latency, ensuring unauthorized personas (such as James Wilson querying Clinical Research data) never receive restricted context.
          </p>
        </div>
      ),
    },
    {
      id: "citation-firewall",
      question: "How does the Anti-Leak Citation Firewall verify LLM output against authorized chunks?",
      category: "AI Safety",
      badge: "Citation Shield",
      answer: (
        <div className="space-y-2 text-xs text-[#52525B] leading-relaxed">
          <p>
            After the neural generator (NVIDIA Nemotron 3.5) synthesizes an answer, VaultRAG&apos;s Citation Firewall extracts every bracketed citation tag and verifies it against the exact set of chunk IDs authorized for that specific session.
          </p>
          <p>
            Any hallucinated citation or leak attempt from an unverified source is immediately stripped and audited, providing cryptographically verified provenance for every sentence.
          </p>
        </div>
      ),
    },
    {
      id: "member-roles",
      question: "What capabilities do regular organization members have versus Tenant Administrators?",
      category: "RBAC",
      badge: "Least Privilege",
      answer: (
        <div className="space-y-2 text-xs text-[#52525B] leading-relaxed">
          <p>
            VaultRAG enforces strict least-privilege role boundaries:
          </p>
          <ul className="list-disc list-inside space-y-1 pl-1">
            <li><strong className="text-[#0F172A]">Members:</strong> Have clearance exclusively to interact with the Anti-Leak Chat Engine over documents their role and groups authorize. They cannot upload documents, manage memberships, or inspect administrative logs.</li>
            <li><strong className="text-[#0F172A]">Administrators:</strong> Hold full organization oversight, including document ingestion, department group provisioning, Access Explorer simulation, and compliance ledger auditing.</li>
          </ul>
        </div>
      ),
    },
    {
      id: "admin-group-assignment",
      question: "Can an Administrator assign documents to any department or group?",
      category: "Management",
      badge: "Admin Oversight",
      answer: (
        <p className="text-xs text-[#52525B] leading-relaxed">
          Yes. Tenant Administrators can assign uploaded documents to any existing department group in the organization directly from the Knowledge Hub, without requiring the administrator to be personally enrolled as a member of that department.
        </p>
      ),
    },
    {
      id: "audit-compliance",
      question: "How does VaultRAG maintain a tamper-evident compliance audit trail?",
      category: "Compliance",
      badge: "SOC2 / HIPAA",
      answer: (
        <p className="text-xs text-[#52525B] leading-relaxed">
          Every query, retrieval attempt, document ingestion, and permission evaluation is recorded in an append-only PostgreSQL audit table with SHA-256 deduplication hashes, client IP addresses, retrieved chunk IDs, and policy decision metadata for end-to-end regulatory compliance.
        </p>
      ),
    },
  ];

  return (
    <div className="relative min-h-screen bg-[#FAF9F6] text-[#18181B] selection:bg-[#0F172A]/10 selection:text-[#0F172A] font-sans antialiased overflow-x-hidden">
      {/* ------------------------------------------------------------- */}
      {/* 0. FULL-PAGE INTERACTIVE PERSPECTIVE GRID BACKDROP             */}
      {/* ------------------------------------------------------------- */}
      <PerspectiveGrid className="fixed inset-0 z-0 pointer-events-auto" />

      {/* ------------------------------------------------------------- */}
      {/* 1. PAGE-CENTRIC FLOATING ISLAND NAVBAR                         */}
      {/* ------------------------------------------------------------- */}
      <header className="fixed top-3.5 sm:top-5 inset-x-0 z-50 max-w-4xl lg:max-w-5xl mx-auto px-4 transition-all duration-300 pointer-events-auto">
        <div
          className={`w-full rounded-2xl border transition-all duration-300 flex items-center justify-between gap-4 px-4 sm:px-6 py-2.5 sm:py-3 ${
            isScrolled
              ? "bg-white/95 backdrop-blur-md border-[#E6E6E1] shadow-card"
              : "bg-white/85 backdrop-blur-sm border-[#E6E6E1]/70 shadow-xs"
          }`}
        >
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-2 group shrink-0">
            <VaultRAGLogo className="h-7 sm:h-8" />
          </Link>

          {/* Desktop Navigation: Morphing Mega Menu */}
          <nav className="hidden md:flex items-center gap-2">
            <MorphingMegaMenu />
          </nav>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {sessionData?.authenticated ? (
              <div className="flex items-center gap-2">
                <Link
                  href={sessionData?.context?.is_admin ? "/admin" : "/chat"}
                  className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[#E6E6E1] bg-white text-xs text-[#52525B] hover:text-[#0F172A] shadow-xs"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-medium text-[#0F172A] max-w-[130px] truncate">
                    {sessionData.tenants?.find((t) => t.is_current)?.name || "Active Workspace"}
                  </span>
                </Link>
                <Link
                  href={sessionData?.context?.is_admin ? "/admin" : "/chat"}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#0F172A] text-white text-xs sm:text-sm font-semibold hover:bg-[#1E293B] shadow-xs hover:shadow transition-all duration-150 active:scale-[0.98]"
                >
                  <span>{sessionData?.context?.is_admin ? "Go to Workspace" : "Open Chat"}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#00D2FF]" />
                </Link>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="text-xs sm:text-sm font-semibold text-[#52525B] hover:text-[#0F172A] px-2.5 py-1.5 transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  className="inline-flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-2 rounded-xl bg-[#0F172A] text-white text-xs sm:text-sm font-semibold hover:bg-[#1E293B] shadow-xs hover:shadow transition-all duration-150 active:scale-[0.98]"
                >
                  <span>Register</span>
                  <ArrowRight className="w-3.5 h-3.5 text-[#00D2FF]" />
                </Link>
              </div>
            )}
            <div className="md:hidden flex items-center">
              <HamburgerMenu
                isOpen={mobileMenuOpen}
                onChange={setMobileMenuOpen}
                size={20}
                color="#0F172A"
                className="p-1 rounded-xl border border-[#E6E6E1] bg-white hover:bg-[#F4F4F0] text-[#0F172A]"
              />
            </div>
          </div>
        </div>

        {/* Mobile dropdown */}
        {mobileMenuOpen && (
          <div className="mt-2 rounded-2xl border border-[#E6E6E1] bg-white/95 backdrop-blur-md p-4 space-y-3 shadow-card md:hidden">
            <a
              href="#pipeline"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-medium text-[#4B5563] py-1"
            >
              Security Pipeline
            </a>
            <a
              href="#simulator"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-medium text-[#4B5563] py-1"
            >
              Live Personas
            </a>
            <a
              href="#benchmarks"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-medium text-[#4B5563] py-1"
            >
              200-Query Benchmark
            </a>
            <a
              href="#architecture"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-medium text-[#4B5563] py-1"
            >
              Architecture
            </a>
            <a
              href="#contact"
              onClick={() => setMobileMenuOpen(false)}
              className="block text-sm font-medium text-[#0F172A] font-semibold py-1"
            >
              Contact
            </a>
            <div className="pt-2 border-t border-[#E6E6E1] flex flex-col gap-2">
              <Link
                href="/register"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center py-2.5 rounded-lg bg-[#0F172A] text-white text-xs font-semibold"
              >
                Register Organization
              </Link>
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full text-center py-2 rounded-lg border border-[#E6E6E1] bg-white text-xs font-semibold text-[#0F172A]"
              >
                Sign In
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ------------------------------------------------------------- */}
      {/* MAIN CONTENT WRAPPER                                         */}
      {/* ------------------------------------------------------------- */}
      <div className="relative z-10 pointer-events-none [&_a]:pointer-events-auto [&_button]:pointer-events-auto [&_input]:pointer-events-auto [&_select]:pointer-events-auto [&_textarea]:pointer-events-auto">
        {/* 2. HERO VIEWPORT (EDITORIAL CRAFT & VALUE PROPOSITION)        */}
        <section className="relative overflow-hidden pt-28 pb-16 md:pt-36 md:pb-24 px-4 sm:px-6">
          <div className="max-w-5xl mx-auto text-center">
          <RevealOnScroll delay={0}>
            <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-[#0F172A] text-balance mb-6 leading-[1.08]">
              The enterprise AI assistant your security team won&apos;t block.
            </h1>
          </RevealOnScroll>

          <RevealOnScroll delay={100}>
            <p className="max-w-3xl mx-auto text-lg sm:text-xl text-[#52525B] leading-relaxed text-balance mb-10">
              VaultRAG enforces PostgreSQL row-level security pre-filtering, cross-encoder reranking, and citation firewalling before vector similarity search. Deliver sub-15ms document intelligence with zero data leaks across tenants or departments.
            </p>
          </RevealOnScroll>

          <RevealOnScroll delay={150}>
            {sessionData?.authenticated ? (
              <div className="space-y-4 mb-16">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>
                    Authenticated as <strong>{sessionData.user?.email}</strong> ({sessionData.tenants?.find((t) => t.is_current)?.name || "Active Workspace"})
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4">
                  {sessionData?.context?.is_admin ? (
                    <>
                      <Link
                        href="/admin"
                        className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[#0F172A] text-white text-base font-semibold hover:bg-[#1E293B] shadow-md hover:shadow-lg transition-all duration-150 active:scale-[0.98]"
                      >
                        <span>Open Admin Command Center</span>
                        <ArrowRight className="w-4 h-4 text-[#00D2FF]" />
                      </Link>
                      <Link
                        href="/chat"
                        className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white border border-[#E6E6E1] text-[#0F172A] text-base font-semibold hover:bg-[#F4F4F0] shadow-xs transition-all duration-150 active:scale-[0.98]"
                      >
                        <span>Launch Anti-Leak Chat</span>
                      </Link>
                      <Link
                        href="/documents"
                        className="inline-flex items-center gap-1.5 px-5 py-3.5 rounded-xl text-base font-semibold text-[#52525B] hover:text-[#0F172A] hover:bg-[#F4F4F0] transition-colors"
                      >
                        <span>Knowledge Hub →</span>
                      </Link>
                    </>
                  ) : (
                    <Link
                      href="/chat"
                      className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[#0F172A] text-white text-base font-semibold hover:bg-[#1E293B] shadow-md hover:shadow-lg transition-all duration-150 active:scale-[0.98]"
                    >
                      <span>Launch Anti-Leak Chat</span>
                      <ArrowRight className="w-4 h-4 text-[#00D2FF]" />
                    </Link>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 mb-16">
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[#0F172A] text-white text-base font-semibold hover:bg-[#1E293B] shadow-md hover:shadow-lg transition-all duration-150 active:scale-[0.98]"
                >
                  <span>Register Organization</span>
                  <ArrowRight className="w-4 h-4 text-[#00D2FF]" />
                </Link>
                <a
                  href="#simulator"
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white border border-[#E6E6E1] text-[#0F172A] text-base font-semibold hover:bg-[#F4F4F0] shadow-xs transition-all duration-150 active:scale-[0.98]"
                >
                  <span>Live Security Simulator</span>
                </a>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 px-5 py-3.5 rounded-xl text-base font-semibold text-[#52525B] hover:text-[#0F172A] hover:bg-[#F4F4F0] transition-colors"
                >
                  <span>Sign In →</span>
                </Link>
              </div>
            )}
          </RevealOnScroll>

          {/* ------------------------------------------------------------- */}
          {/* FLOATING PRODUCT SHOWCASE STAGE (UXFOLIO FRAMED MOCKUP)      */}
          {/* ------------------------------------------------------------- */}
          <RevealOnScroll delay={200}>
            <div className="relative mx-auto max-w-4xl text-left">
              <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-2xl overflow-hidden transition-all duration-300 hover:shadow-[0_20px_50px_rgba(0,0,0,0.08)]">
                {/* Window Header */}
                <div className="h-10 bg-[#F8FAFC] border-b border-[#E2E8F0] px-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-[#EF4444]/80" />
                    <div className="w-3 h-3 rounded-full bg-[#F59E0B]/80" />
                    <div className="w-3 h-3 rounded-full bg-[#10B981]/80" />
                  </div>
                  <div className="px-4 py-1 rounded bg-white border border-[#E2E8F0] text-[11px] font-mono text-[#64748B] flex items-center gap-2">
                    <Lock className="w-3 h-3 text-[#10B981]" />
                    <span>vaultrag.internal/chat?tenant=acme-corp</span>
                  </div>
                  <div className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-semibold">
                    RLS ACTIVE
                  </div>
                </div>

                {/* Stage Body: Side-by-side comparison */}
                <div className="p-6 sm:p-8 bg-white grid grid-cols-1 md:grid-cols-2 gap-6 divide-y md:divide-y-0 md:divide-x divide-[#E2E8F0]">
                  {/* Side A: Alice (Engineering) Query */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full overflow-hidden border border-[#E2E8F0] bg-purple-50 shrink-0">
                          <Image
                            src="/personas/alice.png"
                            alt="Alice"
                            width={36}
                            height={36}
                            className="object-cover"
                          />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-[#0F172A]">Alice (Engineering)</div>
                          <div className="text-xs text-[#64748B]">Clearance: Engineering Group</div>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                        PERMITTED
                      </span>
                    </div>

                    <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-medium text-[#1E293B]">
                      &ldquo;What are the pod resource limits in the production Kubernetes cluster?&rdquo;
                    </div>

                    <div className="p-3.5 rounded-lg bg-emerald-50/60 border border-emerald-200/80 text-xs text-[#064E3B] space-y-2">
                      <p className="leading-relaxed">
                        &ldquo;Production pods enforce a limit of 2Gi memory and 1.5 CPU cores per pod. HPA scales when CPU exceeds 75% for 3 consecutive minutes.&rdquo;
                      </p>
                      <div className="flex items-center gap-1.5 text-[10px] font-mono font-medium text-emerald-800">
                        <FileText className="w-3 h-3 shrink-0" />
                        <span>[Doc: Kubernetes Microservices Architecture]</span>
                      </div>
                    </div>
                  </div>

                  {/* Side B: Bob (Finance) Asking Same Query */}
                  <div className="space-y-4 pt-6 md:pt-0 md:pl-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full overflow-hidden border border-[#E2E8F0] bg-cyan-50 shrink-0">
                          <Image
                            src="/personas/bob.png"
                            alt="Bob"
                            width={36}
                            height={36}
                            className="object-cover"
                          />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-[#0F172A]">Bob (Finance)</div>
                          <div className="text-xs text-[#64748B]">Clearance: Finance Group Only</div>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-bold">
                        ACCESS DENIED
                      </span>
                    </div>

                    <div className="p-3 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-xs font-medium text-[#1E293B]">
                      &ldquo;What are the pod resource limits in the production Kubernetes cluster?&rdquo;
                    </div>

                    <div className="p-3.5 rounded-lg bg-rose-50/60 border border-rose-200/80 text-xs text-[#881337] space-y-2">
                      <p className="leading-relaxed font-medium">
                        &ldquo;I do not have access to any authorized documents containing information to answer this question.&rdquo;
                      </p>
                      <div className="flex items-center gap-1.5 text-[10px] font-mono text-rose-800">
                        <Shield className="w-3 h-3 shrink-0 text-rose-600" />
                        <span>Zero Chunks Leaked • Filtered by SQL Pre-Filter</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </RevealOnScroll>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 3. AUTHORITY & 200-QUERY BENCHMARK TELEMETRY TICKER           */}
      {/* ------------------------------------------------------------- */}
      <section id="benchmarks" className="py-12 bg-white/70 backdrop-blur-xs border-y border-[#E6E6E1]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <RevealOnScroll delay={0}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center divide-x-0 md:divide-x divide-[#E6E6E1]">
              <div className="px-4">
                <div className="text-3xl sm:text-4xl font-extrabold text-[#0F172A] tracking-tight font-mono">
                  0.00%
                </div>
                <div className="text-xs font-semibold text-[#52525B] uppercase tracking-wider mt-1">
                  Data Leakage Rate
                </div>
                <div className="text-[11px] text-[#71717A] mt-0.5">
                  200 / 200 Queries Isolated
                </div>
              </div>

              <div className="px-4">
                <div className="text-3xl sm:text-4xl font-extrabold text-[#0F172A] tracking-tight font-mono">
                  13.24 ms
                </div>
                <div className="text-xs font-semibold text-[#52525B] uppercase tracking-wider mt-1">
                  Median Retrieval (p50)
                </div>
                <div className="text-[11px] text-[#71717A] mt-0.5">
                  Target: &lt; 50 ms SLA
                </div>
              </div>

              <div className="px-4">
                <div className="text-3xl sm:text-4xl font-extrabold text-[#0F172A] tracking-tight font-mono">
                  100.0%
                </div>
                <div className="text-xs font-semibold text-[#52525B] uppercase tracking-wider mt-1">
                  Citation Shield Accuracy
                </div>
                <div className="text-[11px] text-[#71717A] mt-0.5">
                  Zero Citation Hallucinations
                </div>
              </div>

              <div className="px-4">
                <div className="text-3xl sm:text-4xl font-extrabold text-[#0F172A] tracking-tight font-mono">
                  97.71%
                </div>
                <div className="text-xs font-semibold text-[#52525B] uppercase tracking-wider mt-1">
                  Context Faithfulness
                </div>
                <div className="text-[11px] text-[#71717A] mt-0.5">
                  LLM-as-a-Judge Scored
                </div>
              </div>
            </div>
          </RevealOnScroll>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 4. THE 3-STEP SECURITY PIPELINE (SCROLL-REVEALED CARDS)       */}
      {/* ------------------------------------------------------------- */}
      <section id="pipeline" className="py-24 sm:py-32 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <RevealOnScroll delay={0}>
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0F172A] tracking-tight mb-4">
                How VaultRAG guarantees zero leakage across teams.
              </h2>
              <p className="text-[#52525B] text-lg leading-relaxed">
                Most RAG architectures leak unauthorized documents because they perform vector similarity first and filter in application memory later. VaultRAG solves this at the database engine level.
              </p>
            </div>
          </RevealOnScroll>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <RevealOnScroll delay={100}>
              <div className="rounded-2xl border border-[#E6E6E1] bg-white p-8 shadow-xs hover:shadow-md transition-shadow h-full flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-700 mb-6">
                    <Database className="w-6 h-6" />
                  </div>
                  <div className="text-xs font-bold text-purple-700 uppercase tracking-wider font-mono mb-2">
                    Step 1 • Ingest & Partition
                  </div>
                  <h3 className="text-xl font-bold text-[#0F172A] mb-3">
                    Granular ACL Tagging
                  </h3>
                  <p className="text-sm text-[#52525B] leading-relaxed mb-4">
                    During document parsing, every chunk is sealed at the PostgreSQL layer with Tenant ID, Document Visibility (Tenant, Group, Private), and active Group Memberships.
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-[#FAF9F6] border border-[#E6E6E1] font-mono text-[11px] text-[#64748B]">
                  Chunk.visibility = &apos;group&apos;<br />
                  DocumentPermission.group = &apos;engineering&apos;
                </div>
              </div>
            </RevealOnScroll>

            {/* Step 2 */}
            <RevealOnScroll delay={200}>
              <div className="rounded-2xl border border-[#E6E6E1] bg-white p-8 shadow-xs hover:shadow-md transition-shadow h-full flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-cyan-50 border border-cyan-100 flex items-center justify-center text-cyan-700 mb-6">
                    <Filter className="w-6 h-6" />
                  </div>
                  <div className="text-xs font-bold text-cyan-700 uppercase tracking-wider font-mono mb-2">
                    Step 2 • Pre-Filter Barrier
                  </div>
                  <h3 className="text-xl font-bold text-[#0F172A] mb-3">
                    SQL Filter Before Vectors
                  </h3>
                  <p className="text-sm text-[#52525B] leading-relaxed mb-4">
                    Before vector embeddings or cosine distances are evaluated, PostgreSQL filters out all unauthorized rows using indexed SQL queries. Chunks outside the caller&apos;s scope never enter memory.
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-[#FAF9F6] border border-[#E6E6E1] font-mono text-[11px] text-[#64748B]">
                  WHERE tenant_id = :id<br />
                  AND (group_id IN (:caller_groups))
                </div>
              </div>
            </RevealOnScroll>

            {/* Step 3 */}
            <RevealOnScroll delay={300}>
              <div className="rounded-2xl border border-[#E6E6E1] bg-white p-8 shadow-xs hover:shadow-md transition-shadow h-full flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-700 mb-6">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div className="text-xs font-bold text-emerald-700 uppercase tracking-wider font-mono mb-2">
                    Step 3 • Anti-Leak Shield
                  </div>
                  <h3 className="text-xl font-bold text-[#0F172A] mb-3">
                    Citation & LLM Firewall
                  </h3>
                  <p className="text-sm text-[#52525B] leading-relaxed mb-4">
                    The synthesized LLM response passes through the AntiLeakShield parser. Any hallucinated, ungrounded, or unpermitted document citations are stripped before streaming to the client.
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-[#FAF9F6] border border-[#E6E6E1] font-mono text-[11px] text-[#64748B]">
                  AntiLeakShield.verify_citations()<br />
                  Shield Accuracy: 100.0%
                </div>
              </div>
            </RevealOnScroll>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 5. INTERACTIVE LIVE PERSONA SIMULATOR (USER'S REAL AVATARS)   */}
      {/* ------------------------------------------------------------- */}
      <section id="simulator" className="py-24 sm:py-32 px-4 sm:px-6 bg-[#F4F4F0]/80 backdrop-blur-xs border-y border-[#E6E6E1]">
        <div className="max-w-6xl mx-auto">
          <RevealOnScroll delay={0}>
            <div className="text-center max-w-3xl mx-auto mb-14">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0F172A] tracking-tight mb-4">
                Interactive Persona Simulator
              </h2>
              <p className="text-[#52525B] text-lg leading-relaxed">
                Test how VaultRAG dynamically enforces security boundaries in real time. Select any team persona and evaluate different confidential queries.
              </p>
            </div>
          </RevealOnScroll>

          {/* Persona Selection Tabs (with real avatars) */}
          <RevealOnScroll delay={100}>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              {Object.values(personaProfiles).map((p) => {
                const isSelected = selectedPersona === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPersona(p.id as any)}
                    className={`p-4 rounded-xl border text-left transition-all duration-150 flex flex-col items-center sm:items-start text-center sm:text-left ${
                      isSelected
                        ? "bg-white border-[#0F172A] shadow-md ring-2 ring-[#0F172A]/10 scale-[1.02]"
                        : "bg-white/70 border-[#E6E6E1] hover:bg-white hover:border-[#D4D4CE] shadow-xs"
                    }`}
                  >
                    <div className="w-14 h-14 rounded-full overflow-hidden border border-[#E6E6E1] bg-white mb-3 shadow-xs">
                      <Image
                        src={p.avatar}
                        alt={p.name}
                        width={56}
                        height={56}
                        className="object-cover"
                      />
                    </div>
                    <div className="text-base font-bold text-[#0F172A]">{p.name}</div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border mt-1 ${p.pillBg}`}>
                      {p.dept}
                    </span>
                  </button>
                );
              })}
            </div>
          </RevealOnScroll>

          {/* Simulator Console Container */}
          <RevealOnScroll delay={150}>
            <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-xl overflow-hidden">
              {/* Console Toolbar */}
              <div className="bg-[#FAF9F6] border-b border-[#E2E8F0] p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full overflow-hidden border border-[#E2E8F0] shrink-0 bg-white">
                    <Image
                      src={activeProfile.avatar}
                      alt={activeProfile.name}
                      width={40}
                      height={40}
                      className="object-cover"
                    />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                      <span>{activeProfile.name}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.2 rounded border ${activeProfile.pillBg}`}>
                        {activeProfile.dept}
                      </span>
                    </div>
                    <div className="text-xs text-[#64748B] mt-0.5">
                      Clearance: <span className="font-medium text-[#18181B]">{activeProfile.clearance}</span>
                    </div>
                  </div>
                </div>

                {/* Active SQL Pre-Filter Badge */}
                <div className="px-3 py-1.5 rounded-lg bg-white border border-[#E2E8F0] font-mono text-[11px] text-[#64748B] flex items-center gap-2">
                  <Filter className="w-3.5 h-3.5 text-[#0284C7]" />
                  <span className="text-[#0F172A] font-semibold">SQL Pre-Filter:</span>
                  <span className="truncate max-w-xs">{activeProfile.sqlFilter}</span>
                </div>
              </div>

              {/* Test Query Pills */}
              <div className="p-4 sm:p-6 border-b border-[#E2E8F0] bg-white">
                <div className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-3">
                  Select an enterprise query to evaluate:
                </div>
                <div className="flex flex-wrap gap-2.5">
                  {Object.values(queries).map((q) => {
                    const isQuerySelected = selectedQueryId === q.id;
                    return (
                      <button
                        key={q.id}
                        onClick={() => setSelectedQueryId(q.id as any)}
                        className={`px-3.5 py-2 rounded-lg text-xs font-medium border transition-all ${
                          isQuerySelected
                            ? "bg-[#0F172A] text-white border-[#0F172A] shadow-xs"
                            : "bg-[#F8FAFC] text-[#334155] border-[#E2E8F0] hover:bg-[#F1F5F9]"
                        }`}
                      >
                        {q.title}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Query & Result Execution Area */}
              <div className="p-6 sm:p-8 space-y-6">
                {/* Query Card */}
                <div>
                  <div className="text-xs font-mono text-[#64748B] mb-1.5 flex items-center justify-between">
                    <span>EVALUATED PROMPT:</span>
                    <span className="text-[11px] text-[#71717A]">Target Scope: {currentQueryObj.visibility}</span>
                  </div>
                  <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-sm font-semibold text-[#0F172A]">
                    &ldquo;{currentQueryObj.prompt}&rdquo;
                  </div>
                </div>

                {/* Security Verdict Banner */}
                <div className="flex items-center justify-between p-4 rounded-xl border bg-white border-[#E2E8F0]">
                  <div className="flex items-center gap-3">
                    {activeQueryResult.verdict.includes("PERMITTED") ? (
                      <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-5 h-5" />
                      </div>
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                        <XCircle className="w-5 h-5" />
                      </div>
                    )}
                    <div>
                      <div className="text-sm font-bold text-[#0F172A] flex items-center gap-2">
                        <span>Access Verdict:</span>
                        <span className={`px-2.5 py-0.5 rounded text-xs font-bold border ${activeQueryResult.statusColor}`}>
                          {activeQueryResult.verdict}
                        </span>
                      </div>
                      <div className="text-xs text-[#64748B] mt-0.5">
                        Target File: <span className="font-mono text-[#18181B]">{activeQueryResult.docTitle}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right hidden sm:block">
                    <div className="text-xs font-bold text-emerald-700 font-mono">0 LEAKS DETECTED</div>
                    <div className="text-[11px] text-[#71717A]">Strict Invariant Passed</div>
                  </div>
                </div>

                {/* Synthesized Output Card */}
                <div>
                  <div className="text-xs font-mono text-[#64748B] mb-1.5 flex items-center justify-between">
                    <span>SYNTHESIZED AI RESPONSE:</span>
                    <span className="text-[11px] text-[#71717A]">Processed in 13.2 ms</span>
                  </div>
                  <div className="p-4 sm:p-5 rounded-xl bg-[#FAF9F6] border border-[#E2E8F0] text-sm leading-relaxed text-[#18181B] space-y-3">
                    <p className="font-medium">
                      &ldquo;{activeQueryResult.answer}&rdquo;
                    </p>
                    <div className="pt-2 border-t border-[#E6E6E1] flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-[#64748B]">
                      <span>Verified Citation: {activeQueryResult.citation}</span>
                      <span className="text-[11px] text-emerald-700 font-bold">Citation Shield: VERIFIED</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </RevealOnScroll>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 6. ARCHITECTURE & SECURITY INVARIANTS (UNIFIED LIGHT PALETTE) */}
      {/* ------------------------------------------------------------- */}
      <section id="architecture" className="py-24 sm:py-32 px-4 sm:px-6 bg-[#FAF9F6]/80 backdrop-blur-xs border-b border-[#E6E6E1]">
        <div className="max-w-6xl mx-auto">
          <RevealOnScroll delay={0}>
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0F172A] tracking-tight mb-4">
                Defense-in-depth architecture.
              </h2>
              <p className="text-[#52525B] text-lg leading-relaxed">
                Engineered with formal security invariants at the database, embedding, and streaming layers.
              </p>
            </div>
          </RevealOnScroll>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Bento Card 1 */}
            <RevealOnScroll delay={100}>
              <div className="p-8 rounded-2xl bg-white border border-[#E6E6E1] shadow-xs hover:shadow-md transition-all space-y-4 h-full flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center mb-4">
                    <Lock className="w-5 h-5" />
                  </div>
                  <h3 className="text-xl font-bold text-[#0F172A]">
                    PostgreSQL FORCE Row-Level Security
                  </h3>
                  <p className="text-sm text-[#52525B] leading-relaxed mt-2">
                    Even if application code fails or query logic is manipulated, PostgreSQL executes kernel-level row filtering on the <code className="text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded font-mono text-xs">documents_chunk</code> table. Cross-tenant reads are physically blocked at the storage layer.
                  </p>
                </div>
                <div className="font-mono text-xs text-[#0F172A] bg-[#F8FAFC] p-3 rounded-lg border border-[#E2E8F0]">
                  ALTER TABLE documents_chunk FORCE ROW LEVEL SECURITY;
                </div>
              </div>
            </RevealOnScroll>

            {/* Bento Card 2 */}
            <RevealOnScroll delay={200}>
              <div className="p-8 rounded-2xl bg-white border border-[#E6E6E1] shadow-xs hover:shadow-md transition-all space-y-4 h-full flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center mb-4">
                    <Cpu className="w-5 h-5" />
                  </div>
                  <h3 className="text-xl font-bold text-[#0F172A]">
                    Sub-15ms Pre-Filter Overhead
                  </h3>
                  <p className="text-sm text-[#52525B] leading-relaxed mt-2">
                    SQL pre-filtering restricts vector distance calculations to pre-qualified row candidates. B-Tree indices on <code className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-mono text-xs">tenant_id</code> and <code className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-mono text-xs">visibility</code> ensure zero latency degradation.
                  </p>
                </div>
                <div className="font-mono text-xs text-[#0F172A] bg-[#F8FAFC] p-3 rounded-lg border border-[#E2E8F0]">
                  Measured Overhead: 8.16 ms (Target: &lt; 15 ms)
                </div>
              </div>
            </RevealOnScroll>

            {/* Bento Card 3 */}
            <RevealOnScroll delay={150}>
              <div className="p-8 rounded-2xl bg-white border border-[#E6E6E1] shadow-xs hover:shadow-md transition-all space-y-4 h-full flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-lg bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center mb-4">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <h3 className="text-xl font-bold text-[#0F172A]">
                    Zero-Enumeration Defense
                  </h3>
                  <p className="text-sm text-[#52525B] leading-relaxed mt-2">
                    Unauthorized resource probing returns <code className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-mono text-xs">HTTP 404 Not Found</code> rather than <code className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-mono text-xs">403 Forbidden</code>. Malicious actors cannot discover whether confidential files exist.
                  </p>
                </div>
                <div className="font-mono text-xs text-[#0F172A] bg-[#F8FAFC] p-3 rounded-lg border border-[#E2E8F0]">
                  Invariant Rule #7: Mask Existence on Access Denial
                </div>
              </div>
            </RevealOnScroll>

            {/* Bento Card 4 */}
            <RevealOnScroll delay={250}>
              <div className="p-8 rounded-2xl bg-white border border-[#E6E6E1] shadow-xs hover:shadow-md transition-all space-y-4 h-full flex flex-col justify-between">
                <div>
                  <div className="w-10 h-10 rounded-lg bg-purple-50 border border-purple-100 text-purple-600 flex items-center justify-center mb-4">
                    <History className="w-5 h-5" />
                  </div>
                  <h3 className="text-xl font-bold text-[#0F172A]">
                    Tamper-Evident Audit Ledger
                  </h3>
                  <p className="text-sm text-[#52525B] leading-relaxed mt-2">
                    Every document access, permission grant, and retrieval attempt is logged to an append-only audit trail with tenant isolation, client IP tracking, and query vector telemetry.
                  </p>
                </div>
                <div className="font-mono text-xs text-[#0F172A] bg-[#F8FAFC] p-3 rounded-lg border border-[#E2E8F0]">
                  Audit Trail: 100% Query Telemetry Recorded
                </div>
              </div>
            </RevealOnScroll>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 7. CONTACT & ENTERPRISE ADVISORY SECTION (REQUESTED BY USER)   */}
      {/* ------------------------------------------------------------- */}
      <section id="contact" className="py-24 sm:py-32 px-4 sm:px-6 bg-[#F4F4F0]/80 backdrop-blur-xs border-b border-[#E6E6E1]">
        <div className="max-w-6xl mx-auto">
          <RevealOnScroll delay={0}>
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0F172A] tracking-tight mb-4">
                Let&apos;s connect & discuss your architecture.
              </h2>
              <p className="text-[#52525B] text-lg leading-relaxed">
                Whether you&apos;re looking to deploy zero-leakage RAG in your enterprise, need a custom technical walkthrough, or want to discuss engineering collaboration.
              </p>
            </div>
          </RevealOnScroll>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left: Interactive Contact Form */}
            <div className="lg:col-span-7">
              <RevealOnScroll delay={100}>
                <div className="p-8 sm:p-10 rounded-2xl bg-white border border-[#E6E6E1] shadow-md">
                  {contactSubmitted ? (
                    <div className="py-8 text-center space-y-4">
                      <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                        <CheckCircle2 className="w-8 h-8" />
                      </div>
                      <h3 className="text-2xl font-bold text-[#0F172A]">
                        Inquiry Received!
                      </h3>
                      <p className="text-sm text-[#52525B] max-w-md mx-auto leading-relaxed">
                        Thank you, <span className="font-semibold text-[#0F172A]">{contactName}</span>. Your inquiry has been safely received and stored. Our team will review your requirements and follow up via email at <span className="font-semibold text-[#0F172A]">{contactEmail}</span>.
                      </p>
                      <button
                        onClick={() => {
                          setContactSubmitted(false);
                          setContactMessage("");
                        }}
                        className="mt-4 px-5 py-2.5 rounded-lg bg-[#FAF9F6] border border-[#E6E6E1] text-xs font-semibold text-[#0F172A] hover:bg-[#F4F4F0] transition-colors cursor-pointer"
                      >
                        Send Another Note
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleContactSubmit} className="space-y-5">
                      {/* Honeypot field for anti-bot trap */}
                      <div className="hidden" aria-hidden="true">
                        <input
                          type="text"
                          name="work_phone_ext"
                          tabIndex={-1}
                          autoComplete="off"
                          value={contactHoneypot}
                          onChange={(e) => setContactHoneypot(e.target.value)}
                        />
                      </div>
                      {contactError && (
                        <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
                          {contactError}
                        </div>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-[#0F172A] uppercase tracking-wider mb-2">
                            Your Name *
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              required
                              placeholder="e.g. Alex Mercer"
                              value={contactName}
                              onChange={(e) => setContactName(e.target.value)}
                              className="w-full px-3.5 py-2.5 rounded-lg border border-[#E2E8F0] bg-[#FAF9F6] text-sm text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#0F172A] focus:bg-white transition-all"
                            />
                            <User className="w-4 h-4 text-[#94A3B8] absolute right-3 top-3 pointer-events-none" />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-[#0F172A] uppercase tracking-wider mb-2">
                            Work Email *
                          </label>
                          <div className="relative">
                            <input
                              type="email"
                              required
                              placeholder="alex@enterprise.com"
                              value={contactEmail}
                              onChange={(e) => setContactEmail(e.target.value)}
                              className="w-full px-3.5 py-2.5 rounded-lg border border-[#E2E8F0] bg-[#FAF9F6] text-sm text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#0F172A] focus:bg-white transition-all"
                            />
                            <Mail className="w-4 h-4 text-[#94A3B8] absolute right-3 top-3 pointer-events-none" />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-[#0F172A] uppercase tracking-wider mb-2">
                            Company / Organization
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              placeholder="e.g. Acme Corp"
                              value={contactCompany}
                              onChange={(e) => setContactCompany(e.target.value)}
                              className="w-full px-3.5 py-2.5 rounded-lg border border-[#E2E8F0] bg-[#FAF9F6] text-sm text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#0F172A] focus:bg-white transition-all"
                            />
                            <Building className="w-4 h-4 text-[#94A3B8] absolute right-3 top-3 pointer-events-none" />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-[#0F172A] uppercase tracking-wider mb-2">
                            Inquiry Type
                          </label>
                          <select
                            value={contactInquiry}
                            onChange={(e) => setContactInquiry(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-lg border border-[#E2E8F0] bg-[#FAF9F6] text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0F172A] focus:bg-white transition-all"
                          >
                            <option value="Enterprise Security Architecture">Enterprise Security Architecture</option>
                            <option value="Live Walkthrough / Demo Request">Live Walkthrough / Demo Request</option>
                            <option value="Pilot Deployment Inquiry">Pilot Deployment Inquiry</option>
                            <option value="Career / Collaboration Opportunity">Career / Collaboration Opportunity</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#0F172A] uppercase tracking-wider mb-2">
                          Project Details or Message *
                        </label>
                        <textarea
                          rows={4}
                          required
                          placeholder="Tell me about your use case, security constraints, or what you'd like to discuss..."
                          value={contactMessage}
                          onChange={(e) => setContactMessage(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-lg border border-[#E2E8F0] bg-[#FAF9F6] text-sm text-[#0F172A] placeholder-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#0F172A] focus:bg-white transition-all leading-relaxed"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={contactSubmitting}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl bg-[#0F172A] text-white text-sm font-semibold hover:bg-[#1E293B] shadow-sm hover:shadow transition-all duration-150 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                      >
                        <Send className="w-4 h-4 text-[#00D2FF]" />
                        <span>{contactSubmitting ? "Submitting Inquiry..." : "Send Direct Inquiry"}</span>
                      </button>
                    </form>
                  )}
                </div>
              </RevealOnScroll>
            </div>

            {/* Right: Direct Contact Cards & Availability */}
            <div className="lg:col-span-5 space-y-4">
              <RevealOnScroll delay={150}>
                {/* Availability Badge */}
                <div className="p-6 rounded-2xl bg-white border border-[#E6E6E1] shadow-xs space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider font-mono">
                      Current Availability
                    </span>
                  </div>
                  <div className="text-base font-bold text-[#0F172A]">
                    Open for Enterprise Pilots &amp; AI Security Advisory
                  </div>
                  <p className="text-xs text-[#52525B] leading-relaxed">
                    Available for enterprise zero-trust RAG implementations, PostgreSQL pgvector deployments, and high-assurance architecture reviews.
                  </p>
                </div>
              </RevealOnScroll>

              <RevealOnScroll delay={200}>
                {/* Direct Email Card */}
                <div className="p-6 rounded-2xl bg-white border border-[#E6E6E1] shadow-xs space-y-3">
                  <div className="text-xs font-bold text-[#64748B] uppercase tracking-wider font-mono">
                    Direct Email Channel
                  </div>
                  <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#FAF9F6] border border-[#E2E8F0]">
                    <div className="flex items-center gap-2.5 truncate">
                      <Mail className="w-4 h-4 text-[#0284C7] shrink-0" />
                      <span className="font-mono text-xs text-[#0F172A] font-semibold truncate">
                        contact@vaultrag.internal
                      </span>
                    </div>
                    <button
                      onClick={handleCopyEmail}
                      className="px-2.5 py-1 rounded bg-white border border-[#CBD5E1] text-[11px] font-medium text-[#0F172A] hover:bg-[#F1F5F9] transition-colors shrink-0 flex items-center gap-1"
                    >
                      {emailCopied ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-[#64748B]" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#64748B]">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Average response time: Within 4 hours</span>
                  </div>
                </div>
              </RevealOnScroll>

              <RevealOnScroll delay={250}>
                {/* 15-Min Walkthrough Link */}
                <div className="p-6 rounded-2xl bg-white border border-[#E6E6E1] shadow-xs space-y-3">
                  <div className="text-xs font-bold text-[#64748B] uppercase tracking-wider font-mono">
                    Live Technical Review
                  </div>
                  <div className="text-sm font-semibold text-[#0F172A]">
                    Schedule a 15-min Architecture Walkthrough
                  </div>
                  <p className="text-xs text-[#52525B] leading-relaxed">
                    Walk through the PostgreSQL Row-Level Security source code, benchmark suite, and multi-tenant test harness with the author.
                  </p>
                  <a
                    href="mailto:contact@vaultrag.internal?subject=Schedule%20VaultRAG%20Architecture%20Walkthrough"
                    className="inline-flex items-center gap-2 text-xs font-bold text-[#0284C7] hover:text-[#0369A1] pt-1"
                  >
                    <Calendar className="w-4 h-4" />
                    <span>Request Calendar Invite →</span>
                  </a>
                </div>
              </RevealOnScroll>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 7.5 BOTTOM CTA: PROVISION TENANT WORKSPACE                    */}
      {/* ------------------------------------------------------------- */}
      <section className="py-20 px-4 sm:px-6 bg-[#FAF9F6]/80 backdrop-blur-xs border-t border-[#E6E6E1]">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <RevealOnScroll delay={0}>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#0F172A]">
              Ready to secure your company&apos;s AI document intelligence?
            </h2>
            <p className="text-sm sm:text-base text-[#52525B] max-w-xl mx-auto pt-2 leading-relaxed">
              Provision a cryptographically isolated tenant workspace in under 60 seconds with row-level security and custom department access control.
            </p>
          </RevealOnScroll>
          <RevealOnScroll delay={150}>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[#0F172A] text-white text-sm font-semibold hover:bg-[#1E293B] shadow-sm hover:shadow transition-all duration-150 active:scale-[0.98]"
              >
                <span>Register Your Organization</span>
                <ArrowRight className="w-4 h-4 text-[#00D2FF]" />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white border border-[#E6E6E1] text-[#0F172A] text-sm font-semibold hover:bg-[#F4F4F0] shadow-xs transition-all duration-150 active:scale-[0.98]"
              >
                <span>Sign In to Existing Workspace</span>
              </Link>
            </div>
          </RevealOnScroll>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 7.5 FREQUENTLY ASKED QUESTIONS (EasyUI FAQ Accordion)          */}
      {/* ------------------------------------------------------------- */}
      <section id="faq" className="py-20 px-4 sm:px-6 relative z-10 border-t border-[#E6E6E1]/80">
        <div className="max-w-4xl mx-auto space-y-8">
          <RevealOnScroll>
            <div className="text-center space-y-3">
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#0F172A]">
                Frequently Asked Questions
              </h2>
              <p className="text-sm text-[#52525B] max-w-xl mx-auto leading-relaxed">
                Explore the technical architecture, zero-leak guarantees, and permission boundaries powering VaultRAG.
              </p>
            </div>
          </RevealOnScroll>

          <RevealOnScroll delay={100}>
            <div className="rounded-2xl border border-[#E6E6E1] bg-white p-4 sm:p-8 shadow-card">
              <FAQ
                items={faqItems}
                searchable
                searchPlaceholder="Search architecture, RLS, citations, or roles..."
                showCategories
                iconStyle="plus-minus"
                defaultOpen={["rls-security"]}
              />
            </div>
          </RevealOnScroll>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* 8. UNIFIED LONDON FILM SCHOOL LEGAL LINKS FOOTER             */}
      {/* ------------------------------------------------------------- */}
      <AppFooter />
      </div>
    </div>
  );
}
