import React from "react";

export default function HomePage() {
  const services = [
    {
      name: "Next.js App Router",
      role: "Frontend & BFF Layer",
      status: "Ready",
      port: ":3000",
      color: "border-sky-500/30 text-sky-400 bg-sky-500/10",
    },
    {
      name: "Django 5 + DRF",
      role: "Core Application Server",
      status: "Configured",
      port: ":8000",
      color: "border-emerald-500/30 text-emerald-400 bg-emerald-500/10",
    },
    {
      name: "PostgreSQL 16 + pgvector",
      role: "Vector & RLS Database",
      status: "Integrated",
      port: ":5432",
      color: "border-indigo-500/30 text-indigo-400 bg-indigo-500/10",
    },
    {
      name: "Redis + Celery",
      role: "Asynchronous Pipeline",
      status: "Configured",
      port: ":6379",
      color: "border-amber-500/30 text-amber-400 bg-amber-500/10",
    },
    {
      name: "MinIO S3 Storage",
      role: "Private Encrypted Storage",
      status: "Configured",
      port: ":9000",
      color: "border-violet-500/30 text-violet-400 bg-violet-500/10",
    },
  ];

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#090D16] text-slate-100 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-indigo-600/15 blur-[120px] rounded-full pointer-events-none" />

      <div className="relative z-10 max-w-4xl w-full space-y-10">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs font-medium tracking-wide">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Milestone 0: Foundations Active
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight bg-gradient-to-r from-slate-100 via-slate-200 to-indigo-300 bg-clip-text text-transparent">
            VaultRAG
          </h1>
          <p className="text-slate-400 text-base sm:text-lg max-w-2xl mx-auto">
            Permission-Aware Multi-Tenant RAG Service with SQL-Level Vector
            Pre-Filtering and Database Row-Level Security.
          </p>
        </div>

        {/* Stack Service Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((svc) => (
            <div
              key={svc.name}
              className="p-4 rounded-xl border border-slate-800 bg-[#0F172A]/80 backdrop-blur-sm hover:border-slate-700 transition-colors space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-slate-500">
                  {svc.port}
                </span>
                <span
                  className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${svc.color}`}
                >
                  {svc.status}
                </span>
              </div>
              <h3 className="font-semibold text-slate-200 text-sm">
                {svc.name}
              </h3>
              <p className="text-xs text-slate-400">{svc.role}</p>
            </div>
          ))}
        </div>

        {/* Documentation & Quick Links */}
        <div className="p-6 rounded-2xl border border-slate-800 bg-[#0F172A]/40 backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h4 className="font-semibold text-sm text-slate-200">
              Architecture & Product Specifications
            </h4>
            <p className="text-xs text-slate-400">
              PRD, System Architecture, Coding Rules, Design System, and Project
              Memory are initialized.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/LuckyM09/Permission-Aware-Multi-Tenant-RAG-Service"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
            >
              GitHub Repository
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
