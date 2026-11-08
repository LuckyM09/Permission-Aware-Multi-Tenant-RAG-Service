"use client";

import React from "react";
import Link from "next/link";
import {
  Shield,
  ArrowLeft,
  MessageSquare,
  FileText,
  Search,
  Users,
  Compass,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { AppFooter } from "@/components/app-footer";

export default function NotFound() {
  const quickLinks = [
    {
      title: "Platform Overview",
      description: "Explore the live security pipeline, 200-query benchmark, and architecture.",
      href: "/",
      icon: Shield,
    },
    {
      title: "Anti-Leak Chat",
      description: "Ask questions to the conversational RAG engine with citation verification.",
      href: "/chat",
      icon: MessageSquare,
    },
    {
      title: "Document Vault",
      description: "Inspect ingested files, visibility boundaries, and vector chunks.",
      href: "/documents",
      icon: FileText,
    },
    {
      title: "Tenant Admin",
      description: "Manage security groups, onboard team members, and simulate permissions.",
      href: "/admin",
      icon: Users,
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF9F6] text-[#0F172A] selection:bg-[#0F172A]/10">
      <AppHeader />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-16 sm:py-24 flex flex-col items-center justify-center text-center space-y-10">
        {/* Kinetic 404 Hero Display */}
        <div className="relative select-none">
          <div className="absolute inset-0 flex items-center justify-center -z-10">
            <div className="w-64 h-64 rounded-full bg-[#00D2FF]/10 blur-3xl" />
          </div>

          <div className="text-8xl sm:text-9xl font-black tracking-tighter text-[#0F172A] opacity-90 drop-shadow-sm font-mono flex items-center justify-center gap-2">
            <span>4</span>
            <div className="relative inline-flex items-center justify-center w-24 h-24 sm:w-32 sm:h-32 rounded-3xl bg-white border border-[#E6E6E1] shadow-card">
              <Compass className="w-14 h-14 sm:w-18 sm:h-18 text-[#00D2FF] animate-[spin_12s_linear_infinite]" />
            </div>
            <span>4</span>
          </div>
        </div>

        {/* Narrative text */}
        <div className="space-y-3 max-w-lg mx-auto">
          <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-[#0F172A]">
            Lost in the Vector Vault
          </h1>
          <p className="text-xs sm:text-sm text-[#52525B] leading-relaxed">
            The page, route, or security endpoint you requested does not exist or has been relocated outside the active tenant boundary.
          </p>
        </div>

        {/* Action Button */}
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#0F172A] hover:bg-[#1E293B] text-white text-xs sm:text-sm font-semibold shadow-xs hover:shadow transition-all duration-150 active:scale-[0.98] cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-[#00D2FF]" />
            <span>Return to Safe Harbor (Overview)</span>
          </Link>
        </div>

        {/* EasyUI Quick Navigation Cards */}
        <div className="w-full pt-6 border-t border-[#E6E6E1] space-y-4">
          <div className="text-left text-xs font-bold uppercase tracking-wider text-[#64748B] font-mono">
            Available Verified Routes
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
            {quickLinks.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.title}
                  href={item.href}
                  className="group p-4 rounded-xl border border-[#E6E6E1] bg-white hover:border-[#0F172A] hover:bg-[#FAF9F6] transition-all duration-150 shadow-card flex items-start gap-3.5"
                >
                  <div className="w-9 h-9 rounded-lg bg-[#FAF9F6] group-hover:bg-white border border-[#E6E6E1] flex items-center justify-center shrink-0 text-[#0284C7] shadow-2xs group-hover:shadow-xs transition-colors">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="space-y-0.5 flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#0F172A] group-hover:text-[#0284C7] transition-colors">
                        {item.title}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-[#94A3B8] group-hover:text-[#0F172A] group-hover:translate-x-0.5 transition-all" />
                    </div>
                    <p className="text-[11px] text-[#52525B] leading-snug">
                      {item.description}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </main>

      <AppFooter />
    </div>
  );
}
