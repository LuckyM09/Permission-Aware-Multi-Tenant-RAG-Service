"use client";

import React, { useState } from "react";
import { UserCheck, ShieldAlert, ChevronDown, ChevronUp } from "lucide-react";

interface Persona {
  id: string;
  name: string;
  email: string;
  tenant: string;
  role: "admin" | "member" | "viewer";
  badge: string;
  description: string;
}

const DEMO_PERSONAS: Persona[] = [
  {
    id: "alice",
    name: "Alice",
    email: "alice@acme.com",
    tenant: "Acme Corp (Tenant A)",
    role: "admin",
    badge: "Admin",
    description: "HR & Engineering Groups • Full Tenant Admin",
  },
  {
    id: "bob",
    name: "Bob",
    email: "bob@acme.com",
    tenant: "Acme Corp (Tenant A)",
    role: "member",
    badge: "Member",
    description: "Engineering Group Only • Denied HR Vault",
  },
  {
    id: "charlie",
    name: "Charlie",
    email: "charlie@acme.com",
    tenant: "Acme Corp (Tenant A)",
    role: "viewer",
    badge: "Viewer",
    description: "Zero Groups • Tenant-Public Docs Only",
  },
  {
    id: "mallory",
    name: "Mallory",
    email: "mallory@betalabs.com",
    tenant: "Beta Labs (Tenant B)",
    role: "member",
    badge: "Tenant B",
    description: "External Tenant B • 100% RLS Isolated",
  },
];

interface DevUserSwitcherProps {
  currentEmail?: string;
  onSwitched?: () => void;
}

export function DevUserSwitcher({ currentEmail, onSwitched }: DevUserSwitcherProps) {
  const [loadingPersona, setLoadingPersona] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  // In production builds, the Dev User Switcher is completely omitted unless explicitly enabled for a demo staging instance
  if (
    typeof process !== "undefined" &&
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PUBLIC_ENABLE_DEMO_SWITCHER !== "true"
  ) {
    return null;
  }

  const handleSwitch = async (persona: Persona) => {
    setLoadingPersona(persona.id);
    try {
      const res = await fetch("/api/auth/dev-switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personaId: persona.id,
        }),
      });

      if (res.ok) {
        if (onSwitched) {
          onSwitched();
        } else {
          window.location.reload();
        }
      }
    } catch (err) {
      console.error("Failed to switch persona:", err);
    } finally {
      setLoadingPersona(null);
    }
  };

  return (
    <section
      role="region"
      aria-label="Development Persona Simulator"
      className="w-full bg-[#F4F4F0] border-b border-[#E6E6E1] text-xs text-[#52525B] shrink-0"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-1.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-[#64748B] font-bold">
            Simulate Persona:
          </span>
          <span className="text-[11px] text-[#64748B] hidden lg:inline">
            Test multi-tenant ACL &amp; PostgreSQL RLS isolation:
          </span>
        </div>

        <div className="flex items-center gap-2">
          {!isCollapsed && (
            <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label="Personas">
              {DEMO_PERSONAS.map((p) => {
                const isActive = currentEmail === p.email;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSwitch(p)}
                    disabled={loadingPersona !== null}
                    aria-pressed={isActive}
                    title={`${p.name} (${p.email}) - ${p.description}`}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-150 flex items-center gap-1.5 border active:scale-95 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#0F172A] ${
                      isActive
                        ? "bg-white border-[#0F172A] text-[#0F172A] font-bold shadow-xs"
                        : p.id === "mallory"
                        ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                        : "border-[#E6E6E1] bg-white text-[#52525B] hover:text-[#0F172A] hover:bg-[#FAF9F6]"
                    }`}
                  >
                    {isActive ? (
                      <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                    ) : p.id === "mallory" ? (
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                    ) : null}
                    <span>{p.name}</span>
                    <span className="text-[10px] text-[#64748B] font-mono">[{p.badge}]</span>
                    {loadingPersona === p.id && (
                      <span
                        className="w-2.5 h-2.5 border border-current border-t-transparent rounded-full animate-spin ml-0.5"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            aria-label={isCollapsed ? "Expand dev persona bar" : "Collapse dev persona bar"}
            className="p-1 rounded text-[#64748B] hover:text-[#0F172A] hover:bg-white transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#0F172A] cursor-pointer"
          >
            {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </section>
  );
}
