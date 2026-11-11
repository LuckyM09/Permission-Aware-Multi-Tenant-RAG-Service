"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Upload,
  FileText,
  Trash2,
  Search,
  RefreshCw,
  Check,
  Lock,
  Users,
  Building2,
  AlertCircle,
  FileUp,
  CheckCircle2,
  ExternalLink,
  Shield,
  Layers,
  X,
  ArrowRight,
} from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { AppFooter } from "@/components/app-footer";
import { AnimatedFileUpload } from "@/components/ui/animated-file-upload";
import { Alert } from "@/components/ui/alert";
import { particleDelete } from "@/components/ui/particle-delete";
import { LiquidRippleButton } from "@/components/ui/liquid-ripple-button";
import { ExpandableSearch } from "@/components/ui/expandable-search";
import { KineticTextLoader } from "@/components/ui/kinetic-text-loader";
import { addNotification } from "@/lib/notifications";
import { useAuthSession, UserContextData } from "@/lib/auth-session";

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
  assigned_groups?: Array<{ id: string; name: string }>;
}

export default function DocumentsPage() {
  const router = useRouter();
  const { authData, authLoading, refreshSession } = useAuthSession();

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

  // Tenant Groups state
  const [tenantGroups, setTenantGroups] = useState<Array<{ id: string; name: string }>>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);

  // Deletion State
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch all departmental groups in tenant
  const fetchTenantGroups = useCallback(async () => {
    try {
      setGroupsLoading(true);
      const res = await fetch("/api/tenants/groups");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setTenantGroups(data);
        }
      }
    } catch {
      // Ignore network errors
    } finally {
      setGroupsLoading(false);
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
    document.title = "Documents Hub | VaultRAG Enterprise";
  }, []);

  useEffect(() => {
    if (!authData) return;
    if (!authData.authenticated) {
      router.replace("/login");
    } else if (!authData.context?.is_admin) {
      router.replace("/chat");
    } else {
      fetchDocuments();
      fetchTenantGroups();
    }
  }, [authData, router, fetchDocuments, fetchTenantGroups]);

  // Derived list of groups available for restriction
  const displayGroups = useMemo(() => {
    if (tenantGroups && tenantGroups.length > 0) {
      return tenantGroups.map((g) => ({ id: g.id, name: g.name }));
    }
    if (authData?.context?.group_ids && authData.context.group_ids.length > 0) {
      return authData.context.group_ids.map((gid, idx) => ({
        id: gid,
        name: authData.context?.groups[idx] || gid,
      }));
    }
    return [];
  }, [tenantGroups, authData]);

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

      let data: any = {};
      try {
        data = await res.json();
      } catch {
        data = { error: `Server returned non-JSON response (${res.status})` };
      }

      if (!res.ok) {
        setUploadError(data.error || data.detail || `Upload failed with status ${res.status}.`);
      } else {
        const docTitle = title.trim() || selectedFile?.name || "Document";
        addNotification({
          title: "Document Ready",
          description: `"${docTitle}" has been chunked and indexed into the vector vault.`,
          type: "success",
          userEmail: authData?.user?.email,
        });

        setUploadSuccess(
          data.deduplicated
            ? "Duplicate content detected: Document linked instantly via SHA-256."
            : "Document uploaded successfully! Chunking and pgvector embedding underway."
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
        const rowEl = document.getElementById(`doc-row-${docId}`);
        if (rowEl) {
          await particleDelete(rowEl, { duration: 600, direction: "right" });
        }
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

  const filteredDocuments = documents.filter((doc) => {
    const matchesQuery =
      doc.title.toLowerCase().includes(filterQuery.toLowerCase()) ||
      doc.owner_email?.toLowerCase().includes(filterQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || doc.status === statusFilter;
    return matchesQuery && matchesStatus;
  });

  const currentTenant = authData?.tenants?.find((t) => t.is_current);

  if (authLoading || !authData) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] text-[#0F172A] flex flex-col items-center justify-center p-6 text-center font-sans">
        <KineticTextLoader text="Loading" className="scale-75" />
        <p className="text-xs text-[#64748B] font-mono mt-4">
          Loading document vault security context...
        </p>
      </div>
    );
  }

  if (!authData.authenticated) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] text-[#0F172A] flex flex-col items-center justify-center p-6 text-center font-sans">
        <KineticTextLoader text="Loading" className="scale-75" />
        <p className="text-xs text-[#64748B] font-mono mt-4">
          Authentication required. Redirecting to sign in...
        </p>
      </div>
    );
  }

  if (!authData.context?.is_admin) {
    return (
      <div className="min-h-screen flex flex-col bg-[#FAF9F6] text-[#0F172A]">
        <AppHeader
          userEmail={authData?.user?.email}
          tenantName={currentTenant?.name}
          role={authData?.context?.role}
          onLogout={() => refreshSession(true)}
        />
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full p-8 rounded-2xl border border-[#E6E6E1] bg-white text-center space-y-4 shadow-elevated">
            <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center mx-auto">
              <Shield className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-[#0F172A]">Knowledge Management Restricted</h2>
            <p className="text-xs text-[#52525B] leading-relaxed">
              Document uploads and ACL permissions are managed exclusively by administrators.
              Your account has access to query permitted documents in Secure Chat.
            </p>
            <div className="pt-2">
              <Link
                href="/chat"
                className="px-5 py-2.5 rounded-xl bg-[#0F172A] text-white text-xs font-semibold inline-block hover:bg-[#1E293B] shadow-xs"
              >
                Return to Secure Chat →
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF9F6] text-[#0F172A]">
      {/* Global App Header */}
      <AppHeader
        userEmail={authData?.user?.email}
        tenantName={currentTenant?.name}
        role={authData?.context?.role}
        onLogout={() => refreshSession(true)}
      />

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E6E6E1] pb-6">
          <div className="space-y-1.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0F172A]">
              Document Knowledge Base
            </h1>
            <p className="text-xs sm:text-sm text-[#52525B] max-w-2xl leading-relaxed">
              Upload PDF, DOCX, TXT, or Markdown documents. Files are securely processed
              and protected so only authorized team members can access them.
            </p>
          </div>

          <button
            type="button"
            onClick={() => fetchDocuments()}
            className="self-start sm:self-auto inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#E6E6E1] bg-white hover:bg-[#F4F4F0] text-[#0F172A] text-xs font-semibold transition-colors shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F172A] cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#64748B]" />
            <span>Refresh Pipeline</span>
          </button>
        </div>

        {/* Upload Dropzone Section */}
        <section
          aria-labelledby="upload-heading"
          className="rounded-2xl border border-[#E6E6E1] bg-white p-6 sm:p-8 shadow-card space-y-6"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-sky-50 border border-sky-100 flex items-center justify-center text-[#0284C7]">
                <FileUp className="w-4 h-4" />
              </div>
              <h2 id="upload-heading" className="text-base font-bold text-[#0F172A]">
                Upload New Document
              </h2>
            </div>
            <span className="text-[10px] font-mono font-medium px-2.5 py-1 rounded-md bg-[#FAF9F6] text-[#64748B] border border-[#E6E6E1]">
              SHA-256 Deduplicated
            </span>
          </div>

          <form onSubmit={handleUpload} className="space-y-5">
            {/* Animated File Upload Component (EasyUI) */}
            <AnimatedFileUpload
              onFilesSelected={(files) => handleFileChange(files[0])}
              accept=".pdf,.docx,.txt,.md"
              disabled={isUploading}
            />

            {selectedFile && (
              <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#0F172A]">{selectedFile.name}</p>
                    <p className="text-[11px] text-[#64748B] font-mono">
                      {formatFileSize(selectedFile.size)} • Ready for Nemotron embedding
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  className="p-1 rounded-md text-[#64748B] hover:text-rose-600 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {uploadError && (
              <Alert variant="destructive" title="Upload Failed" dismissible onDismiss={() => setUploadError("")}>
                {uploadError}
              </Alert>
            )}

            {uploadSuccess && (
              <Alert variant="success" title="Ingestion Complete" dismissible onDismiss={() => setUploadSuccess("")}>
                {uploadSuccess}
              </Alert>
            )}

            {/* Form Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Title */}
              <div>
                <label htmlFor="doc-title-input" className="block text-xs font-bold text-[#0F172A] uppercase tracking-wider mb-2">
                  Document Title
                </label>
                <input
                  id="doc-title-input"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Q3 Architecture RFC"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF9F6] border border-[#E2E8F0] text-xs sm:text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#0F172A] focus:bg-white transition-all"
                />
              </div>

              {/* Visibility Scope */}
              <div>
                <label htmlFor="visibility-select" className="block text-xs font-bold text-[#0F172A] uppercase tracking-wider mb-2">
                  Access Visibility Scope
                </label>
                <select
                  id="visibility-select"
                  value={visibility}
                  onChange={(e) =>
                    setVisibility(e.target.value as "private" | "group" | "tenant")
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF9F6] border border-[#E2E8F0] text-xs sm:text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0F172A] focus:bg-white transition-all"
                >
                  <option value="private">Private — Owner only</option>
                  <option value="group">Group Restricted — Specific group memberships</option>
                  <option value="tenant">Tenant-Wide — All members of this organization</option>
                </select>
              </div>
            </div>

            {/* Group Checklist (if Group scope selected) */}
            {visibility === "group" && (
              <div className="p-4 rounded-xl border border-[#E6E6E1] bg-[#F8FAFC] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#0F172A] block">
                    Select Permitted Groups:
                  </span>
                  {selectedGroupIds.length > 0 && (
                    <span className="text-[11px] text-[#0284C7] font-semibold">
                      {selectedGroupIds.length} group{selectedGroupIds.length > 1 ? "s" : ""} selected
                    </span>
                  )}
                </div>

                {displayGroups.length > 0 ? (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {displayGroups.map((grp) => {
                      const isChecked = selectedGroupIds.includes(grp.id);
                      return (
                        <button
                          key={grp.id}
                          type="button"
                          onClick={() => toggleGroupSelection(grp.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                            isChecked
                              ? "bg-[#0F172A] border-[#0F172A] text-white font-semibold shadow-xs"
                              : "bg-white border-[#E6E6E1] text-[#52525B] hover:text-[#0F172A] hover:bg-[#FAF9F6]"
                          }`}
                        >
                          {isChecked ? "✓ " : "+ "}
                          {grp.name}
                        </button>
                      );
                    })}
                  </div>
                ) : groupsLoading ? (
                  <p className="text-xs text-[#64748B] italic">Loading tenant departments...</p>
                ) : (
                  <div className="p-3.5 rounded-lg border border-dashed border-[#E6E6E1] bg-white text-center space-y-1.5">
                    <p className="text-xs text-[#64748B]">
                      No departmental groups exist in this organization yet.
                    </p>
                    <Link
                      href="/admin"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0284C7] hover:underline"
                    >
                      <span>Create departments in Tenant Admin</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* Submit Button */}
            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={!selectedFile || isUploading}
                className="min-h-11 px-6 py-2.5 rounded-xl text-xs sm:text-sm font-semibold inline-flex flex-row items-center justify-center gap-2.5 bg-[#0F172A] text-white hover:bg-[#1E293B] shadow-sm hover:shadow transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
              >
                {isUploading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin shrink-0" />
                    <span className="whitespace-nowrap">Ingesting &amp; Embedding...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 text-[#00D2FF] shrink-0" />
                    <span className="whitespace-nowrap font-semibold">Upload &amp; Ingest Document</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </section>

        {/* Documents Catalog & Table */}
        <section
          aria-labelledby="catalog-heading"
          className="rounded-2xl border border-[#E6E6E1] bg-white shadow-card overflow-hidden"
        >
          <div className="p-5 sm:p-6 border-b border-[#E6E6E1] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 id="catalog-heading" className="text-base font-bold text-[#0F172A]">
                Ingested Documents ({documents.length})
              </h2>
              <p className="text-xs text-[#64748B]">
                Database-enforced isolation per active session and group grants
              </p>
            </div>

            {/* Search & Status Filters */}
            <div className="flex items-center gap-3">
              <ExpandableSearch
                placeholder="Search by title or owner..."
                onSearch={(q) => setFilterQuery(q)}
                variant="light"
              />

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-xl bg-[#FAF9F6] border border-[#E2E8F0] text-xs text-[#0F172A] focus:outline-none focus:ring-1 focus:ring-[#0F172A]"
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
            <div className="py-16 text-center text-xs text-[#64748B] flex flex-col items-center justify-center gap-3">
              <KineticTextLoader text="Loading" className="scale-75" />
              <span className="text-xs text-[#64748B] font-mono">Synchronizing document catalog &amp; RLS vectors...</span>
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="py-20 text-center space-y-2 p-6">
              <div className="w-12 h-12 rounded-2xl bg-[#FAF9F6] border border-[#E6E6E1] text-[#94A3B8] mx-auto flex items-center justify-center">
                <FileText className="w-5 h-5 text-[#94A3B8]" />
              </div>
              <p className="text-xs sm:text-sm font-bold text-[#0F172A]">No documents found</p>
              <p className="text-xs text-[#64748B] max-w-sm mx-auto">
                No documents match your filter or are accessible under your current role and group
                permissions.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[#E6E6E1] bg-[#F8FAFC] text-[#64748B] font-mono uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4 font-semibold">Title</th>
                    <th className="py-3 px-4 font-semibold">Visibility</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold">Chunks</th>
                    <th className="py-3 px-4 font-semibold">Size</th>
                    <th className="py-3 px-4 font-semibold">Uploaded</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6E6E1]">
                  {filteredDocuments.map((doc) => {
                    const isDeleting = deletingId === doc.id;
                    return (
                      <tr
                        key={doc.id}
                        id={`doc-row-${doc.id}`}
                        className="hover:bg-[#FAF9F6] transition-colors"
                      >
                        {/* Title & Owner */}
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-[#0F172A] flex items-center gap-2">
                            <FileText className="w-3.5 h-3.5 text-[#64748B] shrink-0" />
                            <span className="truncate max-w-xs">{doc.title}</span>
                          </div>
                          <div className="text-[11px] text-[#64748B] font-mono mt-0.5">
                            {doc.owner_email || "System"}
                          </div>
                        </td>

                        {/* Visibility */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {doc.visibility === "private" && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md border border-amber-200 bg-amber-50 text-amber-800 text-[10px] font-semibold font-mono">
                              <Lock className="w-3 h-3" />
                              <span>Private</span>
                            </span>
                          )}
                          {doc.visibility === "group" && (
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md border border-indigo-200 bg-indigo-50 text-indigo-800 text-[10px] font-semibold font-mono">
                                <Users className="w-3 h-3" />
                                <span>Group</span>
                              </span>
                              {doc.assigned_groups && doc.assigned_groups.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {doc.assigned_groups.map((g) => (
                                    <span
                                      key={g.id}
                                      className="text-[9px] px-1.5 py-0.5 rounded bg-[#FAF9F6] border border-[#E6E6E1] text-[#64748B] font-mono"
                                    >
                                      {g.name}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                          {doc.visibility === "tenant" && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md border border-sky-200 bg-sky-50 text-sky-800 text-[10px] font-semibold font-mono">
                              <Building2 className="w-3 h-3" />
                              <span>Tenant-Wide</span>
                            </span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {doc.status === "ready" && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-800 text-[10px] font-semibold font-mono">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              <span>Ready</span>
                            </span>
                          )}
                          {doc.status === "processing" && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border border-amber-200 bg-amber-50 text-amber-800 text-[10px] font-semibold font-mono">
                              <span className="w-2 h-2 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                              <span>Processing</span>
                            </span>
                          )}
                          {doc.status === "uploaded" && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border border-amber-200 bg-amber-50 text-amber-800 text-[10px] font-semibold font-mono">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              <span>Uploaded</span>
                            </span>
                          )}
                          {doc.status === "failed" && (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md border border-rose-200 bg-rose-50 text-rose-800 text-[10px] font-semibold font-mono">
                                <AlertCircle className="w-3 h-3" />
                                <span>Failed</span>
                              </span>
                              {doc.error_message && (
                                <p
                                  className="text-[10px] text-rose-600 truncate max-w-xs"
                                  title={doc.error_message}
                                >
                                  {doc.error_message}
                                </p>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Chunks */}
                        <td className="py-3.5 px-4 font-mono text-[#0F172A] whitespace-nowrap">
                          {doc.chunk_count > 0 ? (
                            <span className="px-2.5 py-0.5 rounded-md bg-[#FAF9F6] border border-[#E2E8F0] text-[11px] font-semibold">
                              {doc.chunk_count} chunks
                            </span>
                          ) : (
                            <span className="text-[#94A3B8]">—</span>
                          )}
                        </td>

                        {/* Size */}
                        <td className="py-3.5 px-4 text-[#64748B] font-mono whitespace-nowrap">
                          {formatFileSize(doc.file_size)}
                        </td>

                        {/* Upload Date */}
                        <td className="py-3.5 px-4 text-[#64748B] font-mono whitespace-nowrap">
                          {formatDate(doc.created_at)}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleDelete(doc.id)}
                            disabled={isDeleting}
                            aria-label={`Delete ${doc.title}`}
                            className="text-[#94A3B8] hover:text-rose-600 hover:bg-rose-50 disabled:opacity-40 p-1.5 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 cursor-pointer"
                            title="Delete document and chunk embeddings"
                          >
                            {isDeleting ? (
                              <span className="w-3.5 h-3.5 border-2 border-rose-600 border-t-transparent rounded-full animate-spin inline-block" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
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
        </section>
      </main>
      <AppFooter />
    </div>
  );
}
