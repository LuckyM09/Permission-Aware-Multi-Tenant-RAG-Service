"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { DevUserSwitcher } from "@/components/dev-user-switcher";

interface AuditLogItem {
  id: string;
  tenant_id: string;
  user_id: string | null;
  user_email: string;
  action: "query" | "ingest" | "delete_document" | "login" | "grant_permission" | "revoke_permission";
  query_text_sanitized: string;
  retrieved_chunk_ids: string[];
  denied_chunk_count: number;
  ip_address: string | null;
  latency_ms: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

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

export default function AuditPage() {
  const [authData, setAuthData] = useState<UserContextData | null>(null);
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [userEmailFilter, setUserEmailFilter] = useState<string>("");

  // Inspect Modal
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  // Fetch Session
  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setAuthData(data);
      } else {
        setAuthData({ authenticated: false });
      }
    } catch {
      setAuthData({ authenticated: false });
    }
  }, []);

  // Fetch Audit Logs
  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (actionFilter && actionFilter !== "all") {
        params.append("action", actionFilter);
      }
      if (searchQuery.trim()) {
        params.append("search", searchQuery.trim());
      }
      if (userEmailFilter.trim()) {
        params.append("user_email", userEmailFilter.trim());
      }
      params.append("limit", "50");

      const res = await fetch(`/api/audit/logs?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.results || []);
        setTotalCount(data.count || 0);
      } else {
        setLogs([]);
        setTotalCount(0);
      }
    } catch {
      setLogs([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [actionFilter, searchQuery, userEmailFilter]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const currentTenant = authData?.tenants?.find((t) => t.is_current);

  // Calculations for summary metrics
  const avgLatency =
    logs.filter((l) => l.latency_ms !== null).length > 0
      ? (
          logs.reduce((acc, curr) => acc + (curr.latency_ms || 0), 0) /
          logs.filter((l) => l.latency_ms !== null).length
        ).toFixed(1)
      : "0";

  const uniqueUsers = new Set(logs.map((l) => l.user_email).filter(Boolean)).size;

  const getActionBadge = (action: string) => {
    switch (action) {
      case "query":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <span>🔍</span>
            <span>Query</span>
          </span>
        );
      case "ingest":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span>📄</span>
            <span>Ingest</span>
          </span>
        );
      case "delete_document":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <span>🗑️</span>
            <span>Delete</span>
          </span>
        );
      case "login":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <span>🔑</span>
            <span>Login</span>
          </span>
        );
      case "grant_permission":
      case "revoke_permission":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <span>🛡️</span>
            <span>ACL</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300">
            {action}
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#090D16] text-slate-100 selection:bg-indigo-500 selection:text-white">
      {/* Dev User Switcher */}
      <DevUserSwitcher
        currentEmail={authData?.user?.email}
        onSwitched={() => {
          fetchSession();
          fetchLogs();
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
                className="px-3 py-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all"
              >
                Search
              </Link>
              <Link
                href="/chat"
                className="px-3 py-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all"
              >
                💬 Chat Engine
              </Link>
              <span className="px-3 py-1.5 rounded-md bg-purple-500/10 text-purple-300 font-semibold border border-purple-500/30">
                🛡️ Audit Ledger
              </span>
              <Link
                href="/admin"
                className="px-3 py-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all"
              >
                ⚙️ Admin
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {authData?.authenticated && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400">Org:</span>
                <span className="px-2 py-0.5 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-300 font-medium">
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
        {/* Title and Intro */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-300 text-xs font-semibold mb-2">
              <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
              Append-Only Compliance & Forensic Ledger
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Tenant Audit Trail
            </h1>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl">
              Cryptographically verified, immutable database ledger tracking all AI RAG prompts,
              retrieved chunk candidates, ACL access grants, and file ingestions.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              onClick={() => fetchLogs()}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700/80 transition-all shadow-sm"
              title="Refresh ledger"
            >
              <span className={loading ? "animate-spin" : ""}>🔄</span>
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Summary Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl border border-slate-800 bg-[#0F172A]/70 backdrop-blur-sm space-y-1">
            <span className="text-xs font-medium text-slate-400">Total Recorded Events</span>
            <div className="text-2xl font-extrabold text-white">{totalCount}</div>
            <span className="text-[11px] text-slate-500">Tenant-isolated via PostgreSQL RLS</span>
          </div>

          <div className="p-5 rounded-2xl border border-slate-800 bg-[#0F172A]/70 backdrop-blur-sm space-y-1">
            <span className="text-xs font-medium text-slate-400">Active Operators</span>
            <div className="text-2xl font-extrabold text-indigo-400">{uniqueUsers}</div>
            <span className="text-[11px] text-slate-500">Unique accounts in visible ledger</span>
          </div>

          <div className="p-5 rounded-2xl border border-slate-800 bg-[#0F172A]/70 backdrop-blur-sm space-y-1">
            <span className="text-xs font-medium text-slate-400">Average RAG Latency</span>
            <div className="text-2xl font-extrabold text-emerald-400">{avgLatency} ms</div>
            <span className="text-[11px] text-slate-500">Includes vector retrieval & LLM generation</span>
          </div>

          <div className="p-5 rounded-2xl border border-slate-800 bg-[#0F172A]/70 backdrop-blur-sm space-y-1">
            <span className="text-xs font-medium text-slate-400">Ledger Immutability</span>
            <div className="text-2xl font-extrabold text-purple-400">Trigger Enforced</div>
            <span className="text-[11px] text-slate-500">UPDATE & DELETE revoked at DB layer</span>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="p-4 rounded-2xl border border-slate-800 bg-[#0F172A]/50 backdrop-blur-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-3 flex-1">
            {/* Search Input */}
            <div className="relative flex-1">
              <span className="absolute left-3 top-2.5 text-slate-400 text-sm">🔍</span>
              <input
                type="text"
                placeholder="Search query text or audit details..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-purple-500/50"
              />
            </div>

            {/* User Email Filter */}
            <input
              type="text"
              placeholder="Filter by user email..."
              value={userEmailFilter}
              onChange={(e) => setUserEmailFilter(e.target.value)}
              className="px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-purple-500/50 sm:w-56"
            />

            {/* Action Filter */}
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-purple-500/50"
            >
              <option value="all">All Actions</option>
              <option value="query">🔍 Query</option>
              <option value="ingest">📄 Ingest</option>
              <option value="delete_document">🗑️ Delete Document</option>
              <option value="login">🔑 Login</option>
              <option value="grant_permission">🛡️ Grant Permission</option>
              <option value="revoke_permission">🛡️ Revoke Permission</option>
            </select>
          </div>
        </div>

        {/* Audit Log Table */}
        <div className="border border-slate-800/80 rounded-2xl overflow-hidden bg-[#0F172A]/40 backdrop-blur-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 font-medium">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Operator</th>
                  <th className="py-3 px-4">Payload / Query Summary</th>
                  <th className="py-3 px-4 text-center">Chunks</th>
                  <th className="py-3 px-4 text-right">Latency</th>
                  <th className="py-3 px-4 text-center">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      <div className="inline-flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                        <span>Loading audit ledger records...</span>
                      </div>
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500">
                      No audit records found matching the active filters for this tenant.
                    </td>
                  </tr>
                ) : (
                  logs.map((item) => (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-800/30 transition-colors group cursor-pointer"
                      onClick={() => setSelectedLog(item)}
                    >
                      <td className="py-3.5 px-4 font-mono text-slate-400 whitespace-nowrap">
                        {new Date(item.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}{" "}
                        <span className="text-[10px] text-slate-600 block">
                          {new Date(item.created_at).toLocaleDateString()}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {getActionBadge(item.action)}
                      </td>

                      <td className="py-3.5 px-4 text-slate-300 font-medium">
                        {item.user_email || "System"}
                        {item.ip_address && (
                          <span className="block text-[10px] text-slate-500 font-mono">
                            {item.ip_address}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 max-w-md">
                        <p className="truncate text-slate-200">
                          {item.query_text_sanitized || "—"}
                        </p>
                      </td>

                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {item.retrieved_chunk_ids && item.retrieved_chunk_ids.length > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                            {item.retrieved_chunk_ids.length} chunks
                          </span>
                        ) : (
                          <span className="text-slate-600 font-mono">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap font-mono">
                        {item.latency_ms !== null ? (
                          <span
                            className={
                              item.latency_ms < 500
                                ? "text-emerald-400"
                                : item.latency_ms < 1500
                                ? "text-amber-400"
                                : "text-rose-400"
                            }
                          >
                            {item.latency_ms} ms
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedLog(item);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition-colors"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Inspect Modal */}
        {selectedLog && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setSelectedLog(null)}
          >
            <div
              className="bg-[#0F172A] border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 text-slate-100 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base text-white">Compliance Audit Record</h3>
                  {getActionBadge(selectedLog.action)}
                </div>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-200 transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="space-y-1">
                  <span className="text-slate-500 font-medium">Record ID:</span>
                  <div className="font-mono text-slate-300 break-all select-all">{selectedLog.id}</div>
                </div>

                <div className="space-y-1">
                  <span className="text-slate-500 font-medium">Tenant ID:</span>
                  <div className="font-mono text-slate-300 break-all select-all">{selectedLog.tenant_id}</div>
                </div>

                <div className="space-y-1">
                  <span className="text-slate-500 font-medium">Operator Email:</span>
                  <div className="text-slate-300">{selectedLog.user_email || "System"}</div>
                </div>

                <div className="space-y-1">
                  <span className="text-slate-500 font-medium">IP Address:</span>
                  <div className="font-mono text-slate-300">{selectedLog.ip_address || "Internal"}</div>
                </div>

                <div className="space-y-1">
                  <span className="text-slate-500 font-medium">Timestamp:</span>
                  <div className="text-slate-300">{new Date(selectedLog.created_at).toLocaleString()}</div>
                </div>

                <div className="space-y-1">
                  <span className="text-slate-500 font-medium">Execution Latency:</span>
                  <div className="text-slate-300 font-mono">
                    {selectedLog.latency_ms !== null ? `${selectedLog.latency_ms} ms` : "N/A"}
                  </div>
                </div>
              </div>

              {/* Query / Payload Text */}
              <div className="space-y-1.5 text-xs">
                <span className="text-slate-500 font-medium">Sanitized Query / Payload:</span>
                <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl font-mono text-slate-200 text-xs whitespace-pre-wrap select-all">
                  {selectedLog.query_text_sanitized || "No payload logged"}
                </div>
              </div>

              {/* Retrieved Chunks Array */}
              {selectedLog.retrieved_chunk_ids && selectedLog.retrieved_chunk_ids.length > 0 && (
                <div className="space-y-1.5 text-xs">
                  <span className="text-slate-500 font-medium">
                    Retrieved Knowledge Chunks ({selectedLog.retrieved_chunk_ids.length}):
                  </span>
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1 font-mono text-[11px] text-indigo-300 max-h-36 overflow-y-auto">
                    {selectedLog.retrieved_chunk_ids.map((cid, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-slate-600">#{i + 1}</span>
                        <span>{cid}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Metadata JSON */}
              {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
                <div className="space-y-1.5 text-xs">
                  <span className="text-slate-500 font-medium">Attached Metadata:</span>
                  <pre className="p-3 bg-slate-900 border border-slate-800 rounded-xl text-[11px] text-slate-300 font-mono overflow-x-auto">
                    {JSON.stringify(selectedLog.metadata, null, 2)}
                  </pre>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setSelectedLog(null)}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-semibold text-white transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
