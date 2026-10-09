"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { DevUserSwitcher } from "@/components/dev-user-switcher";

interface CurrentUserResponse {
  authenticated: boolean;
  user?: {
    id: string;
    email: string;
    full_name: string;
  };
  context?: {
    tenant_id: string;
    role: string;
    is_admin: boolean;
    group_ids: string[];
    groups: string[];
  };
  tenants?: Array<{
    id: string;
    name: string;
    slug: string;
    role: string;
    is_current: boolean;
  }>;
}

export default function HomePage() {
  const [authData, setAuthData] = useState<CurrentUserResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSession = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setAuthData(data);
      } else {
        setAuthData({ authenticated: false });
      }
    } catch {
      setAuthData({ authenticated: false });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    fetchSession();
  };

  const currentTenant = authData?.tenants?.find((t) => t.is_current);

  return (
    <div className="min-h-screen flex flex-col bg-[#090D16] text-slate-100">
      <DevUserSwitcher
        currentEmail={authData?.user?.email}
        onSwitched={fetchSession}
      />

      <main className="flex-1 flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Background glow effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-indigo-600/15 blur-[120px] rounded-full pointer-events-none" />

        <div className="relative z-10 max-w-4xl w-full space-y-8">
          {/* Header */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs font-medium tracking-wide">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Milestone 3: Semantic Retrieval & ACL Filtering Active
            </div>
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-slate-100 via-slate-200 to-indigo-300 bg-clip-text text-transparent">
              VaultRAG
            </h1>
            <p className="text-slate-400 text-sm sm:text-base max-w-2xl mx-auto">
              Permission-Aware Multi-Tenant RAG Service with SQL-Level Vector
              Pre-Filtering and Database Row-Level Security.
            </p>
          </div>

          {/* Authentication & UserContext Card */}
          <div className="p-6 rounded-2xl border border-slate-800 bg-[#0F172A]/90 backdrop-blur-md shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h2 className="font-semibold text-slate-100 text-base">
                  Active Security Context (UserContext)
                </h2>
                <p className="text-xs text-slate-400">
                  Authoritative claims extracted from cryptographic JWT payload
                </p>
              </div>

              {authData?.authenticated ? (
                <button
                  onClick={handleLogout}
                  className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition-all"
                >
                  Log Out
                </button>
              ) : (
                <Link
                  href="/login"
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white transition-all"
                >
                  Sign In
                </Link>
              )}
            </div>

            {loading ? (
              <div className="py-6 flex items-center justify-center gap-2 text-slate-400 text-xs">
                <span className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                Resolving session...
              </div>
            ) : authData?.authenticated && authData.user ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/60 space-y-1">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                    Authenticated User
                  </span>
                  <div className="text-sm font-medium text-slate-200 truncate">
                    {authData.user.email}
                  </div>
                  <div className="text-xs text-slate-400">
                    ID: {authData.user.id.slice(0, 8)}...
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/60 space-y-1">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                    Active Organization (Tenant)
                  </span>
                  <div className="text-sm font-medium text-indigo-300 truncate">
                    {currentTenant?.name || "Acme Corp"}
                  </div>
                  <div className="text-xs text-slate-400 flex items-center gap-2">
                    <span>Role:</span>
                    <span className="px-2 py-0.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 font-mono text-[10px] uppercase">
                      {authData.context?.role}
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/60 space-y-1">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                    Tenant Access Groups
                  </span>
                  {authData.context?.groups && authData.context.groups.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {authData.context.groups.map((group) => (
                        <span
                          key={group}
                          className="px-2 py-0.5 rounded-md border border-sky-500/30 bg-sky-500/10 text-sky-300 text-xs font-medium"
                        >
                          {group}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-500 italic block pt-1">
                      No group memberships
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-6 text-center space-y-2">
                <p className="text-xs text-slate-400">
                  No active session found. Click any persona in the top Dev Switcher bar to instantly authenticate, or visit the login page.
                </p>
                <Link
                  href="/login"
                  className="inline-block text-xs font-semibold text-indigo-400 hover:text-indigo-300 underline underline-offset-4"
                >
                  Go to Login Screen →
                </Link>
              </div>
            )}
          </div>

          {/* Milestone 2: Document Hub CTA Card */}
          <div className="p-6 rounded-2xl border border-indigo-500/20 bg-gradient-to-r from-indigo-950/40 via-slate-900/60 to-slate-950/80 backdrop-blur-md shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xl">📚</span>
                <h3 className="text-base font-semibold text-slate-100">
                  Document Knowledge Base & Ingestion
                </h3>
              </div>
              <p className="text-xs text-slate-400 max-w-lg">
                Upload files (PDF, DOCX, TXT, MD), validate signatures, and run the automated recursive chunking and 1,536-dim vector embedding pipeline with tenant and ACL tagging.
              </p>
            </div>

            <Link
              href="/documents"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition-all shadow-md shadow-indigo-600/30 whitespace-nowrap self-start sm:self-auto"
            >
              Open Documents Hub →
            </Link>
          </div>

          {/* Milestone 3: Semantic Search CTA Card */}
          <div className="p-6 rounded-2xl border border-sky-500/20 bg-gradient-to-r from-sky-950/40 via-slate-900/60 to-slate-950/80 backdrop-blur-md shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xl">🔍</span>
                <h3 className="text-base font-semibold text-slate-100">
                  Semantic Vector Search & ACL Playground
                </h3>
              </div>
              <p className="text-xs text-slate-400 max-w-lg">
                Query 1,536-dimensional embeddings with native PostgreSQL pgvector cosine ranking. Security policies and tenant isolation are enforced directly in the database SQL clause.
              </p>
            </div>

            <Link
              href="/retrieval"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-xs font-semibold text-white transition-all shadow-md shadow-sky-600/30 whitespace-nowrap self-start sm:self-auto"
            >
              Open Semantic Search →
            </Link>
          </div>

          {/* Quickstart & Repo Link */}
          <div className="p-4 rounded-xl border border-slate-800 bg-[#0F172A]/40 flex items-center justify-between text-xs text-slate-400">
            <span>
              Milestone 3 Retrieval & ACL Filtering active. Next: Milestone 4 RAG Generation & Anti-Leak Prompts.
            </span>
            <a
              href="https://github.com/LuckyM09/Permission-Aware-Multi-Tenant-RAG-Service"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-400 hover:text-indigo-300 font-medium"
            >
              GitHub Repo ↗
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
