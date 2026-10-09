"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { DevUserSwitcher } from "@/components/dev-user-switcher";

interface UserContextData {
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

interface SearchResultItem {
  chunk_id: string;
  document_id: string;
  document_title: string;
  visibility: "private" | "group" | "tenant";
  text: string;
  distance: number;
  similarity: number;
  metadata: Record<string, unknown>;
}

export default function RetrievalPage() {
  const [authData, setAuthData] = useState<UserContextData | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Search Parameters
  const [query, setQuery] = useState("");
  const [topK, setTopK] = useState(5);
  const [threshold, setThreshold] = useState(0.0);

  // Search Results & State
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResultItem[] | null>(null);
  const [searchError, setSearchError] = useState("");
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  // Suggestions for interactive testing
  const suggestions = [
    { label: "Company Wellness Benefits", query: "wellness flexible benefits handbook" },
    { label: "Executive Compensation & Salary", query: "executive compensation CEO salary" },
    { label: "Private Performance Notes", query: "private self-evaluation notes promotion" },
    { label: "Quantum Computing Stealth", query: "quantum computing chips stealth" },
  ];

  const fetchSession = useCallback(async () => {
    try {
      setAuthLoading(true);
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
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  const handleSearch = async (e?: React.FormEvent, customQuery?: string) => {
    if (e) e.preventDefault();
    const searchQuery = (customQuery !== undefined ? customQuery : query).trim();
    if (!searchQuery) return;

    if (customQuery !== undefined) {
      setQuery(customQuery);
    }

    setIsSearching(true);
    setSearchError("");
    const startTime = performance.now();

    try {
      const res = await fetch("/api/retrieval/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: searchQuery,
          top_k: topK,
          threshold: threshold,
        }),
      });

      const elapsed = Math.round(performance.now() - startTime);
      setLatencyMs(elapsed);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setSearchError(errData.error || errData.detail || "Search request failed.");
        setResults([]);
      } else {
        const data = await res.json();
        setResults(data.results || []);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Network error during search";
      setSearchError(message);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const currentTenant = authData?.tenants?.find((t) => t.is_current);

  return (
    <div className="min-h-screen flex flex-col bg-[#090D16] text-slate-100 selection:bg-indigo-500 selection:text-white">
      {/* Dev Persona Switcher */}
      <DevUserSwitcher
        currentEmail={authData?.user?.email}
        onSwitched={() => {
          fetchSession();
          if (query) {
            handleSearch(undefined, query);
          }
        }}
      />

      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-[#0F172A]/80 backdrop-blur-md sticky top-10 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="text-lg font-bold tracking-tight text-white hover:text-indigo-400 transition-colors flex items-center gap-2"
            >
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-black text-white text-base shadow-md shadow-indigo-600/30">
                V
              </div>
              <span>VaultRAG</span>
            </Link>

            <nav className="flex items-center gap-1 text-sm font-medium">
              <Link
                href="/"
                className="px-3 py-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all"
              >
                Overview
              </Link>
              <Link
                href="/documents"
                className="px-3 py-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all"
              >
                Documents
              </Link>
              <Link
                href="/retrieval"
                className="px-3 py-1.5 rounded-md bg-indigo-500/10 text-indigo-400 font-semibold border border-indigo-500/20"
              >
                Semantic Search
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {authData?.authenticated && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400">Org:</span>
                <span className="px-2 py-0.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 font-medium">
                  {currentTenant?.name || "Acme Corp"}
                </span>
                <span className="text-slate-500">|</span>
                <span className="text-slate-300 font-medium">{authData.user?.email}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Page Header */}
        <div className="border-b border-slate-800 pb-6">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs font-medium tracking-wide mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Milestone 3: Permission-Aware Vector Search Engine
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Semantic Vector Retrieval
          </h1>
          <p className="text-slate-400 text-sm mt-1 max-w-3xl">
            Query 1,536-dimensional embeddings with native PostgreSQL pgvector cosine ranking.
            Security policies and tenant isolation are enforced directly in the database SQL clause:
            users only receive chunks they are cryptographically authorized to view.
          </p>
        </div>

        {/* Active Security Context Banner */}
        <div className="p-4 rounded-xl border border-slate-800 bg-[#0F172A]/70 backdrop-blur-md flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <span className="text-slate-400 font-medium">Searching As:</span>
            <span className="font-semibold text-white px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
              {authData?.user?.email || "Resolving session..."}
            </span>
            <span className="px-2 py-0.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 uppercase tracking-wider text-[10px] font-mono">
              {authData?.context?.role || "viewer"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400">Granted Groups:</span>
            {authData?.context?.groups && authData.context.groups.length > 0 ? (
              authData.context.groups.map((grp) => (
                <span
                  key={grp}
                  className="px-2 py-0.5 rounded-md border border-sky-500/30 bg-sky-500/10 text-sky-300 font-medium text-[11px]"
                >
                  {grp}
                </span>
              ))
            ) : (
              <span className="text-slate-500 italic">None</span>
            )}
          </div>
        </div>

        {/* Search Query Form */}
        <div className="p-6 rounded-2xl border border-slate-800 bg-[#0F172A]/90 backdrop-blur-md shadow-xl space-y-6">
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="relative">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask or search your documents (e.g. 'What are our annual wellness benefits?')"
                className="w-full px-4 py-3.5 pl-11 rounded-xl bg-slate-900 border border-slate-700 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 shadow-inner transition-colors"
              />
              <svg
                className="w-5 h-5 text-slate-500 absolute left-3.5 top-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>

              <button
                type="submit"
                disabled={!query.trim() || isSearching}
                className="absolute right-2 top-2 px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold text-white transition-all shadow-md shadow-indigo-600/30 flex items-center gap-2"
              >
                {isSearching ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <span>Search</span>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M14 5l7 7m0 0l-7 7m7-7H3"
                      />
                    </svg>
                  </>
                )}
              </button>
            </div>

            {/* Quick Test Chips */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[11px] text-slate-500 font-medium">Quick Test Queries:</span>
              {suggestions.map((sugg) => (
                <button
                  key={sugg.label}
                  type="button"
                  onClick={() => handleSearch(undefined, sugg.query)}
                  className="px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-800/60 hover:bg-slate-700 hover:text-white text-[11px] text-slate-300 transition-all"
                >
                  {sugg.label}
                </button>
              ))}
            </div>

            {/* Parameters (Top-k & Threshold) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-800/80">
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <label className="text-slate-400 font-medium">Top-K Neighbors: {topK}</label>
                  <span className="text-slate-500 text-[10px]">Max chunks returned</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="20"
                  value={topK}
                  onChange={(e) => setTopK(parseInt(e.target.value))}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <label className="text-slate-400 font-medium">
                    Similarity Threshold: {Math.round(threshold * 100)}%
                  </label>
                  <span className="text-slate-500 text-[10px]">Filter cutoff</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="95"
                  step="5"
                  value={threshold * 100}
                  onChange={(e) => setThreshold(parseFloat(e.target.value) / 100)}
                  className="w-full accent-indigo-500 cursor-pointer"
                />
              </div>
            </div>
          </form>

          {searchError && (
            <div className="p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs">
              {searchError}
            </div>
          )}
        </div>

        {/* Results Section */}
        {results !== null && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-400 px-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-200">
                  {results.length} Chunks Retrieved
                </span>
                {latencyMs !== null && (
                  <span className="text-slate-500">• Executed in {latencyMs}ms</span>
                )}
              </div>
              <span className="text-slate-500">
                SQL Pre-Filter applied with cosine ranking
              </span>
            </div>

            {results.length === 0 ? (
              <div className="p-12 text-center border border-dashed border-slate-800 rounded-2xl bg-slate-900/30 space-y-2">
                <div className="w-10 h-10 rounded-full bg-slate-800 text-slate-500 mx-auto flex items-center justify-center text-lg">
                  🛡️
                </div>
                <p className="text-sm font-semibold text-slate-300">
                  Zero Chunks Retrieved (Access Denied or No Matches)
                </p>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  If this document exists in the system, your current persona ({authData?.user?.email})
                  does not possess the required tenant, role, or group permissions to view it.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {results.map((result, idx) => {
                  const similarityPct = Math.round(result.similarity * 100);
                  return (
                    <div
                      key={result.chunk_id}
                      className="p-5 rounded-2xl border border-slate-800 bg-[#0F172A]/90 hover:border-slate-700 backdrop-blur-md shadow-lg transition-all space-y-3"
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                        <div className="flex items-center gap-2.5">
                          <span className="w-6 h-6 rounded-full bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 flex items-center justify-center font-bold text-xs">
                            #{idx + 1}
                          </span>
                          <span className="font-semibold text-sm text-slate-100 flex items-center gap-1.5">
                            <span>📄</span>
                            <span>{result.document_title}</span>
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Scope Badge */}
                          {result.visibility === "private" && (
                            <span className="px-2 py-0.5 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-300 text-[10px] font-medium">
                              🔒 Private
                            </span>
                          )}
                          {result.visibility === "group" && (
                            <span className="px-2 py-0.5 rounded-full border border-sky-500/30 bg-sky-500/10 text-sky-300 text-[10px] font-medium">
                              👥 Group Restricted
                            </span>
                          )}
                          {result.visibility === "tenant" && (
                            <span className="px-2 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-[10px] font-medium">
                              🏢 Tenant-Wide
                            </span>
                          )}

                          {/* Similarity Badge */}
                          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs font-semibold font-mono">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            {similarityPct}% Match
                          </div>
                        </div>
                      </div>

                      {/* Text Snippet */}
                      <p className="text-xs text-slate-300 leading-relaxed font-sans bg-slate-900/40 p-3.5 rounded-xl border border-slate-800/60">
                        {result.text}
                      </p>

                      {/* Provenance & Distance Footer */}
                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                        <div className="flex items-center gap-3 font-mono">
                          <span>Chunk ID: {result.chunk_id.slice(0, 8)}...</span>
                          <span>Cosine Distance: {result.distance}</span>
                        </div>

                        {result.metadata && Object.keys(result.metadata).length > 0 && (
                          <div className="text-[10px] text-slate-500">
                            Tokens: {String(result.metadata.token_count || result.metadata.word_count || "—")}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
