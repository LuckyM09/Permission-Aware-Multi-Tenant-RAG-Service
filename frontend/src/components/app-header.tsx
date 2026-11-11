"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Shield,
  MessageSquare,
  FileText,
  Search,
  History,
  Users,
  Menu,
  X,
  ChevronDown,
  LogOut,
  Lock,
  ArrowRight,
  Headphones,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { MorphingMegaMenu } from "@/components/ui/morphing-mega-menu";
import { NotificationBell } from "@/components/ui/notification-bell";
import { HamburgerMenu } from "@/components/ui/hamburger-menu";
import { getCachedAuthSession, clearCachedAuthSession, fetchAuthSession } from "@/lib/auth-session";

// Brand Logo SVG matching the user's "H • Monoline keyhole" design
export function VaultRAGLogo({ className = "h-8" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      <svg
        viewBox="0 0 100 100"
        className="w-7 h-7 sm:w-8 sm:h-8 shrink-0"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <circle
          cx="48"
          cy="52"
          r="34"
          stroke="#0F172A"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <circle
          cx="48"
          cy="42"
          r="9"
          stroke="#0F172A"
          strokeWidth="6"
        />
        <path
          d="M48 51V68"
          stroke="#0F172A"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <circle
          cx="78"
          cy="24"
          r="7"
          fill="#00D2FF"
        />
      </svg>
      <div className="flex items-baseline tracking-tight">
        <span className="font-bold text-lg sm:text-xl text-[#0F172A]">Vault</span>
        <span className="font-extrabold text-lg sm:text-xl text-[#0284C7] ml-0.5">RAG</span>
      </div>
    </div>
  );
}

export interface AppHeaderProps {
  userEmail?: string;
  tenantName?: string;
  role?: string;
  onLogout?: () => void;
}

