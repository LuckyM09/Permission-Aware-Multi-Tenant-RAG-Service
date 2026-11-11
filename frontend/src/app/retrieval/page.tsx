"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  SlidersHorizontal,
  Layers,
  Cpu,
  FileText,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Lock,
  Users,
  Building2,
  Sparkles,
  ShieldCheck,
  Image as ImageIcon,
  ExternalLink,
  ChevronRight,
  Shield,
} from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { AppFooter } from "@/components/app-footer";
import { KineticTextLoader } from "@/components/ui/kinetic-text-loader";
import { useAuthSession, UserContextData } from "@/lib/auth-session";

interface SearchResultItem {
  chunk_id: string;
  document_id: string;
  document_title: string;
  visibility: "private" | "group" | "tenant";
  text: string;
  distance: number;
  similarity: number;
  score?: number;
  retrieval_mode?: "hybrid" | "dense" | "sparse";
  reranked?: boolean;
  metadata: Record<string, unknown>;
}

export default function RetrievalPage() {
  const router = useRouter();
  const { authData, authLoading, refreshSession } = useAuthSession();

  // Search Parameters
  const [query, setQuery] = useState("");
  const [topK, setTopK] = useState(5);
  const [threshold, setThreshold] = useState(0.0);
  const [mode, setMode] = useState<"hybrid" | "dense" | "sparse">("hybrid");
  const [rerank, setRerank] = useState(true);
  const [alpha, setAlpha] = useState(0.5);

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

  useEffect(() => {
    document.title = "Semantic Search | VaultRAG Enterprise";
  }, []);

  useEffect(() => {
    if (!authData) return;
    if (!authData.authenticated) {
      router.replace("/login");
    } else if (!authData.context?.is_admin) {
      router.replace("/chat");
    }
  }, [authData, router]);

  const handleSearch = async (e?: React.FormEvent, customQuery?: string) => {
    if (e) e.preventDefault();
    const searchQuery = (customQuery !== undefined ? customQuery : query).trim();
    if (!searchQuery) return;

    if (customQuery !== undefined) {
      setQuery(customQuery);
    }

    setIsSearching(true);
    setSearchError("");
    setResults(null);
    setLatencyMs(null);

    const startTime = performance.now();

    try {
      const res = await fetch("/api/retrieval/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: searchQuery,
          top_k: topK,
          threshold: threshold,
          mode: mode,
          rerank: rerank,
          alpha: alpha,
        }),
      });

      const data = await res.json().catch(() => ({}));
      const endTime = performance.now();
      setLatencyMs(Math.round(endTime - startTime));

      if (!res.ok) {
        setSearchError(data.error || data.detail || `Search failed with status ${res.status}.`);
      } else {
        setResults(data.results || []);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Network error during search";
      setSearchError(message);
    } finally {
      setIsSearching(false);
    }
  };

  const currentTenant = authData?.tenants?.find((t) => t.is_current);

  if (authLoading || !authData) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] text-[#0F172A] flex flex-col items-center justify-center p-6 text-center font-sans">
        <KineticTextLoader text="Loading" className="scale-75" />
        <p className="text-xs text-[#64748B] font-mono mt-4">
          Verifying semantic search authorization...
        </p>
      </div>
    );
  }

  if (!authData.authenticated) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] text-[#0F172A] flex flex-col items-center justify-center p-6 text-center font-sans">
        <KineticTextLoader text="Loading" className="scale-75" />
        <p className="text-xs text-[#64748B] font-mono mt-4">
          Authentication required. Redirecting to sign in...
        </p>
      </div>
    );
  }

  if (!authData.context?.is_admin) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] text-[#0F172A] flex flex-col items-center justify-center p-6 text-center font-sans">
        <KineticTextLoader text="Loading" className="scale-75" />
        <p className="text-xs text-[#64748B] font-mono mt-4">
          Member account verified. Redirecting to Secure Chat...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF9F6] text-[#0F172A]">
      {/* Global App Header */}
      <AppHeader
        userEmail={authData?.user?.email}
        tenantName={currentTenant?.name}
        role={authData?.context?.role}
        onLogout={() => refreshSession(true)}
      />

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E6E6E1] pb-6">
          <div className="space-y-1.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0F172A]">
              Semantic Search &amp; Retrieval Studio
            </h1>
            <p className="text-xs sm:text-sm text-[#52525B] max-w-2xl leading-relaxed">
              Test dense vector search, BM25 keyword matching, Reciprocal Rank Fusion, and cross-encoder
              reranking. All queries enforce PostgreSQL Row-Level Security before scoring.
            </p>
          </div>
        </div>

        {/* Security Persona Banner */}
        <div className="p-4 sm:p-5 rounded-2xl border border-[#E6E6E1] bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-sky-50 border border-sky-100 flex items-center justify-center text-[#0284C7] shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[#64748B]">Simulated Persona: </span>
              <span className="font-bold text-[#0F172A] font-mono">
                {authData?.user?.email || "Resolving..."}
              </span>
              <span className="text-[#CBD5E1] mx-2">•</span>
              <span className="text-[#64748B]">Role: </span>
              <span className="font-semibold text-[#0F172A] uppercase font-mono">
                {authData?.context?.role || "—"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[#64748B] font-medium">Active Groups:</span>
            {authData?.context?.groups && authData.context.groups.length > 0 ? (
              authData.context.groups.map((grp) => (
                <span
                  key={grp}
                  className="px-2.5 py-0.5 rounded-md bg-[#FAF9F6] border border-[#E2E8F0] text-[11px] font-mono font-medium text-[#0F172A]"
                >
                  {grp}
                </span>
              ))
            ) : (
              <span className="text-[#94A3B8] italic">None</span>
            )}
          </div>
        </div>

        {/* Search Query Form */}
        <section
          aria-labelledby="retrieval-form-heading"
          className="rounded-2xl border border-[#E6E6E1] bg-white p-6 sm:p-8 shadow-card space-y-6"
        >
          <form onSubmit={handleSearch} className="space-y-5">
            {/* Main Input */}
            <div className="relative">
              <input
                id="retrieval-query-input"
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask or search your documents (e.g. 'What are our annual wellness benefits?')"
                className="w-full px-4 py-3.5 pl-11 pr-32 rounded-xl bg-[#FAF9F6] border border-[#E2E8F0] text-xs sm:text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#0F172A] focus:bg-white transition-all shadow-2xs"
              />
              <Search className="w-4 h-4 text-[#94A3B8] absolute left-4 top-4 pointer-events-none" />

              <button
                type="submit"
                disabled={!query.trim() || isSearching}
                className="absolute right-2 top-2 px-5 py-2 rounded-lg bg-[#0F172A] hover:bg-[#1E293B] text-white active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold transition-all shadow-xs flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F172A] cursor-pointer"
              >
                {isSearching ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Searching...</span>
                  </>
                ) : (
                  <>
                    <span>Search</span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#00D2FF]" />
                  </>
                )}
              </button>
            </div>

            {/* Quick Test Chips */}
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <span className="text-[11px] text-[#64748B] font-mono font-medium">Quick Test Queries:</span>
              {suggestions.map((sugg) => (
                <button
                  key={sugg.label}
                  type="button"
                  onClick={() => handleSearch(undefined, sugg.query)}
                  className="px-3 py-1 rounded-lg border border-[#E6E6E1] bg-[#FAF9F6] hover:bg-white hover:border-[#0284C7] text-[11px] text-[#52525B] hover:text-[#0F172A] transition-all cursor-pointer shadow-2xs"
                >
                  {sugg.label}
                </button>
              ))}
            </div>

            {/* Modality Selector & Controls */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 pt-5 border-t border-[#E6E6E1]">
              {/* Search Modality Mode */}
              <div className="space-y-2">
                <label className="text-xs text-[#0F172A] font-bold block uppercase tracking-wider">
                  Search Modality
                </label>
                <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[#FAF9F6] border border-[#E2E8F0] text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setMode("hybrid")}
                    className={`py-2 px-2 rounded-lg transition-all text-center text-xs cursor-pointer ${
                      mode === "hybrid"
                        ? "bg-[#0F172A] text-white font-bold shadow-xs"
                        : "text-[#52525B] hover:text-[#0F172A]"
                    }`}
                  >
                    Hybrid (RRF)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("dense")}
                    className={`py-2 px-2 rounded-lg transition-all text-center text-xs cursor-pointer ${
                      mode === "dense"
                        ? "bg-[#0F172A] text-white font-bold shadow-xs"
                        : "text-[#52525B] hover:text-[#0F172A]"
                    }`}
                  >
                    Vector (Dense)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("sparse")}
                    className={`py-2 px-2 rounded-lg transition-all text-center text-xs cursor-pointer ${
                      mode === "sparse"
                        ? "bg-[#0F172A] text-white font-bold shadow-xs"
                        : "text-[#52525B] hover:text-[#0F172A]"
                    }`}
                  >
                    Keyword (BM25)
                  </button>
                </div>
              </div>

              {/* Cross-Encoder Reranker Toggle */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <label className="text-[#0F172A] font-bold uppercase tracking-wider">Cross-Encoder Reranker</label>
                  <span className="text-[10px] text-[#64748B] font-mono font-semibold">
                    {rerank ? "ACTIVE" : "BYPASSED"}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setRerank(!rerank)}
                  className={`w-full py-2.5 px-3.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    rerank
                      ? "bg-emerald-50 border-emerald-200 text-emerald-800 shadow-2xs"
                      : "bg-[#FAF9F6] border-[#E2E8F0] text-[#64748B] hover:text-[#0F172A]"
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      rerank ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                    }`}
                  />
                  <span>{rerank ? "Reranker Enabled" : "Reranker Disabled"}</span>
                </button>
              </div>

              {/* Sliders: Top-K & Threshold */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <label className="text-[#0F172A] font-bold uppercase tracking-wider">Top-K: {topK}</label>
                  <span className="text-[10px] text-[#64748B] font-mono font-semibold">
                    Cutoff: {Math.round(threshold * 100)}%
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <input
                    type="range"
                    min="1"
                    max="20"
                    value={topK}
                    onChange={(e) => setTopK(parseInt(e.target.value, 10))}
                    className="w-full accent-[#0F172A] cursor-pointer"
                    title={`Top-K: ${topK}`}
                  />
                  <input
                    type="range"
                    min="0"
                    max="90"
                    step="5"
                    value={threshold * 100}
                    onChange={(e) => setThreshold(parseFloat(e.target.value) / 100)}
                    className="w-full accent-[#0F172A] cursor-pointer"
                    title={`Threshold: ${Math.round(threshold * 100)}%`}
                  />
                </div>
              </div>
            </div>

            {/* Hybrid Alpha Balance Slider */}
            {mode === "hybrid" && (
              <div className="p-4 rounded-xl bg-[#FAF9F6] border border-[#E2E8F0] text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[#52525B] font-medium">
                    Hybrid Weight Balance:{" "}
                    <span className="text-[#0F172A] font-bold">
                      {Math.round(alpha * 100)}% Vector / {Math.round((1 - alpha) * 100)}% Keyword
                    </span>
                  </span>
                  <span className="text-[10px] text-[#64748B] font-mono font-semibold">
                    α = {alpha.toFixed(2)}
                  </span>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.05"
                  value={alpha}
                  onChange={(e) => setAlpha(parseFloat(e.target.value))}
                  className="w-full accent-[#0F172A] cursor-pointer"
                />
              </div>
            )}
          </form>

          {searchError && (
            <div
              role="alert"
              className="p-3.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{searchError}</span>
            </div>
          )}
        </section>

        {/* Results Section */}
        {results !== null && (
          <section aria-labelledby="results-heading" className="space-y-4">
            <div className="flex items-center justify-between text-xs text-[#64748B] px-1">
              <div className="flex items-center gap-2">
                <span id="results-heading" className="font-bold text-[#0F172A]">
                  {results.length} Chunks Retrieved
                </span>
                {latencyMs !== null && (
                  <span className="font-mono text-[#64748B]">• {latencyMs}ms execution</span>
                )}
              </div>
              <span className="text-[#64748B] font-mono text-[11px]">
                Mode: <span className="uppercase text-[#0F172A] font-bold">{mode}</span>
                {rerank ? " + Reranked" : ""}
              </span>
            </div>

            {results.length === 0 ? (
              <div className="p-12 text-center border-2 border-dashed border-[#E6E6E1] rounded-2xl bg-white space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-sky-50 border border-sky-100 text-[#0284C7] mx-auto flex items-center justify-center">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <p className="text-base font-bold text-[#0F172A]">
                  Zero Chunks Retrieved (Access Denied or No Matches)
                </p>
                <p className="text-xs text-[#64748B] max-w-md mx-auto leading-relaxed">
                  If this document exists in the database, your current persona ({authData?.user?.email})
                  does not possess the required tenant, role, or group permissions to access it.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {results.map((result, idx) => {
                  const displayScore = Math.round(
                    (result.score !== undefined ? result.score : result.similarity) * 100
                  );
                  return (
                    <div
                      key={result.chunk_id}
                      className="p-5 sm:p-6 rounded-2xl border border-[#E6E6E1] bg-white shadow-card space-y-3.5 transition-all hover:shadow-md"
                    >
                      {/* Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-[#E6E6E1] pb-3.5">
                        <div className="flex items-center gap-3">
                          <span className="w-7 h-7 rounded-lg bg-[#FAF9F6] text-[#0F172A] border border-[#E2E8F0] flex items-center justify-center font-mono font-bold text-xs shrink-0">
                            #{idx + 1}
                          </span>
                          <span className="font-bold text-sm text-[#0F172A] flex items-center gap-2">
                            <FileText className="w-4 h-4 text-[#64748B] shrink-0" />
                            <span>{result.document_title}</span>
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {/* Provenance Tag */}
                          {result.retrieval_mode === "hybrid" && (
                            <span className="px-2.5 py-0.5 rounded-md border border-[#E2E8F0] bg-[#FAF9F6] text-[#0F172A] text-[10px] font-mono font-semibold">
                              Hybrid RRF
                            </span>
                          )}
                          {result.retrieval_mode === "dense" && (
                            <span className="px-2.5 py-0.5 rounded-md border border-[#E2E8F0] bg-[#FAF9F6] text-[#64748B] text-[10px] font-mono">
                              Dense Vector
                            </span>
                          )}
                          {result.retrieval_mode === "sparse" && (
                            <span className="px-2.5 py-0.5 rounded-md border border-amber-200 bg-amber-50 text-amber-800 text-[10px] font-mono font-semibold">
                              Keyword BM25
                            </span>
                          )}

                          {/* Reranked Tag */}
                          {result.reranked && (
                            <span className="px-2.5 py-0.5 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-800 text-[10px] font-mono font-semibold">
                              Reranked
                            </span>
                          )}

                          {/* Scope Badge */}
                          {result.visibility === "private" && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md border border-amber-200 bg-amber-50 text-amber-800 text-[10px] font-mono font-semibold">
                              <Lock className="w-3 h-3" />
                              <span>Private</span>
                            </span>
                          )}
                          {result.visibility === "group" && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md border border-indigo-200 bg-indigo-50 text-indigo-800 text-[10px] font-mono font-semibold">
                              <Users className="w-3 h-3" />
                              <span>Group</span>
                            </span>
                          )}
                          {result.visibility === "tenant" && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md border border-sky-200 bg-sky-50 text-sky-800 text-[10px] font-mono font-semibold">
                              <Building2 className="w-3 h-3" />
                              <span>Tenant</span>
                            </span>
                          )}

                          {/* Score Badge */}
                          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs font-bold font-mono">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span>{displayScore}%</span>
                          </div>
                        </div>
                      </div>

                      {/* Text Snippet */}
                      <p className="text-xs text-[#1E293B] leading-relaxed font-sans bg-[#FAF9F6] p-3.5 rounded-xl border border-[#E2E8F0]">
                        {result.text}
                      </p>

                      {/* Attached Figures / Visual Elements */}
                      {Array.isArray(result.metadata?.images) &&
                        (
                          result.metadata.images as Array<{
                            url: string;
                            filename: string;
                            page?: number;
                            width?: number;
                            height?: number;
                          }>
                        ).length > 0 && (
                          <div className="space-y-2 pt-2 border-t border-[#E6E6E1]">
                            <span className="text-[11px] font-bold text-[#64748B] flex items-center gap-1.5 font-mono">
                              <ImageIcon className="w-3.5 h-3.5 text-[#0284C7]" />
                              <span>Extracted Multimodal Figures:</span>
                            </span>
                            <div className="flex flex-wrap gap-2.5">
                              {(
                                result.metadata.images as Array<{
                                  url: string;
                                  filename: string;
                                  page?: number;
                                  width?: number;
                                  height?: number;
                                }>
                              ).map((img, imgIdx) => (
                                <a
                                  key={imgIdx}
                                  href={img.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="group relative rounded-xl overflow-hidden border border-[#E6E6E1] bg-[#FAF9F6] hover:border-[#0284C7] transition-all p-1 inline-block shadow-2xs"
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={img.url}
                                    alt={img.filename}
                                    className="h-24 max-w-xs object-cover rounded-lg"
                                  />
                                  <div className="absolute inset-x-1 bottom-1 bg-black/70 backdrop-blur-2xs py-0.5 px-1.5 text-[9px] font-mono text-white truncate rounded">
                                    {img.filename}
                                  </div>
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                      {/* Provenance & Distance Footer */}
                      <div className="flex items-center justify-between text-[11px] text-[#64748B] pt-1">
                        <div className="flex items-center gap-3 font-mono">
                          <span>Chunk ID: {result.chunk_id.slice(0, 8)}...</span>
                          <span>Cosine Distance: {result.distance}</span>
                        </div>

                        {result.metadata && Object.keys(result.metadata).length > 0 && (
                          <div className="text-[10px] text-[#64748B] font-mono">
                            Tokens: {String(result.metadata.token_count || result.metadata.word_count || "—")}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </main>
      <AppFooter />
    </div>
  );
}
