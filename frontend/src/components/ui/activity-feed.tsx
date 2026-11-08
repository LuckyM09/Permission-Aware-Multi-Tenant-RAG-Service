"use client";

import React, { useState } from "react";
import {
  Search,
  FileText,
  Trash2,
  Key,
  Shield,
  Clock,
  ChevronDown,
  ChevronUp,
  Activity,
  Layers,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface ActivityEvent {
  id: string;
  tenant_id: string;
  user_email: string;
  action: "query" | "ingest" | "delete_document" | "login" | "grant_permission" | "revoke_permission" | string;
  query_text_sanitized: string;
  retrieved_chunk_ids?: string[];
  denied_chunk_count?: number;
  ip_address?: string | null;
  latency_ms?: number | null;
  created_at: string;
  metadata?: Record<string, unknown>;
}

interface ActivityFeedProps {
  events: ActivityEvent[];
  loading?: boolean;
  onSelectEvent?: (event: ActivityEvent) => void;
  className?: string;
}

export function ActivityFeed({
  events,
  loading = false,
  onSelectEvent,
  className,
}: ActivityFeedProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const getActionConfig = (action: string) => {
    switch (action) {
      case "query":
        return {
          icon: Search,
          label: "Query",
          badgeClass: "bg-sky-50 text-sky-800 border-sky-200",
          nodeColor: "bg-[#0284C7]",
        };
      case "ingest":
        return {
          icon: FileText,
          label: "Ingest",
          badgeClass: "bg-emerald-50 text-emerald-800 border-emerald-200",
          nodeColor: "bg-emerald-500",
        };
      case "delete_document":
        return {
          icon: Trash2,
          label: "Delete",
          badgeClass: "bg-rose-50 text-rose-800 border-rose-200",
          nodeColor: "bg-rose-500",
        };
      case "login":
        return {
          icon: Key,
          label: "Auth",
          badgeClass: "bg-purple-50 text-purple-800 border-purple-200",
          nodeColor: "bg-purple-500",
        };
      case "grant_permission":
      case "revoke_permission":
        return {
          icon: Shield,
          label: "ACL Policy",
          badgeClass: "bg-amber-50 text-amber-800 border-amber-200",
          nodeColor: "bg-amber-500",
        };
      default:
        return {
          icon: Activity,
          label: action,
          badgeClass: "bg-[#FAF9F6] text-[#52525B] border-[#E6E6E1]",
          nodeColor: "bg-[#64748B]",
        };
    }
  };

  if (loading) {
    return (
      <div className="py-16 text-center space-y-3">
        <div className="w-6 h-6 border-2 border-[#0F172A] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-[#64748B] font-mono">Streaming compliance activity feed...</p>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="py-14 text-center rounded-2xl border border-dashed border-[#E6E6E1] bg-white p-6 space-y-2">
        <Activity className="w-8 h-8 text-[#94A3B8] mx-auto" />
        <h4 className="text-xs font-bold text-[#0F172A]">No recorded activity events found</h4>
        <p className="text-[11px] text-[#64748B]">Events will stream here in real time as queries and ingestions occur.</p>
      </div>
    );
  }

  return (
    <div className={cn("relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-px before:bg-[#E6E6E1]", className)}>
      {events.map((event) => {
        const config = getActionConfig(event.action);
        const Icon = config.icon;
        const isExpanded = expandedId === event.id;

        return (
          <div key={event.id} className="relative group">
            {/* Timeline Node Bullet */}
            <div
              className={cn(
                "absolute -left-6 top-3.5 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center shadow-xs transition-transform group-hover:scale-110",
                config.nodeColor
              )}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-white" />
            </div>

            {/* Event Card */}
            <div className="rounded-xl border border-[#E6E6E1] bg-white p-4 shadow-card hover:border-[#CBD5E1] transition-all space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-mono font-bold border",
                      config.badgeClass
                    )}
                  >
                    <Icon className="w-3 h-3" />
                    <span>{config.label}</span>
                  </span>

                  <span className="text-xs font-semibold text-[#0F172A] truncate">
                    {event.user_email || "System"}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-[11px] font-mono text-[#64748B]">
                  {event.latency_ms != null && (
                    <span className="px-1.5 py-0.5 rounded bg-[#FAF9F6] border border-[#E6E6E1] text-[#0F172A] font-semibold">
                      {event.latency_ms.toFixed(1)} ms
                    </span>
                  )}
                  <span>{new Date(event.created_at).toLocaleTimeString()}</span>
                </div>
              </div>

              {/* Sanitized Text Summary */}
              <p className="text-xs text-[#52525B] leading-relaxed break-words font-mono bg-[#FAF9F6] p-2.5 rounded-lg border border-[#E6E6E1]">
                {event.query_text_sanitized}
              </p>

              {/* Action Buttons & Quick Stats */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-3 text-[11px] text-[#64748B]">
                  {event.retrieved_chunk_ids && (
                    <span>
                      Retrieved: <strong className="text-[#0F172A]">{event.retrieved_chunk_ids.length} chunks</strong>
                    </span>
                  )}
                  {event.denied_chunk_count ? (
                    <span className="text-rose-600 font-semibold">
                      Denied: {event.denied_chunk_count}
                    </span>
                  ) : null}
                </div>

                <div className="flex items-center gap-2">
                  {onSelectEvent && (
                    <button
                      type="button"
                      onClick={() => onSelectEvent(event)}
                      className="text-xs font-semibold text-[#0284C7] hover:text-[#0F172A] cursor-pointer"
                    >
                      Inspect
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => toggleExpand(event.id)}
                    className="p-1 rounded-md text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#FAF9F6] transition-colors cursor-pointer"
                  >
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Expanded JSON Inspector */}
              {isExpanded && (
                <div className="pt-2 border-t border-[#E6E6E1] space-y-2 animate-in fade-in duration-150">
                  <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#64748B]">
                    Cryptographic Ledger Event Payload
                  </div>
                  <pre className="p-3 rounded-lg bg-[#0F172A] text-[#FAF9F6] text-[10px] font-mono overflow-x-auto leading-relaxed">
                    {JSON.stringify(event, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default ActivityFeed;

