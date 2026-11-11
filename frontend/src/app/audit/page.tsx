"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  History,
  Search,
  RefreshCw,
  Shield,
  Key,
  FileText,
  Trash2,
  Lock,
  X,
  ExternalLink,
  CheckCircle2,
  Clock,
  Layers,
  Activity,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { AppFooter } from "@/components/app-footer";
import { ActivityFeed } from "@/components/ui/activity-feed";
import { KineticTextLoader } from "@/components/ui/kinetic-text-loader";
import { useAuthSession, UserContextData } from "@/lib/auth-session";

interface AuditLogItem {
  id: string;
  tenant_id: string;
  user_id: string | null;
  user_email: string;
  action: "query" | "ingest" | "delete_document" | "login" | "grant_permission" | "revoke_permission" | string;
  query_text_sanitized: string;
  retrieved_chunk_ids: string[];
  denied_chunk_count: number;
  ip_address: string | null;
  latency_ms: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export default function AuditPage() {
  const router = useRouter();
  const { authData, authLoading, refreshSession } = useAuthSession();
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [userEmailFilter, setUserEmailFilter] = useState<string>("");
  const [viewMode, setViewMode] = useState<"feed" | "table">("feed");

  // Inspect Modal
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

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
    document.title = "Audit Trail | VaultRAG Enterprise";
  }, []);

  useEffect(() => {
    if (!authData) return;
    if (!authData.authenticated) {
      setLogs([]);
      setTotalCount(0);
      setLoading(false);
      router.replace("/login");
      return;
    }
    if (!authData.context?.is_admin) {
      router.replace("/chat");
    } else {
      fetchLogs();
    }
  }, [authData, router, fetchLogs]);

  const currentTenant = authData?.tenants?.find((t) => t.is_current);

  // Computed metrics
  const uniqueUsers = Array.from(new Set(logs.map((l) => l.user_email).filter(Boolean))).length;
  const avgLatency =
    logs.length > 0
      ? Math.round(
          logs.reduce((acc, curr) => acc + (curr.latency_ms || 0), 0) /
            (logs.filter((l) => l.latency_ms).length || 1)
        )
      : 0;

  // Format date helper
  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case "query":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-sky-50 text-sky-800 border border-sky-200">
            <Search className="w-3 h-3 text-[#0284C7]" />
            <span>RAG Query</span>
          </span>
        );
      case "ingest":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <FileText className="w-3 h-3 text-emerald-600" />
            <span>Ingest</span>
          </span>
        );
      case "delete_document":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-rose-50 text-rose-800 border border-rose-200">
            <Trash2 className="w-3 h-3 text-rose-600" />
            <span>Delete</span>
          </span>
        );
      case "login":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-purple-50 text-purple-800 border border-purple-200">
            <Key className="w-3 h-3 text-purple-600" />
            <span>Login</span>
          </span>
        );
      case "grant_permission":
      case "revoke_permission":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            <Shield className="w-3 h-3 text-amber-600" />
            <span>ACL</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-[#FAF9F6] text-[#64748B] border border-[#E6E6E1]">
            {action}
          </span>
        );
    }
  };

  if (authLoading || !authData) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] text-[#0F172A] flex flex-col items-center justify-center p-6 text-center font-sans">
        <KineticTextLoader text="Loading" className="scale-75" />
        <p className="text-xs text-[#64748B] font-mono mt-4">
          Loading compliance audit trail...
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

  // If authenticated but not admin, render redirecting screen
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
        {/* Title and Intro */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E6E6E1] pb-6">
          <div className="space-y-1.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0F172A]">
              Tenant Audit Trail
            </h1>
            <p className="text-xs sm:text-sm text-[#52525B] max-w-2xl leading-relaxed">
              Cryptographically verified database ledger tracking all AI RAG prompts,
              retrieved chunk candidates, ACL access grants, and file ingestions.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => fetchLogs()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#E6E6E1] bg-white hover:bg-[#F4F4F0] text-[#0F172A] text-xs font-semibold transition-colors shadow-xs cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#64748B] ${loading ? "animate-spin" : ""}`} />
              <span>Refresh Ledger</span>
            </button>
          </div>
        </div>

        {/* Summary Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-2xl border border-[#E6E6E1] bg-white space-y-1 shadow-xs">
            <span className="text-xs font-medium text-[#64748B]">Total Recorded Events</span>
            <div className="text-2xl font-extrabold text-[#0F172A]">{totalCount}</div>
            <span className="text-[11px] text-[#64748B]">Tenant-isolated via PostgreSQL RLS</span>
          </div>

          <div className="p-5 rounded-2xl border border-[#E6E6E1] bg-white space-y-1 shadow-xs">
            <span className="text-xs font-medium text-[#64748B]">Active Operators</span>
            <div className="text-2xl font-extrabold text-[#0284C7]">{uniqueUsers}</div>
            <span className="text-[11px] text-[#64748B]">Unique accounts in visible ledger</span>
          </div>

          <div className="p-5 rounded-2xl border border-[#E6E6E1] bg-white space-y-1 shadow-xs">
            <span className="text-xs font-medium text-[#64748B]">Average RAG Latency</span>
            <div className="text-2xl font-extrabold text-emerald-600">{avgLatency} ms</div>
            <span className="text-[11px] text-[#64748B]">Vector search + reranking + Nemotron</span>
          </div>

          <div className="p-5 rounded-2xl border border-[#E6E6E1] bg-white space-y-1 shadow-xs">
            <span className="text-xs font-medium text-[#64748B]">Ledger Immutability</span>
            <div className="text-2xl font-extrabold text-[#0F172A]">PostgreSQL Trigger</div>
            <span className="text-[11px] text-[#64748B]">UPDATE &amp; DELETE revoked at DB layer</span>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="p-4 rounded-2xl border border-[#E6E6E1] bg-white flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between shadow-xs">
          <div className="flex flex-col sm:flex-row gap-3 flex-1">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3.5 top-3 text-[#64748B]" />
              <input
                type="text"
                placeholder="Search sanitized query text..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#FAF9F6] border border-[#E2E8F0] text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#0F172A] focus:bg-white transition-all"
              />
            </div>

            {/* Action Filter */}
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="px-3.5 py-2 rounded-xl bg-[#FAF9F6] border border-[#E2E8F0] text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0F172A] focus:bg-white transition-all"
            >
              <option value="all">All Actions</option>
              <option value="query">RAG Queries</option>
              <option value="ingest">Document Ingestions</option>
              <option value="delete_document">Document Deletions</option>
              <option value="login">Authentication Logins</option>
              <option value="grant_permission">Permission Grants</option>
              <option value="revoke_permission">Permission Revocations</option>
            </select>

            {/* User Filter */}
            <input
              type="text"
              placeholder="Filter by operator email..."
              value={userEmailFilter}
              onChange={(e) => setUserEmailFilter(e.target.value)}
              className="px-3.5 py-2 rounded-xl bg-[#FAF9F6] border border-[#E2E8F0] text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#0F172A] focus:bg-white transition-all sm:w-48"
            />
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-1 p-1 bg-[#FAF9F6] rounded-xl border border-[#E6E6E1] self-start md:self-auto">
            <button
              type="button"
              onClick={() => setViewMode("feed")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === "feed"
                  ? "bg-[#0F172A] text-white shadow-xs"
                  : "text-[#52525B] hover:text-[#0F172A]"
              }`}
            >
              Activity Feed
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewMode === "table"
                  ? "bg-[#0F172A] text-white shadow-xs"
                  : "text-[#52525B] hover:text-[#0F172A]"
              }`}
            >
              Data Table
            </button>
          </div>
        </div>

        {/* Content View */}
        {viewMode === "feed" ? (
          <div className="rounded-2xl border border-[#E6E6E1] bg-white p-6 shadow-xs">
            <ActivityFeed
              events={logs}
              loading={loading}
              onSelectEvent={(evt) => setSelectedLog(evt as AuditLogItem)}
            />
          </div>
        ) : (
          /* Table View */
          <div className="rounded-2xl border border-[#E6E6E1] bg-white overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#E6E6E1] bg-[#FAF9F6] text-[#64748B] font-mono uppercase text-[10px]">
                    <th className="py-3 px-4 font-semibold">Timestamp</th>
                    <th className="py-3 px-4 font-semibold">Operator</th>
                    <th className="py-3 px-4 font-semibold">Action</th>
                    <th className="py-3 px-4 font-semibold">Details / Query</th>
                    <th className="py-3 px-4 font-semibold text-center">Chunks</th>
                    <th className="py-3 px-4 font-semibold text-right">Latency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6E6E1]">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-xs text-[#64748B]">
                        Verifying cryptographic signatures...
                      </td>
                    </tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-xs text-[#64748B]">
                        No audit events matching current criteria.
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr
                        key={log.id}
                        onClick={() => setSelectedLog(log)}
                        className="hover:bg-[#FAF9F6] transition-colors cursor-pointer"
                      >
                        <td className="py-3 px-4 font-mono text-[11px] text-[#64748B] whitespace-nowrap">
                          {formatDate(log.created_at)}
                        </td>
                        <td className="py-3 px-4 font-medium text-[#0F172A]">
                          {log.user_email || "System"}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">{getActionBadge(log.action)}</td>
                        <td className="py-3 px-4 text-[#52525B] max-w-md truncate font-sans">
                          {log.query_text_sanitized || "—"}
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-[11px]">
                          {log.retrieved_chunk_ids?.length || 0}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-[11px] text-[#64748B]">
                          {log.latency_ms ? `${log.latency_ms}ms` : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Detailed Modal */}
        {selectedLog && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150"
          >
            <div
              className="fixed inset-0 -z-10"
              onClick={() => setSelectedLog(null)}
              aria-hidden="true"
            />
            <div className="w-full max-w-lg rounded-2xl border border-[#E6E6E1] bg-white p-6 shadow-2xl relative space-y-4 animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between border-b border-[#E6E6E1] pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-sky-50 border border-sky-100 text-[#0284C7] flex items-center justify-center">
                    <History className="w-4 h-4" />
                  </div>
                  <h3 className="text-base font-bold text-[#0F172A]">Audit Event Inspector</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedLog(null)}
                  className="p-1 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-[#F4F4F0]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-1 border-b border-[#F4F4F0]">
                  <span className="text-[#64748B]">Event ID:</span>
                  <span className="font-mono text-[#0F172A]">{selectedLog.id}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#F4F4F0]">
                  <span className="text-[#64748B]">Timestamp:</span>
                  <span className="font-mono text-[#0F172A]">{formatDate(selectedLog.created_at)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#F4F4F0]">
                  <span className="text-[#64748B]">Operator:</span>
                  <span className="font-semibold text-[#0F172A]">{selectedLog.user_email}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#F4F4F0]">
                  <span className="text-[#64748B]">Action Type:</span>
                  <span>{getActionBadge(selectedLog.action)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#F4F4F0]">
                  <span className="text-[#64748B]">Retrieved Chunks:</span>
                  <span className="font-mono text-[#0F172A]">
                    {selectedLog.retrieved_chunk_ids?.length || 0}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#F4F4F0]">
                  <span className="text-[#64748B]">Latency:</span>
                  <span className="font-mono text-emerald-600">
                    {selectedLog.latency_ms ? `${selectedLog.latency_ms} ms` : "—"}
                  </span>
                </div>
                <div>
                  <span className="text-[#64748B] block mb-1">Sanitized Prompt / Query Text:</span>
                  <div className="p-3 rounded-xl bg-[#FAF9F6] border border-[#E2E8F0] font-mono text-[11px] text-[#0F172A] whitespace-pre-wrap">
                    {selectedLog.query_text_sanitized || "(No query text recorded)"}
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedLog(null)}
                  className="px-4 py-2 rounded-xl bg-[#0F172A] text-white text-xs font-semibold hover:bg-[#1E293B]"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <AppFooter />
    </div>
  );
}
