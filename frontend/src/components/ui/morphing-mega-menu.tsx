"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Shield,
  MessageSquare,
  FileText,
  Search,
  History,
  Users,
  Lock,
  ArrowRight,
  Database,
  Cpu,
  Layers,
  ChevronDown,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MenuItem {
  title: string;
  description: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
}

interface MenuSection {
  id: string;
  label: string;
  items: MenuItem[];
  featured?: {
    title: string;
    description: string;
    href: string;
    cta: string;
  };
}

const MENU_SECTIONS: MenuSection[] = [
  {
    id: "platform",
    label: "Platform",
    items: [
      {
        title: "Anti-Leak Security",
        description: "Strict isolation prevents unauthorized data leaks across teams.",
        href: "/#pipeline",
        icon: Shield,
        badge: "Core",
      },
      {
        title: "Document Access Control",
        description: "Role-based visibility ensures members only see authorized files.",
        href: "/#architecture",
        icon: FileText,
      },
      {
        title: "Verified Search & Answers",
        description: "Precise document search with guaranteed citation accuracy.",
        href: "/#benchmarks",
        icon: Search,
      },
      {
        title: "Compliance & Audit Trail",
        description: "Tamper-evident activity logs for enterprise security compliance.",
        href: "/#architecture",
        icon: History,
      },
    ],
    featured: {
      title: "Interactive Permission Demo",
      description: "See how department access and role permissions work in real time.",
      href: "/#simulator",
      cta: "Try Interactive Demo",
    },
  },
  {
    id: "security",
    label: "Security",
    items: [
      {
        title: "Database-Level Isolation",
        description: "Storage-level row filtering blocks leaks at the database layer.",
        href: "/#pipeline",
        icon: Database,
        badge: "Protected",
      },
      {
        title: "Permission Pre-Filter",
        description: "Access controls are evaluated before documents are searched.",
        href: "/#pipeline",
        icon: Cpu,
      },
      {
        title: "Department & Role Controls",
        description: "Custom groups and role boundaries tailored to your organization.",
        href: "/#architecture",
        icon: Users,
      },
      {
        title: "Citation Verification Shield",
        description: "Every AI response is cross-checked to eliminate hallucinations.",
        href: "/#architecture",
        icon: Lock,
      },
    ],
    featured: {
      title: "200-Query Benchmark",
      description: "0.00% data leakage verified across adversarial testing.",
      href: "/#benchmarks",
      cta: "View Metrics",
    },
  },
  {
    id: "organization",
    label: "Get Started",
    items: [
      {
        title: "Register Organization",
        description: "Provision a private company workspace in under 60 seconds.",
        href: "/register",
        icon: Sparkles,
        badge: "Self-Serve",
      },
      {
        title: "Sign In to Workspace",
        description: "Access your company's secure document intelligence portal.",
        href: "/login",
        icon: ArrowRight,
      },
      {
        title: "Live Permission Simulator",
        description: "Test department access and permissions interactively.",
        href: "/#simulator",
        icon: Layers,
      },
    ],
  },
];

export function MorphingMegaMenu({ className }: { className?: string }) {
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<number>(0);
  const navRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = (sectionId: string, event: React.MouseEvent<HTMLButtonElement>) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    const rect = event.currentTarget.getBoundingClientRect();
    if (navRef.current) {
      const parentRect = navRef.current.getBoundingClientRect();
      setMenuPosition(rect.left - parentRect.left + rect.width / 2);
    }
    setActiveSection(sectionId);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setActiveSection(null);
    }, 180);
  };

  const activeData = MENU_SECTIONS.find((s) => s.id === activeSection);

  return (
    <div
      ref={navRef}
      onMouseLeave={handleMouseLeave}
      className={cn("relative hidden md:flex items-center", className)}
    >
      {/* Trigger Buttons */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-white/70 border border-[#E6E6E1] shadow-2xs backdrop-blur-md">
        {MENU_SECTIONS.map((section) => {
          const isActive = activeSection === section.id;
          return (
            <button
              key={section.id}
              type="button"
              onMouseEnter={(e) => handleMouseEnter(section.id, e)}
              className={cn(
                "relative px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center gap-1 cursor-pointer select-none",
                isActive
                  ? "text-[#0F172A] bg-[#FAF9F6] shadow-xs"
                  : "text-[#52525B] hover:text-[#0F172A] hover:bg-[#FAF9F6]/60"
              )}
            >
              <span>{section.label}</span>
              <ChevronDown
                className={cn(
                  "w-3 h-3 text-[#94A3B8] transition-transform duration-200",
                  isActive && "rotate-180 text-[#0F172A]"
                )}
              />
            </button>
          );
        })}
      </div>

      {/* Morphing Floating Panel Dropdown */}
      <div
        className={cn(
          "absolute top-full pt-3 z-50 transition-all duration-200 ease-out",
          activeSection
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 -translate-y-2 pointer-events-none"
        )}
        style={{
          left: `${menuPosition}px`,
          transform: "translateX(-50%)",
        }}
      >
        {activeData && (
          <div className="w-[490px] rounded-2xl border border-[#E6E6E1] bg-white p-5 shadow-elevated overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Pointer arrow */}
            <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-t border-l border-[#E6E6E1] rotate-45" />

            <div className="space-y-4">
              {/* Category Header */}
              <div className="flex items-center justify-between border-b border-[#E6E6E1] pb-2.5">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#0284C7]">
                  {activeData.label} Capabilities
                </span>
                <span className="text-[10px] text-[#64748B] font-mono">
                  Enterprise Data Protection
                </span>
              </div>

              {/* Items Grid */}
              <div className="grid grid-cols-2 gap-2">
                {activeData.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.title}
                      href={item.href}
                      onClick={() => setActiveSection(null)}
                      className="group p-2.5 rounded-xl border border-transparent hover:border-[#E6E6E1] hover:bg-[#FAF9F6] transition-all flex items-start gap-3"
                    >
                      <div className="w-8 h-8 rounded-lg bg-[#FAF9F6] group-hover:bg-white border border-[#E6E6E1] flex items-center justify-center shrink-0 shadow-2xs group-hover:shadow-xs transition-colors">
                        <Icon className="w-4 h-4 text-[#0F172A] group-hover:text-[#0284C7] transition-colors" />
                      </div>
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-[#0F172A] group-hover:text-[#0284C7] transition-colors truncate">
                            {item.title}
                          </span>
                          {item.badge && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-medium bg-sky-50 text-sky-800 border border-sky-200">
                              {item.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#52525B] leading-snug line-clamp-2">
                          {item.description}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>

              {/* Featured bottom highlight if available */}
              {activeData.featured && (
                <div className="pt-3 border-t border-[#E6E6E1] flex items-center justify-between bg-[#FAF9F6] -mx-5 -mb-5 px-5 py-3 rounded-b-2xl">
                  <div>
                    <div className="text-xs font-bold text-[#0F172A]">
                      {activeData.featured.title}
                    </div>
                    <div className="text-[11px] text-[#52525B]">
                      {activeData.featured.description}
                    </div>
                  </div>
                  <Link
                    href={activeData.featured.href}
                    onClick={() => setActiveSection(null)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#0F172A] hover:bg-[#1E293B] text-white text-[11px] font-semibold transition-colors shadow-2xs shrink-0"
                  >
                    <span>{activeData.featured.cta}</span>
                    <ArrowRight className="w-3 h-3 text-[#00D2FF]" />
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default MorphingMegaMenu;

