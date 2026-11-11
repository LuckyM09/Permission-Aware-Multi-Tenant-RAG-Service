"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Shield,
  Lock,
  ArrowRight,
  AlertCircle,
  Building2,
  Mail,
  Eye,
  EyeOff,
  User,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { AppFooter } from "@/components/app-footer";
import { Alert } from "@/components/ui/alert";
import { LockInput } from "@/components/ui/lock-input";
import { LiquidRippleButton } from "@/components/ui/liquid-ripple-button";
import { fetchAuthSession } from "@/lib/auth-session";

export default function LoginPage() {
  const router = useRouter();

  const [currentUserSession, setCurrentUserSession] = useState<{
    authenticated: boolean;
    user?: { email: string; full_name?: string };
    context?: { role: string; is_admin: boolean };
    tenants?: Array<{ name: string; slug: string; is_current: boolean }>;
  } | null>(null);

  React.useEffect(() => {
    document.title = "Sign In | VaultRAG Enterprise";

    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : { authenticated: false }))
      .then((data) => {
        if (data?.authenticated) {
          setCurrentUserSession(data);
        }
      })
      .catch(() => {});
  }, []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tenantSlug, setTenantSlug] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          tenant_slug: tenantSlug.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Authentication failed. Check your email, password, and organization slug.");
      }

      await fetchAuthSession(true);

      const userRole = data.tenant?.role || data.context?.role || data.user?.role;
      if (userRole === "admin") {
        router.push("/admin");
      } else {
        router.push("/chat");
      }
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to sign in. Verify your credentials and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF9F6] text-[#0F172A] selection:bg-[#0F172A]/10">
      <AppHeader
        userEmail={currentUserSession?.user?.email}
        tenantName={currentUserSession?.tenants?.find((t) => t.is_current)?.name}
        role={currentUserSession?.context?.role}
      />

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 py-10 sm:py-14 relative overflow-hidden">
        {/* Subtle Ambient Glow */}
        <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-96 h-96 bg-[#00D2FF]/5 rounded-full blur-3xl" />

        <div className="w-full max-w-md p-8 sm:p-10 rounded-2xl border border-[#E6E6E1] bg-white shadow-elevated relative z-10 space-y-6">
          {/* Card Header */}
          <div className="text-center space-y-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0F172A]">
              Sign In to Your Workspace
            </h1>
            <p className="text-xs sm:text-sm text-[#52525B]">
              Authenticate with your tenant-scoped enterprise credentials
            </p>
          </div>

          {/* Already Logged In Notice */}
          {currentUserSession?.authenticated && (
            <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/70 text-xs text-[#0F172A] space-y-3">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-emerald-950">
                    Already signed in as {currentUserSession.user?.email}
                  </p>
                  <p className="text-emerald-800 text-[11px] mt-0.5">
                    Tenant: <strong>{currentUserSession.tenants?.find((t) => t.is_current)?.name || "Active Workspace"}</strong>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Link
                  href={currentUserSession?.context?.is_admin ? "/admin" : "/chat"}
                  className="px-3.5 py-1.5 rounded-lg bg-[#0F172A] text-white text-xs font-semibold hover:bg-[#1E293B] shadow-xs inline-flex items-center gap-1.5"
                >
                  <span>{currentUserSession?.context?.is_admin ? "Continue to Admin Dashboard" : "Open Secure Chat"}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                <button
                  type="button"
                  onClick={async () => {
                    await fetch("/api/auth/logout", { method: "POST" });
                    window.location.href = "/logout";
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                >
                  Sign Out
                </button>
              </div>
            </div>
          )}

          {/* EasyUI Alert Component */}
          {error && (
            <Alert variant="destructive" title="Authentication Error" dismissible onDismiss={() => setError(null)}>
              {error}
            </Alert>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Work Email */}
            <LockInput
              label="Work Email"
              id="login-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="gregory@apexbio.com or alice@acme.com"
              leftIcon={<Mail className="w-4 h-4" />}
            />

            {/* Password */}
            <div className="relative">
              <LockInput
                label="Password"
                id="login-password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                leftIcon={<Lock className="w-4 h-4" />}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-[34px] text-[#94A3B8] hover:text-[#0F172A] transition-colors cursor-pointer z-10"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Optional Organization Slug */}
            <LockInput
              label="Organization Slug (Optional)"
              description="Leave blank for default primary organization (e.g. apex-biotech)"
              id="login-tenant"
              type="text"
              autoComplete="organization"
              value={tenantSlug}
              onChange={(e) => setTenantSlug(e.target.value)}
              placeholder="apex-biotech"
              leftIcon={<Building2 className="w-4 h-4" />}
            />

            {/* Submit Button */}
            <LiquidRippleButton
              type="submit"
              variant="dark"
              disabled={loading}
              showIcon={false}
              className="w-full min-h-12 py-3 px-4 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Authenticating Session...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Workspace</span>
                  <ArrowRight className="w-4 h-4 text-[#00D2FF]" />
                </>
              )}
            </LiquidRippleButton>
          </form>

          {/* Quick Registration Link */}
          <div className="pt-4 border-t border-[#E6E6E1] text-center space-y-2">
            <p className="text-xs text-[#52525B]">
              Need to register a new company or workspace?
            </p>
            <Link
              href="/register"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0284C7] hover:text-[#0F172A] underline underline-offset-4 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#00D2FF]" />
              <span>Create Tenant Organization & Workspace</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </main>

      <AppFooter />
    </div>
  );
}
