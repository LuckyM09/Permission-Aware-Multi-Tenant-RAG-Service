"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { DevUserSwitcher } from "@/components/dev-user-switcher";

interface UserContextData {
  authenticated: boolean;
  user?: {
    id: string;
    email: string;
    full_name: string;
  };
  context?: {
    tenant_id: string;
    role: string;
    is_admin: boolean;
    group_ids: string[];
    groups: string[];
  };
  tenants?: Array<{
    id: string;
    name: string;
    slug: string;
    role: string;
    is_current: boolean;
  }>;
}

interface DocumentItem {
  id: string;
  title: string;
  file_type: string;
  file_size: number;
  visibility: "private" | "group" | "tenant";
  status: "uploaded" | "processing" | "ready" | "failed";
  chunk_count: number;
  error_message: string;
  created_at: string;
  owner_email: string;
  permission_groups?: Array<{ id: string; name: string }>;
}

export default function DocumentsPage() {
  const [authData, setAuthData] = useState<UserContextData | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [filterQuery, setFilterQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Upload Form State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [visibility, setVisibility] = useState<"private" | "group" | "tenant">("private");
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  // Deletion State
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch session context
  const fetchSession = useCallback(async () => {
    try {
      setAuthLoading(true);
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setAuthData(data);
      } else {
        setAuthData({ authenticated: false });
      }
    } catch {
      setAuthData({ authenticated: false });
    } finally {
      setAuthLoading(false);
    }
  }, []);

  // Fetch documents list
  const fetchDocuments = useCallback(async () => {
    try {
      const res = await fetch("/api/documents");
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      }
    } catch {
      // ignore network errors
    } finally {
      setDocsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  useEffect(() => {
    if (authData?.authenticated) {
      fetchDocuments();
    }
  }, [authData?.authenticated, fetchDocuments]);

  // Polling hook: If any doc is "processing" or "uploaded", poll every 2.5s
  useEffect(() => {
    const hasPending = documents.some(
      (doc) => doc.status === "processing" || doc.status === "uploaded"
    );

    if (!hasPending) return;

    const interval = setInterval(() => {
      fetchDocuments();
    }, 2500);

    return () => clearInterval(interval);
  }, [documents, fetchDocuments]);

  // File selection
  const handleFileChange = (file: File) => {
    setSelectedFile(file);
    setUploadError("");
    setUploadSuccess("");
    if (!title) {
      // Default title to base file name without extension
      const cleanName = file.name.replace(/\.[^/.]+$/, "");
      setTitle(cleanName);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setUploadError("Please choose a file to upload.");
      return;
    }

    setIsUploading(true);
    setUploadError("");
    setUploadSuccess("");

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("title", title || selectedFile.name);
      formData.append("visibility", visibility);

      if (visibility === "group") {
        selectedGroupIds.forEach((gid) => {
          formData.append("group_ids", gid);
        });
      }

      const res = await fetch("/api/documents", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setUploadError(data.error || data.detail || "Upload failed. Please check file format.");
      } else {
        setUploadSuccess(
          data.deduplicated
            ? "Duplicate content detected: Document linked instantly."
            : "Document uploaded! Ingestion & chunking pipeline started."
        );
        setSelectedFile(null);
        setTitle("");
        setSelectedGroupIds([]);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        fetchDocuments();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Network error during upload";
      setUploadError(message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (docId: string) => {
    if (!confirm("Are you sure you want to delete this document and its chunk embeddings?")) {
      return;
    }
    setDeletingId(docId);
    try {
      const res = await fetch(`/api/documents/${docId}`, { method: "DELETE" });
      if (res.ok) {
        setDocuments((prev) => prev.filter((d) => d.id !== docId));
      } else {
        alert("Failed to delete document. Ensure you have admin or owner privileges.");
      }
    } catch {
      alert("Error contacting server.");
    } finally {
      setDeletingId(null);
    }
  };

  // Group selector toggle
  const toggleGroupSelection = (groupId: string) => {
    setSelectedGroupIds((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]
    );
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  // Filter documents
  const filteredDocuments = documents.filter((doc) => {
    const matchesQuery =
      doc.title.toLowerCase().includes(filterQuery.toLowerCase()) ||
      doc.owner_email?.toLowerCase().includes(filterQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || doc.status === statusFilter;
    return matchesQuery && matchesStatus;
  });

  const currentTenant = authData?.tenants?.find((t) => t.is_current);

  return (
    <div className="min-h-screen flex flex-col bg-[#090D16] text-slate-100 selection:bg-indigo-500 selection:text-white">
      {/* Dev User Switcher */}
      <DevUserSwitcher
        currentEmail={authData?.user?.email}
        onSwitched={() => {
          fetchSession();
          fetchDocuments();
        }}
      />

      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-[#0F172A]/80 backdrop-blur-md sticky top-10 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="text-lg font-bold tracking-tight text-white hover:text-indigo-400 transition-colors flex items-center gap-2"
            >
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-black text-white text-base shadow-md shadow-indigo-600/30">
                V
              </div>
              <span>VaultRAG</span>
            </Link>

            <nav className="flex items-center gap-1 text-sm font-medium">
              <Link
                href="/"
                className="px-3 py-1.5 rounded-md text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-all"
              >
                Overview
              </Link>
              <Link
                href="/documents"
                className="px-3 py-1.5 rounded-md bg-indigo-500/10 text-indigo-400 font-semibold border border-indigo-500/20"
              >
                Documents & Ingestion
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            {authData?.authenticated && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400">Org:</span>
                <span className="px-2 py-0.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 font-medium">
                  {currentTenant?.name || "Acme Corp"}
                </span>
                <span className="text-slate-500">|</span>
                <span className="text-slate-300 font-medium">{authData.user?.email}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs font-medium tracking-wide mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Milestone 2: Ingestion & Embeddings
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">
              Document Knowledge Base
            </h1>
            <p className="text-slate-400 text-sm mt-1 max-w-2xl">
              Upload PDF, DOCX, TXT, or Markdown documents. Files are validated via magic-bytes,
              chunked, and embedded into 1,536-dimensional vectors with tenant and ACL tags.
            </p>
          </div>

          <button
            onClick={() => fetchDocuments()}
            className="self-start md:self-auto inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all shadow-sm"
          >
            <svg
              className="w-3.5 h-3.5 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Refresh Pipeline
          </button>
        </div>

        {/* Upload Dropzone Section */}
        <div className="p-6 rounded-2xl border border-slate-800 bg-[#0F172A]/90 backdrop-blur-md shadow-xl space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">
                Upload New Document
              </h2>
              <p className="text-xs text-slate-400">
                Supported formats: PDF, DOCX, Markdown, Text (Max 20MB)
              </p>
            </div>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
              SHA-256 Deduplicated
            </span>
          </div>

          <form onSubmit={handleUpload} className="space-y-5">
            {/* Drag & Drop Area */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                isDragging
                  ? "border-indigo-400 bg-indigo-500/10 shadow-lg shadow-indigo-500/10"
                  : selectedFile
                  ? "border-emerald-500/50 bg-emerald-500/5"
                  : "border-slate-700 hover:border-slate-500 bg-slate-900/40"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt,.md"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    handleFileChange(e.target.files[0]);
                  }
                }}
                className="hidden"
              />

              {selectedFile ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                    ✓
                  </div>
                  <p className="text-sm font-semibold text-emerald-300">{selectedFile.name}</p>
                  <p className="text-xs text-slate-400">
                    {formatFileSize(selectedFile.size)} • Click or drop another to replace
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-full bg-indigo-600/20 text-indigo-400 flex items-center justify-center mb-1">
                    <svg
                      className="w-6 h-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-slate-200">
                    <span className="text-indigo-400 font-semibold">Click to upload</span> or drag
                    and drop files here
                  </p>
                  <p className="text-xs text-slate-500">
                    Automatic Magic-Byte signature validation & parsing
                  </p>
                </div>
              )}
            </div>

            {/* Form Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Title */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Document Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Q3 Architecture RFC"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>

              {/* Visibility Scope */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                  Access Visibility Scope
                </label>
                <select
                  value={visibility}
                  onChange={(e) =>
                    setVisibility(e.target.value as "private" | "group" | "tenant")
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 transition-colors"
                >
                  <option value="private">🔒 Private — Only you (the owner) can access</option>
                  <option value="group">👥 Group Restricted — Granted to specific group(s)</option>
                  <option value="tenant">🏢 Tenant-Wide — All members of this organization</option>
                </select>
              </div>
            </div>

            {/* Group Checklist (if Group scope selected) */}
            {visibility === "group" && (
              <div className="p-4 rounded-xl border border-sky-500/20 bg-sky-500/5 space-y-2">
                <span className="text-xs font-semibold text-sky-300 block">
                  Select Permitted Groups:
                </span>
                {authData?.context?.group_ids && authData.context.group_ids.length > 0 ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {authData.context.group_ids.map((gid, idx) => {
                      const groupName = authData.context?.groups[idx] || gid;
                      const isChecked = selectedGroupIds.includes(gid);
                      return (
                        <button
                          key={gid}
                          type="button"
                          onClick={() => toggleGroupSelection(gid)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                            isChecked
                              ? "bg-sky-500/20 border-sky-400 text-sky-200 shadow-sm"
                              : "bg-slate-900 border-slate-700 text-slate-400 hover:text-slate-200"
                          }`}
                        >
                          {isChecked ? "✓ " : "+ "}
                          {groupName}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">
                    Your account has no group memberships in this tenant. Documents uploaded will only
                    be visible by Tenant Admins.
                  </p>
                )}
              </div>
            )}

            {/* Feedback messages */}
            {uploadError && (
              <div className="p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300 text-xs">
                {uploadError}
              </div>
            )}
            {uploadSuccess && (
              <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-xs flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                {uploadSuccess}
              </div>
            )}

            {/* Submit Button */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!selectedFile || isUploading}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold text-white transition-all shadow-md shadow-indigo-600/30 flex items-center gap-2"
              >
                {isUploading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Ingesting & Embedding...
                  </>
                ) : (
                  <>
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                      />
                    </svg>
                    Upload & Ingest Document
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Documents Catalog & Table */}
        <div className="p-6 rounded-2xl border border-slate-800 bg-[#0F172A]/90 backdrop-blur-md shadow-xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-white">
                Ingested Documents
              </h2>
              <p className="text-xs text-slate-400">
                Filtered strictly by active tenant isolation & permissions
              </p>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3">
              {/* Search Bar */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search documents..."
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  className="px-3 py-1.5 pl-8 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <svg
                  className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
              >
                <option value="all">All States</option>
                <option value="ready">Ready</option>
                <option value="processing">Processing</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>

          {/* Table */}
          {docsLoading || authLoading ? (
            <div className="py-16 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              Loading document catalog...
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="py-16 text-center space-y-2 border border-dashed border-slate-800 rounded-xl bg-slate-900/30">
              <div className="w-10 h-10 rounded-full bg-slate-800 text-slate-500 mx-auto flex items-center justify-center">
                📄
              </div>
              <p className="text-sm font-medium text-slate-300">No documents found</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                No documents match your filter or are accessible under your current role and group
                permissions. Upload a new document above to test ingestion!
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4 font-semibold">Title</th>
                    <th className="py-3 px-4 font-semibold">Scope</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold">Chunks</th>
                    <th className="py-3 px-4 font-semibold">Size</th>
                    <th className="py-3 px-4 font-semibold">Uploaded</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredDocuments.map((doc) => {
                    const isDeleting = deletingId === doc.id;
                    return (
                      <tr
                        key={doc.id}
                        className="hover:bg-slate-800/30 transition-colors group"
                      >
                        {/* Title & Uploader */}
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-slate-100 flex items-center gap-2">
                            <span className="text-indigo-400">📄</span>
                            <span className="truncate max-w-xs">{doc.title}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            By {doc.owner_email || "Unknown"}
                          </div>
                        </td>

                        {/* Visibility */}
                        <td className="py-3.5 px-4">
                          {doc.visibility === "private" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-300 text-[10px] font-medium">
                              🔒 Private
                            </span>
                          )}
                          {doc.visibility === "group" && (
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-sky-500/30 bg-sky-500/10 text-sky-300 text-[10px] font-medium">
                                👥 Group
                              </span>
                              {doc.permission_groups && doc.permission_groups.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {doc.permission_groups.map((g) => (
                                    <span
                                      key={g.id}
                                      className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400"
                                    >
                                      {g.name}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                          {doc.visibility === "tenant" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-[10px] font-medium">
                              🏢 Tenant-Wide
                            </span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">
                          {doc.status === "ready" && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-[10px] font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              Ready
                            </span>
                          )}
                          {doc.status === "processing" && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-[10px] font-medium">
                              <span className="w-2.5 h-2.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                              Processing
                            </span>
                          )}
                          {doc.status === "uploaded" && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300 text-[10px] font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                              Uploaded
                            </span>
                          )}
                          {doc.status === "failed" && (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-rose-500/30 bg-rose-500/10 text-rose-300 text-[10px] font-medium">
                                ✕ Failed
                              </span>
                              {doc.error_message && (
                                <p
                                  className="text-[10px] text-rose-400 truncate max-w-xs"
                                  title={doc.error_message}
                                >
                                  {doc.error_message}
                                </p>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Chunks */}
                        <td className="py-3.5 px-4 font-mono text-slate-300">
                          {doc.chunk_count > 0 ? (
                            <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[11px]">
                              {doc.chunk_count} chunks
                            </span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>

                        {/* Size */}
                        <td className="py-3.5 px-4 text-slate-400">
                          {formatFileSize(doc.file_size)}
                        </td>

                        {/* Upload Date */}
                        <td className="py-3.5 px-4 text-slate-400 whitespace-nowrap">
                          {formatDate(doc.created_at)}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => handleDelete(doc.id)}
                            disabled={isDeleting}
                            className="text-slate-500 hover:text-rose-400 disabled:opacity-40 p-1 rounded transition-colors"
                            title="Delete document and vector chunks"
                          >
                            {isDeleting ? (
                              <span className="w-3.5 h-3.5 border-2 border-rose-500 border-t-transparent rounded-full animate-spin inline-block" />
                            ) : (
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
