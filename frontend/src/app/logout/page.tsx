"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Lock,
  ArrowRight,
  Home,
  Sparkles,
  CheckCircle2,
  KeyRound,
  RotateCcw,
} from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { AppFooter } from "@/components/app-footer";
import { Alert } from "@/components/ui/alert";

export default function LogoutPage() {
  const [loggedOut, setLoggedOut] = useState(false);

  useEffect(() => {
    document.title = "Signed Out | VaultRAG Enterprise";
    // Trigger logout purge on mount
    fetch("/api/auth/logout", { method: "POST" })
      .then(() => setLoggedOut(true))
      .catch(() => setLoggedOut(true));
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF9F6] text-[#0F172A] selection:bg-[#0F172A]/10">
      <AppHeader />

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 py-10 sm:py-14 relative overflow-hidden">
        {/* Subtle Ambient Glow */}
        <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-96 h-96 bg-[#00D2FF]/5 rounded-full blur-3xl" />

        <div className="w-full max-w-md p-8 sm:p-10 rounded-2xl border border-[#E6E6E1] bg-white shadow-elevated relative z-10 space-y-6 text-center">
          {/* Animated Icon Avatar */}
          <div className="w-16 h-16 rounded-2xl bg-[#FAF9F6] border border-[#E6E6E1] text-[#0F172A] flex items-center justify-center mx-auto shadow-xs relative">
            <ShieldCheck className="w-8 h-8 text-emerald-600" />
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white" />
          </div>

          {/* Card Title & Description */}
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0F172A]">
              You Have Signed Out
            </h1>
            <p className="text-xs sm:text-sm text-[#52525B] max-w-xs mx-auto leading-relaxed">
              Your tenant session cookies and encryption keys have been revoked from this browser.
            </p>
          </div>

          {/* Security Notice */}
          <Alert variant="info" title="Zero Local Cache Retained">
            Row-level security context has been reset. To query enterprise vaults again, please authenticate.
          </Alert>

          {/* Action Buttons */}
          <div className="space-y-3 pt-2">
            <Link
              href="/login"
              className="w-full py-3.5 px-4 rounded-xl bg-[#0F172A] hover:bg-[#1E293B] text-white font-semibold text-xs sm:text-sm shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <KeyRound className="w-4 h-4 text-[#00D2FF]" />
              <span>Sign In to Workspace</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              href="/"
              className="w-full py-3 px-4 rounded-xl border border-[#E6E6E1] bg-white hover:bg-[#FAF9F6] text-[#0F172A] font-semibold text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
            >
              <Home className="w-4 h-4 text-[#64748B]" />
              <span>Return to Home</span>
            </Link>
          </div>

          {/* Quick Registration Link */}
          <div className="pt-4 border-t border-[#E6E6E1] space-y-1">
            <p className="text-xs text-[#52525B]">Need to create a new organization?</p>
            <Link
              href="/register"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#0284C7] hover:text-[#0F172A] underline underline-offset-4 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#00D2FF]" />
              <span>Register new tenant workspace</span>
            </Link>
          </div>
        </div>
      </main>

      <AppFooter />
    </div>
  );
}

