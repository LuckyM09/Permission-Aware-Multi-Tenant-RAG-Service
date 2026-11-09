"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  Lock,
  Mail,
  User,
  Shield,
  Layers,
  ArrowRight,
  Plus,
  X,
  CheckCircle2,
  Eye,
  EyeOff,
  Sparkles,
  Loader2,
} from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { AppFooter } from "@/components/app-footer";
import { Alert } from "@/components/ui/alert";
import { LockInput } from "@/components/ui/lock-input";
import { LiquidRippleButton } from "@/components/ui/liquid-ripple-button";

const PRESET_DEPARTMENTS = [
  "Engineering",
  "Finance",
  "Human Resources",
  "Legal & Compliance",
  "Operations",
  "Clinical Research",
];

export default function RegisterPage() {
  const router = useRouter();

  const [currentUserSession, setCurrentUserSession] = useState<{
    authenticated: boolean;
    user?: { email: string; full_name?: string };
    context?: { role: string; is_admin: boolean };
    tenants?: Array<{ name: string; slug: string; is_current: boolean }>;
  } | null>(null);

  React.useEffect(() => {
    document.title = "Register Tenant Organization | VaultRAG Enterprise";

    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : { authenticated: false }))
      .then((data) => {
        if (data?.authenticated) {
          setCurrentUserSession(data);
        }
      })
      .catch(() => {});
  }, []);

  const [companyName, setCompanyName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [departments, setDepartments] = useState<string[]>([
    "Engineering",
    "Finance",
    "Human Resources",
  ]);
  const [customDeptInput, setCustomDeptInput] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false);

  const togglePresetDept = (dept: string) => {
    if (departments.includes(dept)) {
      setDepartments(departments.filter((d) => d !== dept));
    } else {
      setDepartments([...departments, dept]);
    }
  };

  const addCustomDept = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = customDeptInput.trim();
    if (clean && !departments.includes(clean)) {
      setDepartments([...departments, clean]);
      setCustomDeptInput("");
    }
  };

  const removeDept = (dept: string) => {
    setDepartments(departments.filter((d) => d !== dept));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!companyName.trim()) {
      setErrorMessage("Please enter your organization or company name.");
      return;
    }
    if (!adminEmail.trim()) {
      setErrorMessage("Please enter a valid work email address.");
      return;
    }
    if (adminPassword.length < 8) {
      setErrorMessage("Password must be at least 8 characters long.");
      return;
    }
    if (adminPassword !== confirmPassword) {
      setErrorMessage("Passwords do not match. Please verify your entries.");
      return;
    }
    if (departments.length === 0) {
      setErrorMessage("Please select or add at least one department to initialize ACL groups.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: companyName.trim(),
          admin_name: adminName.trim(),
          admin_email: adminEmail.trim().toLowerCase(),
          admin_password: adminPassword,
          departments,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || "Tenant registration failed. Please try again.");
        setLoading(false);
        return;
      }

      if (data.pending) {
        setPending(true);
        setLoading(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/admin");
      }, 1200);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error. Please try again.";
      setErrorMessage(msg);
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

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8 py-10 sm:py-14 relative overflow-hidden">
        {/* Subtle Ambient Glow */}
        <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-96 h-96 bg-[#00D2FF]/5 rounded-full blur-3xl" />

        <div className="w-full max-w-xl p-8 sm:p-10 rounded-2xl border border-[#E6E6E1] bg-white shadow-elevated relative z-10 space-y-6">
          {/* Card Header */}
          <div className="text-center space-y-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0F172A]">
              Register Your Organization
            </h1>
            <p className="text-xs sm:text-sm text-[#52525B] max-w-md mx-auto">
              Provision a cryptographically isolated tenant workspace with row-level security and custom ACL groups.
            </p>
          </div>

          {/* Active Session Notice if already signed in */}
          {currentUserSession?.authenticated && (
            <div className="p-4 sm:p-5 rounded-xl border border-emerald-200 bg-emerald-50/70 text-xs text-[#0F172A] space-y-3">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-emerald-950">
                    You are already signed in as {currentUserSession.user?.email}
                  </p>
                  <p className="text-emerald-800 leading-relaxed">
                    Active Organization: <strong>{currentUserSession.tenants?.find((t) => t.is_current)?.name || "Primary Tenant"}</strong> ({currentUserSession.context?.role || "Admin"}).
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Link
                  href={currentUserSession?.context?.is_admin ? "/admin" : "/chat"}
                  className="px-3.5 py-1.5 rounded-lg bg-[#0F172A] text-white text-xs font-semibold hover:bg-[#1E293B] shadow-xs inline-flex items-center gap-1.5"
                >
                  <span>{currentUserSession?.context?.is_admin ? "Go to Admin Dashboard" : "Open Anti-Leak Chat"}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
                <Link
                  href="/chat"
                  className="px-3 py-1.5 rounded-lg border border-[#E6E6E1] bg-white text-xs font-semibold text-[#0F172A] hover:bg-[#FAF9F6] shadow-2xs"
                >
                  Open Chat
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

          {/* EasyUI Alert on Error */}
          {errorMessage && (
            <Alert
              variant="destructive"
              title="Registration Error"
              dismissible
              onDismiss={() => setErrorMessage(null)}
            >
              {errorMessage}
            </Alert>
          )}

          {pending ? (
            <div className="py-10 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-sky-50 border border-sky-200 text-sky-600 flex items-center justify-center mx-auto shadow-xs">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-[#0F172A]">
                Request received
              </h3>
              <p className="text-xs sm:text-sm text-[#52525B] max-w-sm mx-auto">
                Thanks! Your request for <strong className="text-[#0F172A]">{companyName}</strong> is
                waiting for review. We will email <strong className="text-[#0F172A]">{adminEmail}</strong> once
                it has been approved, and then you can sign in.
              </p>
            </div>
          ) : success ? (
            <div className="py-10 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto transition-transform duration-500 ease-out shadow-xs">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-[#0F172A]">
                Tenant Workspace Provisioned!
              </h3>
              <p className="text-xs sm:text-sm text-[#52525B] max-w-sm mx-auto">
                Your organization <strong className="text-[#0F172A]">{companyName}</strong> has been secured and initialized. Redirecting to your Admin Command Center...
              </p>
              <div className="flex items-center justify-center gap-2 text-xs font-mono text-[#64748B] pt-2">
                <Loader2 className="w-4 h-4 animate-spin text-[#00D2FF]" />
                <span>Configuring encryption keys & PostgreSQL RLS policies...</span>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Section 1: Company Details */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 border-b border-[#E6E6E1] pb-2">
                  <Building2 className="w-4 h-4 text-[#0284C7]" />
                  <span className="text-xs font-bold uppercase tracking-wider text-[#0F172A]">
                    1. Organization Details
                  </span>
                </div>

                <LockInput
                  label="Organization / Company Name"
                  id="reg-company"
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Apex BioTech, Acme Corp"
                  leftIcon={<Building2 className="w-4 h-4" />}
                />
              </div>

              {/* Section 2: Administrator Credentials */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 border-b border-[#E6E6E1] pb-2">
                  <User className="w-4 h-4 text-[#0284C7]" />
                  <span className="text-xs font-bold uppercase tracking-wider text-[#0F172A]">
                    2. Primary Administrator Account
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <LockInput
                    label="Admin Full Name"
                    id="reg-admin-name"
                    type="text"
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    placeholder="Dr. Gregory House"
                    leftIcon={<User className="w-4 h-4" />}
                  />

                  <LockInput
                    label="Work Email Address"
                    id="reg-admin-email"
                    type="email"
                    required
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="gregory@apexbio.com"
                    leftIcon={<Mail className="w-4 h-4" />}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="relative">
                    <LockInput
                      label="Master Password"
                      id="reg-admin-password"
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={8}
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="Min 8 characters"
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

                  <div className="relative">
                    <LockInput
                      label="Confirm Password"
                      id="reg-admin-confirm"
                      type={showConfirmPassword ? "text" : "password"}
                      required
                      minLength={8}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      leftIcon={<Lock className="w-4 h-4" />}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3.5 top-[34px] text-[#94A3B8] hover:text-[#0F172A] transition-colors cursor-pointer z-10"
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Section 3: Departments / Access Control Groups */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 border-b border-[#E6E6E1] pb-2">
                  <Layers className="w-4 h-4 text-[#0284C7]" />
                  <span className="text-xs font-bold uppercase tracking-wider text-[#0F172A]">
                    3. Initial Department Groups
                  </span>
                </div>

                <p className="text-[11px] text-[#52525B]">
                  Select departments to seed initial ACL security boundaries. You can modify these anytime in Admin Settings.
                </p>

                <div className="flex flex-wrap gap-2">
                  {PRESET_DEPARTMENTS.map((dept) => {
                    const isSelected = departments.includes(dept);
                    return (
                      <button
                        key={dept}
                        type="button"
                        onClick={() => togglePresetDept(dept)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                          isSelected
                            ? "bg-[#0F172A] text-white"
                            : "bg-[#FAF9F6] text-[#52525B] border border-[#E6E6E1] hover:bg-white hover:text-[#0F172A]"
                        }`}
                      >
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-[#00D2FF]" />}
                        <span>{dept}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Custom Department Addition */}
                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    value={customDeptInput}
                    onChange={(e) => setCustomDeptInput(e.target.value)}
                    placeholder="Add custom group (e.g. Quality Assurance)"
                    className="flex-1 px-3.5 py-2.5 rounded-xl border border-[#E2E8F0] bg-[#FAF9F6] text-xs sm:text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#0F172A] focus:bg-white transition-all shadow-2xs"
                  />
                  <button
                    type="button"
                    onClick={addCustomDept}
                    className="px-4 py-2.5 rounded-xl bg-white border border-[#E6E6E1] hover:bg-[#FAF9F6] text-xs font-semibold text-[#0F172A] transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#0284C7]" />
                    <span>Add</span>
                  </button>
                </div>

                {/* Configured Groups Display */}
                <div className="p-3 rounded-xl bg-[#FAF9F6] border border-[#E6E6E1] space-y-1.5">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#64748B]">
                    Active Groups ({departments.length})
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {departments.map((dept) => (
                      <span
                        key={dept}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-white text-[#0F172A] border border-[#E6E6E1] shadow-2xs"
                      >
                        <span>{dept}</span>
                        <button
                          type="button"
                          onClick={() => removeDept(dept)}
                          className="text-[#94A3B8] hover:text-rose-600 cursor-pointer ml-0.5"
                          aria-label={`Remove department ${dept}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

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
                    <Loader2 className="w-4 h-4 animate-spin text-[#00D2FF]" />
                    <span>Provisioning Workspace & Keys...</span>
                  </>
                ) : (
                  <>
                    <span>Complete Registration & Open Command Center</span>
                    <ArrowRight className="w-4 h-4 text-[#00D2FF]" />
                  </>
                )}
              </LiquidRippleButton>
            </form>
          )}

          {/* Quick Sign In Link */}
          <div className="pt-4 border-t border-[#E6E6E1] text-center space-y-2">
            <p className="text-xs text-[#52525B]">
              Already have an enterprise tenant account?
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0284C7] hover:text-[#0F172A] underline underline-offset-4 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#00D2FF]" />
              <span>Sign In to Existing Workspace</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </main>

      <AppFooter />
    </div>
  );
}