export function AppHeader({
  userEmail,
  tenantName,
  role,
  onLogout,
}: AppHeaderProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const [supportMessage, setSupportMessage] = useState("");
  const [supportSubmitted, setSupportSubmitted] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isPlatformOwner, setIsPlatformOwner] = useState<boolean>(() => {
    return Boolean(getCachedAuthSession()?.user?.is_platform_owner);
  });

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 15);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!userEmail) return;
    const session = getCachedAuthSession();
    if (session?.user?.is_platform_owner !== undefined) {
      setIsPlatformOwner(Boolean(session.user.is_platform_owner));
      return;
    }
    let cancelled = false;
    fetchAuthSession().then((d) => {
      if (!cancelled) setIsPlatformOwner(Boolean(d?.user?.is_platform_owner));
    }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userEmail]);

  const isAdmin = role?.toLowerCase() === "admin";

  const baseNavItems = isAdmin
    ? [
        { label: "Chat", href: "/chat", icon: MessageSquare },
        { label: "Documents", href: "/documents", icon: FileText },
        { label: "Retrieval", href: "/retrieval", icon: Search },
        { label: "Audit Logs", href: "/audit", icon: History },
        { label: "Tenant Admin", href: "/admin", icon: Users },
      ]
    : [
        { label: "Chat", href: "/chat", icon: MessageSquare },
      ];

  const navItems = isPlatformOwner
    ? [...baseNavItems, { label: "Owner Panel", href: "/platform/registrations", icon: ShieldCheck }]
    : baseNavItems;

  const handleLogoutClick = async () => {
    clearCachedAuthSession();
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Ignore network errors on logout
    }
    if (onLogout) {
      onLogout();
    }
    window.location.href = "/logout";
  };

  return (
    <header className="sticky top-3 sm:top-4 z-40 max-w-5xl xl:max-w-7xl mx-auto px-2 sm:px-4 w-full pointer-events-auto">
      <div
        className={`w-full rounded-2xl border transition-all duration-300 flex items-center justify-between gap-2 sm:gap-4 px-3 sm:px-5 py-2 sm:py-2.5 ${
          isScrolled
            ? "bg-white/95 backdrop-blur-md border-[#E6E6E1] shadow-card"
            : "bg-white/90 backdrop-blur-sm border-[#E6E6E1]/70 shadow-xs"
        }`}
      >
        {/* Brand Logo */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <Link
            href="/"
            className="flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F172A] rounded-md py-0.5"
          >
            <VaultRAGLogo className="h-7 sm:h-8" />
            <span className="text-[10px] text-[#64748B] font-medium hidden lg:inline px-1.5 py-0.5 rounded bg-white border border-[#E6E6E1]">
              Enterprise
            </span>
          </Link>
        </div>

        {/* Center Navigation */}
        {userEmail ? (
          // Authenticated Workspace Navigation Tabs
          <nav
            aria-label="Workspace Navigation"
            className="hidden md:flex items-center gap-1 shrink-0 overflow-x-auto no-scrollbar"
          >
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`whitespace-nowrap shrink-0 px-2.5 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F172A] ${
                    isActive
                      ? "bg-[#0F172A] text-white font-semibold shadow-xs"
                      : "text-[#52525B] hover:text-[#0F172A] hover:bg-[#F4F4F0]"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" strokeWidth={isActive ? 2.2 : 1.75} />
                  <span className="whitespace-nowrap">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        ) : (
          // Unauthenticated / Landing Navigation: Morphing Mega Menu
          <nav
            aria-label="Main Navigation"
            className="hidden md:flex items-center gap-2"
          >
            <MorphingMegaMenu />
          </nav>
        )}

        {/* Right Section */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {userEmail && <NotificationBell userEmail={userEmail} />}

          {/* Active Tenant / Role Chip */}
          {tenantName && (
            <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[#E6E6E1] bg-white text-xs text-[#52525B] shadow-2xs whitespace-nowrap shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="font-medium text-[#0F172A] truncate max-w-[90px]">{tenantName}</span>
              {role && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-[#F4F4F0] text-[#52525B] border border-[#E6E6E1] shrink-0">
                  {role}
                </span>
              )}
            </div>
          )}

          {/* User Profile / Logout */}
          {userEmail ? (
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                aria-expanded={userDropdownOpen}
                aria-haspopup="true"
                aria-label="User account menu"
                className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 rounded-xl border border-[#E6E6E1] bg-white hover:bg-[#F4F4F0] text-xs text-[#0F172A] transition-colors shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F172A] cursor-pointer whitespace-nowrap shrink-0"
              >
                <div className="w-5 h-5 rounded-md bg-[#0F172A] text-white flex items-center justify-center font-bold text-[10px] uppercase shrink-0">
                  {userEmail.charAt(0)}
                </div>
                <span className="font-semibold max-w-[100px] sm:max-w-[150px] truncate hidden sm:inline text-[#0F172A]">
                  {userEmail}
                </span>
                <ChevronDown className="w-3 h-3 text-[#64748B] shrink-0" />
              </button>

              {userDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setUserDropdownOpen(false)}
                    aria-hidden="true"
                  />
                  <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-[#E6E6E1] bg-white p-2 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-3 py-2 border-b border-[#E6E6E1] text-xs">
                      <p className="font-semibold text-[#0F172A] truncate">{userEmail}</p>
                      <p className="text-[11px] text-[#64748B] mt-0.5">
                        {tenantName || "Active Tenant"} • {role || "Member"}
                      </p>
                    </div>
                    <div className="pt-1.5 space-y-0.5">
                      {isAdmin && (
                        <>
                          <Link
                            href="/admin"
                            onClick={() => setUserDropdownOpen(false)}
                            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-[#52525B] hover:text-[#0F172A] hover:bg-[#F4F4F0] transition-colors"
                          >
                            <Users className="w-3.5 h-3.5 text-[#64748B]" />
                            <span>Tenant Settings</span>
                          </Link>
                          <button
                            type="button"
                            onClick={() => {
                              setUserDropdownOpen(false);
                              setSupportModalOpen(true);
                            }}
                            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-[#52525B] hover:text-[#0F172A] hover:bg-[#F4F4F0] transition-colors cursor-pointer text-left"
                          >
                            <Lock className="w-3.5 h-3.5 text-[#64748B]" />
                            <span>Enterprise Support</span>
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setUserDropdownOpen(false);
                          handleLogoutClick();
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 transition-colors font-medium cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="text-xs sm:text-sm font-semibold text-[#52525B] hover:text-[#0F172A] px-2.5 py-1.5 transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#0F172A] hover:bg-[#1E293B] text-xs font-semibold text-white shadow-xs transition-all duration-150 active:scale-[0.98]"
              >
                <span>Register</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#00D2FF]" />
              </Link>
            </div>
          )}

          {/* Mobile Animated Hamburger Menu */}
          <div className="md:hidden flex items-center">
            <HamburgerMenu
              isOpen={mobileMenuOpen}
              onChange={setMobileMenuOpen}
              size={20}
              color="#0F172A"
              className="p-1.5 rounded-xl border border-[#E6E6E1] bg-white hover:bg-[#F4F4F0] text-[#0F172A]"
            />
          </div>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="mt-2 rounded-2xl border border-[#E6E6E1] bg-white/95 backdrop-blur-md p-4 space-y-2 shadow-card md:hidden">
          {tenantName && (
            <div className="px-3 py-1.5 rounded-xl bg-[#FAF9F6] border border-[#E6E6E1] text-xs flex items-center justify-between text-[#52525B] mb-2">
              <span className="font-semibold text-[#0F172A]">{tenantName}</span>
              <span className="font-mono text-[10px] text-[#64748B] uppercase">{role}</span>
            </div>
          )}
          <nav aria-label="Mobile Navigation" className="space-y-0.5">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-[#0F172A] text-white font-semibold shadow-xs"
                      : "text-[#52525B] hover:text-[#0F172A] hover:bg-[#F4F4F0]"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      )}
      {/* Enterprise Support In-App Drawer / Dialog */}
      {supportModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="support-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div
            className="fixed inset-0 -z-10"
            onClick={() => setSupportModalOpen(false)}
            aria-hidden="true"
          />

          <div className="w-full max-w-lg rounded-2xl border border-[#E6E6E1] bg-white p-6 sm:p-7 shadow-2xl relative space-y-5 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#E6E6E1] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-sky-50 border border-sky-100 text-[#0284C7] flex items-center justify-center">
                  <Headphones className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="support-dialog-title" className="text-base font-bold text-[#0F172A]">
                    Enterprise Priority Support
                  </h3>
                  <p className="text-xs text-[#64748B]">
                    {tenantName || "Active Organization"} • 24/7 Dedicated SLA
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSupportModalOpen(false)}
                className="p-1.5 rounded-lg text-[#64748B] hover:text-[#0F172A] hover:bg-[#F4F4F0] transition-colors cursor-pointer"
                aria-label="Close support dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* SLA & Security Metadata */}
            <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/60 text-xs text-emerald-950 flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-semibold">Sub-15 Minute Incident Escalation</p>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  Your tenant has dedicated security engineer routing. On-call compliance hotline:{" "}
                  <code className="font-mono text-[10px] bg-emerald-100/70 px-1 py-0.5 rounded">
                    security-oncall@vaultrag.internal
                  </code>
                </p>
              </div>
            </div>

            {/* Ticket Submission Form */}
            {supportSubmitted ? (
              <div className="py-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-[#0F172A]">Support Request Dispatched</h4>
                <p className="text-xs text-[#52525B] max-w-xs mx-auto">
                  A priority ticket has been created for {userEmail}. A designated security architect will follow up promptly.
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSupportSubmitted(false);
                      setSupportMessage("");
                      setSupportModalOpen(false);
                    }}
                    className="px-4 py-2 rounded-xl bg-[#0F172A] text-white text-xs font-semibold hover:bg-[#1E293B] cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!supportMessage.trim()) return;
                  setSupportSubmitted(true);
                }}
                className="space-y-4"
              >
                <div className="space-y-1.5">
                  <label htmlFor="support-inquiry-text" className="text-xs font-bold text-[#0F172A]">
                    Issue Description or Compliance Inquiry
                  </label>
                  <textarea
                    id="support-inquiry-text"
                    rows={4}
                    value={supportMessage}
                    onChange={(e) => setSupportMessage(e.target.value)}
                    placeholder="e.g. Need permission audit on Finance group documents or assistance configuring pgvector RLS policies..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF9F6] border border-[#E2E8F0] text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#0F172A] focus:bg-white resize-none"
                    required
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <Link
                    href="/#contact"
                    onClick={() => setSupportModalOpen(false)}
                    className="text-xs font-medium text-[#0284C7] hover:underline"
                  >
                    Public Architecture Consultation →
                  </Link>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSupportModalOpen(false)}
                      className="px-3 py-2 rounded-xl border border-[#E6E6E1] bg-white hover:bg-[#FAF9F6] text-xs font-medium text-[#52525B] cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!supportMessage.trim()}
                      className="px-4 py-2 rounded-xl bg-[#0F172A] text-white text-xs font-semibold hover:bg-[#1E293B] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-xs"
                    >
                      Dispatch Request
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
export default AppHeader;
