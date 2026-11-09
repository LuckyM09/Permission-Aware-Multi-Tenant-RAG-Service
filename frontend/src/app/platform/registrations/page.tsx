"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, CheckCircle2, Clock, Mail, ShieldCheck, XCircle } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { AppFooter } from "@/components/app-footer";
import { Alert } from "@/components/ui/alert";

type Status = "pending" | "approved" | "rejected";

interface RegistrationItem {
  id: string;
  company_name: string;
  admin_name: string;
  admin_email: string;
  departments: string[];
  status: Status;
  source_ip: string | null;
  decision_note: string;
  created_at: string;
  decided_at: string | null;
}

interface SessionData {
  authenticated: boolean;
  user?: { email: string; is_platform_owner?: boolean };
  context?: { role: string };
  tenants?: Array<{ name: string; is_current: boolean }>;
}

const TABS: Array<{ key: Status; label: string }> = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
];

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "-";

export default function PlatformRegistrationsPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionData | null>(null);
  const [tab, setTab] = useState<Status>("pending");
  const [items, setItems] = useState<RegistrationItem[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ kind: "success" | "destructive"; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) {
          router.replace("/login");
          return;
        }
        setSession(await res.json());
      } catch {
        router.replace("/login");
      }
    })();
  }, [router]);

  const isOwner = Boolean(session?.user?.is_platform_owner);

  const load = useCallback(async (status: Status) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/platform/registrations?status=${status}`);
      const data = await res.json();
      if (!res.ok) {
        setMessage({ kind: "destructive", text: data.detail || data.error || "Could not load requests." });
        setItems([]);
        return;
      }
      setItems(data.results || []);
      setCounts(data.counts || {});
    } catch {
      setMessage({ kind: "destructive", text: "Network error while loading requests." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOwner) load(tab);
  }, [isOwner, tab, load]);

  const decide = async (item: RegistrationItem, action: "approve" | "reject") => {
    if (
      action === "reject" &&
      !window.confirm(`Reject the request from ${item.company_name} (${item.admin_email})?`)
    ) {
      return;
    }
    setBusyId(item.id);
    setMessage(null);
    try {
      const res = await fetch(`/api/platform/registrations/${item.id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: notes[item.id] || "" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ kind: "destructive", text: data.detail || data.error || "Action failed." });
      } else {
        setMessage({
          kind: "success",
          text: `${item.company_name} ${action === "approve" ? "approved. They can sign in now" : "rejected"}.`,
        });
      }
      await load(tab);
    } catch {
      setMessage({ kind: "destructive", text: "Network error. Please try again." });
    } finally {
      setBusyId(null);
    }
  };

  const currentTenant = session?.tenants?.find((t) => t.is_current);

  if (!session) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] flex items-center justify-center text-xs font-mono text-[#64748B]">
        Verifying credentials...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#0F172A] flex flex-col font-sans">
      <AppHeader
        userEmail={session.user?.email}
        tenantName={currentTenant?.name}
        role={session.context?.role}
      />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="space-y-1.5 pb-4 border-b border-[#E6E6E1]">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-[#0284C7]" />
            Registration Requests
          </h1>
          <p className="text-xs sm:text-sm text-[#52525B]">
            Approve or reject people who asked for a workspace. Nobody gets an account or API access until you approve.
          </p>
        </div>

        {!isOwner ? (
          <Alert variant="destructive" title="Not authorized">
            This page is only for the platform owner.
          </Alert>
        ) : (
          <>
            {message && (
              <Alert variant={message.kind} dismissible onDismiss={() => setMessage(null)}>
                {message.text}
              </Alert>
            )}

            <div className="inline-flex rounded-xl bg-white border border-[#E6E6E1] p-1 shadow-xs">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    tab === t.key ? "bg-[#0F172A] text-white" : "text-[#52525B] hover:bg-[#F4F4F0]"
                  }`}
                >
                  {t.label}
                  <span className="ml-1.5 opacity-70">{counts[t.key] ?? 0}</span>
                </button>
              ))}
            </div>

            {loading ? (
              <p className="text-xs font-mono text-[#64748B] py-8">Loading requests...</p>
            ) : items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#E6E6E1] bg-white py-12 text-center text-sm text-[#64748B]">
                No {tab} requests.
              </div>
            ) : (
              <ul className="space-y-4">
                {items.map((item) => (
                  <li key={item.id} className="rounded-2xl border border-[#E6E6E1] bg-white p-5 shadow-xs space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <h2 className="font-bold text-base flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-[#0284C7]" />
                          {item.company_name}
                        </h2>
                        <p className="text-xs text-[#52525B] flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5" />
                          {item.admin_name ? `${item.admin_name} · ` : ""}
                          {item.admin_email}
                        </p>
                      </div>
                      <span className="text-[11px] font-mono text-[#64748B] flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {formatDate(item.created_at)}
                      </span>
                    </div>

                    {item.departments.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {item.departments.map((d) => (
                          <span key={d} className="text-[11px] px-2 py-0.5 rounded-full bg-[#F4F4F0] border border-[#E6E6E1]">
                            {d}
                          </span>
                        ))}
                      </div>
                    )}

                    <p className="text-[11px] font-mono text-[#64748B]">IP: {item.source_ip || "unknown"}</p>

                    {item.status === "pending" ? (
                      <div className="flex flex-col sm:flex-row gap-2 pt-1">
                        <input
                          type="text"
                          value={notes[item.id] || ""}
                          onChange={(e) => setNotes({ ...notes, [item.id]: e.target.value })}
                          placeholder="Optional note (included in the rejection email)"
                          maxLength={500}
                          className="flex-1 rounded-lg border border-[#E6E6E1] px-3 py-2 text-xs outline-none focus:border-[#0284C7]"
                        />
                        <button
                          type="button"
                          disabled={busyId === item.id}
                          onClick={() => decide(item, "approve")}
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4" /> Approve
                        </button>
                        <button
                          type="button"
                          disabled={busyId === item.id}
                          onClick={() => decide(item, "reject")}
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50 cursor-pointer"
                        >
                          <XCircle className="w-4 h-4" /> Reject
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-[#52525B]">
                        {item.status === "approved" ? "Approved" : "Rejected"} on {formatDate(item.decided_at)}
                        {item.decision_note ? ` · Note: ${item.decision_note}` : ""}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </main>

      <AppFooter />
    </div>
  );
}
