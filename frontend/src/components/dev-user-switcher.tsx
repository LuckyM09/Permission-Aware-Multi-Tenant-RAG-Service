"use client";

import React, { useState } from "react";

interface Persona {
  id: string;
  name: string;
  email: string;
  tenant: string;
  role: "admin" | "member" | "viewer";
  badge: string;
  color: string;
}

const DEMO_PERSONAS: Persona[] = [
  {
    id: "alice",
    name: "Alice",
    email: "alice@acme.com",
    tenant: "Acme Corp (Tenant A)",
    role: "admin",
    badge: "Admin • HR & Eng",
    color: "border-indigo-500/40 text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20",
  },
  {
    id: "bob",
    name: "Bob",
    email: "bob@acme.com",
    tenant: "Acme Corp (Tenant A)",
    role: "member",
    badge: "Member • Eng Only",
    color: "border-sky-500/40 text-sky-300 bg-sky-500/10 hover:bg-sky-500/20",
  },
  {
    id: "charlie",
    name: "Charlie",
    email: "charlie@acme.com",
    tenant: "Acme Corp (Tenant A)",
    role: "viewer",
    badge: "Viewer • No Groups",
    color: "border-amber-500/40 text-amber-300 bg-amber-500/10 hover:bg-amber-500/20",
  },
  {
    id: "mallory",
    name: "Mallory",
    email: "mallory@betalabs.com",
    tenant: "Beta Labs (Tenant B)",
    role: "member",
    badge: "External Tenant B",
    color: "border-red-500/40 text-red-300 bg-red-500/10 hover:bg-red-500/20",
  },
];

interface DevUserSwitcherProps {
  currentEmail?: string;
  onSwitched?: () => void;
}

export function DevUserSwitcher({ currentEmail, onSwitched }: DevUserSwitcherProps) {
  const [loadingPersona, setLoadingPersona] = useState<string | null>(null);

  const handleSwitch = async (persona: Persona) => {
    setLoadingPersona(persona.id);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: persona.email,
          password: "SecurePassword123!",
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
    <div className="w-full bg-[#0F172A] border-b border-slate-800 px-4 py-2 text-xs">
      <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-300 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            DEV USER SWITCHER:
          </span>
          <span className="text-slate-500 hidden sm:inline">
            Click to simulate multi-tenant persona permissions:
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {DEMO_PERSONAS.map((p) => {
            const isActive = currentEmail === p.email;
            return (
              <button
                key={p.id}
                onClick={() => handleSwitch(p)}
                disabled={loadingPersona !== null}
                className={`px-2.5 py-1 rounded-md border text-[11px] font-medium transition-all flex items-center gap-1.5 ${
                  p.color
                } ${isActive ? "ring-2 ring-white/50 font-bold" : "opacity-80 hover:opacity-100"}`}
              >
                <span>{p.name}</span>
                <span className="text-[10px] text-slate-400">({p.badge})</span>
                {loadingPersona === p.id && (
                  <span className="w-2.5 h-2.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
