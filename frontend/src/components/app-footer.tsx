"use client";

import React from "react";
import Link from "next/link";
import { Github, Mail, Linkedin, Shield } from "lucide-react";

export function AppFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      role="contentinfo"
      aria-label="Site Footer"
      className="border-t border-[#E6E6E1] bg-white text-[#0F172A] shrink-0"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-0 items-start">
          
          {/* LEFT SECTION (Legal & Primary Navigation Block) */}
          <div className="lg:col-span-7 lg:pr-8 flex flex-col justify-between">
            {/* Top Primary Legal / Nav Links with vertical pipes matching London Film School */}
            <nav
              aria-label="Legal and Governance Navigation"
              className="flex flex-wrap items-center gap-x-3 sm:gap-x-4 gap-y-2 text-sm sm:text-base font-bold text-[#0F172A] tracking-tight"
            >
              <Link
                href="/#contact"
                className="hover:text-[#0284C7] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F172A] rounded-sm cursor-pointer"
              >
                Contact
              </Link>
              <span className="text-[#CBD5E1] font-light select-none" aria-hidden="true">|</span>
              
              <Link
                href="/#architecture"
                className="hover:text-[#0284C7] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F172A] rounded-sm cursor-pointer"
              >
                Policies &amp; Governance
              </Link>
              <span className="text-[#CBD5E1] font-light select-none" aria-hidden="true">|</span>

              <Link
                href="/#pipeline"
                className="hover:text-[#0284C7] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F172A] rounded-sm cursor-pointer"
              >
                Security Invariants
              </Link>
              <span className="text-[#CBD5E1] font-light select-none" aria-hidden="true">|</span>

              <Link
                href="/#benchmarks"
                className="hover:text-[#0284C7] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F172A] rounded-sm cursor-pointer"
              >
                Evaluation Report
              </Link>
            </nav>

            {/* Bottom Metadata & Legal Registration Row (Dual sub-columns) */}
            <div className="mt-5 sm:mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-[#64748B] leading-relaxed">
              <div>
                <p className="font-semibold text-[#0F172A]">
                  &copy; Copyright VaultRAG {currentYear}.
                </p>
                <p className="mt-0.5 text-[#64748B]">
                  Engineered with PostgreSQL 16 &amp; pgvector
                </p>
              </div>

              <div>
                <p className="font-semibold text-[#0F172A]">
                  Row-Level Security &amp; Anti-Leak Shield
                </p>
                <p className="mt-0.5 font-mono text-[11px] text-[#64748B]">
                  Zero-Leakage Assurance • Verified Data Privacy
                </p>
              </div>
            </div>
          </div>

          {/* MIDDLE SECTION (Connect & Social Tile Buttons) */}
          <div className="lg:col-span-2 lg:border-l border-[#E6E6E1] lg:pl-8 flex flex-col justify-start">
            <span className="text-xs font-semibold text-[#0F172A] tracking-wider uppercase font-mono">
              Connect
            </span>

            {/* Framed Tile Buttons matching the LFS icon block */}
            <div className="mt-3 flex items-center gap-2.5">
              <a
                href="https://github.com/LuckyM09"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub Profile"
                className="w-10 h-10 rounded-lg bg-[#FAF9F6] border border-[#E6E6E1] flex items-center justify-center text-[#0F172A] hover:bg-[#0F172A] hover:text-[#00D2FF] hover:border-[#0F172A] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F172A] cursor-pointer"
              >
                <Github className="w-4 h-4" />
              </a>

              <a
                href="https://www.linkedin.com/in/lucky-meena-0788b6394/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn Profile"
                className="w-10 h-10 rounded-lg bg-[#FAF9F6] border border-[#E6E6E1] flex items-center justify-center text-[#0F172A] hover:bg-[#0077B5] hover:text-white hover:border-[#0077B5] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F172A] cursor-pointer"
              >
                <Linkedin className="w-4 h-4" />
              </a>

              <a
                href="mailto:luckmeena191@gmail.com"
                aria-label="Email Contact"
                className="w-10 h-10 rounded-lg bg-[#FAF9F6] border border-[#E6E6E1] flex items-center justify-center text-[#0F172A] hover:bg-[#0F172A] hover:text-[#00D2FF] hover:border-[#0F172A] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F172A] cursor-pointer"
              >
                <Mail className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* RIGHT SECTION (Institutional Badges & Core Tech Architecture) */}
          <div className="lg:col-span-3 lg:border-l border-[#E6E6E1] lg:pl-8 flex flex-col justify-start">
            <span className="text-[11px] font-semibold text-[#64748B] tracking-wider uppercase font-mono">
              Architecture Core
            </span>

            {/* Badges matching the Warwick / Exeter institutional placement */}
            <div className="mt-3 flex items-center gap-6">
              {/* PostgreSQL badge */}
              <div className="flex items-center gap-2.5 select-none">
                <div className="w-9 h-9 rounded-lg bg-[#0F172A] text-white flex items-center justify-center font-bold font-mono text-xs tracking-tighter shrink-0 shadow-2xs">
                  PG
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-black tracking-tight uppercase text-[#0F172A] leading-tight">
                    POSTGRESQL
                  </span>
                  <span className="text-[10px] font-mono text-[#64748B] tracking-tight leading-tight">
                    16 • FORCE RLS
                  </span>
                </div>
              </div>

              {/* NVIDIA NIM badge */}
              <div className="flex items-center gap-2.5 select-none">
                <div className="w-9 h-9 rounded-lg bg-[#0284C7] text-white flex items-center justify-center font-bold font-mono text-xs shrink-0 shadow-2xs">
                  <Shield className="w-4 h-4 text-white" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs font-black tracking-tight uppercase text-[#0F172A] leading-tight">
                    NVIDIA NIM
                  </span>
                  <span className="text-[10px] font-mono text-[#64748B] tracking-tight leading-tight">
                    NEMOTRON 3.5
                  </span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </footer>
  );
}
