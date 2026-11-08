"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Users,
  Shield,
  KeyRound,
  UserPlus,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Building2,
  Lock,
  Layers,
  Search,
  Filter,
  Check,
  X,
  ExternalLink,
  FileText,
} from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { AppFooter } from "@/components/app-footer";
import { particleDelete } from "@/components/ui/particle-delete";
import { KineticTextLoader } from "@/components/ui/kinetic-text-loader";
import { ExpandableSearch } from "@/components/ui/expandable-search";

interface GroupInfo {
  id: string;
  name: string;
}

interface MemberItem {
  id: string;
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: "admin" | "member" | "viewer";
  is_default: boolean;
  created_at: string;
  groups: GroupInfo[];
}

interface GroupMemberItem {
  id: string;
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  created_at: string;
}

interface GroupItem {
  id: string;
  name: string;
  description: string;
  created_at: string;
  member_count: number;
  members: GroupMemberItem[];
}

interface AccessExplorerDocument {
  document_id: string;
  title: string;
  visibility: string;
  owner_email: string;
  status: string;
  access_status: "ALLOWED" | "DENIED";
  matched_rules: string[];
  chunk_count: number;
}

interface AccessExplorerResult {
  target_user: {
    user_id: string;
    email: string;
    role: string;
    groups: GroupInfo[];
  };
  total_documents: number;
  accessible_documents: number;
  denied_documents: number;
  documents: AccessExplorerDocument[];
}

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

export default function AdminPage() {
  const router = useRouter();
  const [authData, setAuthData] = useState<UserContextData | null>(null);
  const [activeTab, setActiveTab] = useState<"members" | "groups" | "explorer">("members");

  // Members state
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [loadingMembers, setLoadingMembers] = useState<boolean>(true);
  const [inviteEmail, setInviteEmail] = useState<string>("");
  const [inviteName, setInviteName] = useState<string>("");
  const [invitePassword, setInvitePassword] = useState<string>("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member" | "viewer">("member");
  const [inviting, setInviting] = useState<boolean>(false);
  const [memberActionError, setMemberActionError] = useState<string | null>(null);

  // Groups state
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [loadingGroups, setLoadingGroups] = useState<boolean>(true);
  const [newGroupName, setNewGroupName] = useState<string>("");
  const [newGroupDesc, setNewGroupDesc] = useState<string>("");
  const [creatingGroup, setCreatingGroup] = useState<boolean>(false);
  const [groupActionError, setGroupActionError] = useState<string | null>(null);
  const [selectedGroupAddUser, setSelectedGroupAddUser] = useState<Record<string, string>>({});

  // Access Explorer state
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [explorerData, setExplorerData] = useState<AccessExplorerResult | null>(null);
  const [loadingExplorer, setLoadingExplorer] = useState<boolean>(false);
  const [explorerFilter, setExplorerFilter] = useState<"all" | "allowed" | "denied">("all");
  const [explorerSearch, setExplorerSearch] = useState<string>("");

  // Session fetch
  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setAuthData(data);
      } else {
        setAuthData({ authenticated: false });
      }
    } catch {
      setAuthData({ authenticated: false });
    }
  }, []);

  // Fetch Members
  const fetchMembers = useCallback(async () => {
    setLoadingMembers(true);
    setMemberActionError(null);
    try {
      const res = await fetch("/api/tenants/members");
      if (res.ok) {
        const data = await res.json();
        setMembers(data);
        if (data.length > 0) {
          setSelectedUserId((prev) => prev || data[0].user_id);
        }
      } else {
        const err = await res.json();
        setMemberActionError(err.detail || "Failed to load members.");
      }
    } catch {
      setMemberActionError("Network error loading members.");
    } finally {
      setLoadingMembers(false);
    }
  }, []);

  // Fetch Groups
  const fetchGroups = useCallback(async () => {
    setLoadingGroups(true);
    setGroupActionError(null);
    try {
      const res = await fetch("/api/tenants/groups");
      if (res.ok) {
        const data = await res.json();
        setGroups(data);
      } else {
        const err = await res.json();
        setGroupActionError(err.detail || "Failed to load groups.");
      }
    } catch {
      setGroupActionError("Network error loading groups.");
    } finally {
      setLoadingGroups(false);
    }
  }, []);

  // Run Access Explorer evaluation
  const runAccessExplorer = useCallback(async (targetId: string) => {
    if (!targetId) return;
    setLoadingExplorer(true);
    try {
      const res = await fetch("/api/tenants/access-explorer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: targetId }),
      });
      if (res.ok) {
        const data = await res.json();
        setExplorerData(data);
      } else {
        setExplorerData(null);
      }
    } catch {
      setExplorerData(null);
    } finally {
      setLoadingExplorer(false);
    }
  }, []);

  useEffect(() => {
    document.title = "Tenant Administration | VaultRAG Enterprise";
    fetchSession();
  }, [fetchSession]);

  useEffect(() => {
    if (!authData) return;
    if (!authData.authenticated) {
      router.replace("/login");
    } else if (!authData.context?.is_admin) {
      router.replace("/chat");
    } else {
      fetchMembers();
      fetchGroups();
    }
  }, [authData, router, fetchMembers, fetchGroups]);

  useEffect(() => {
    if (selectedUserId && activeTab === "explorer") {
      runAccessExplorer(selectedUserId);
    }
  }, [selectedUserId, activeTab, runAccessExplorer]);

  // Member handlers
  const handleRoleChange = async (membershipId: string, newRole: "admin" | "member" | "viewer") => {
    setMemberActionError(null);
    try {
      const res = await fetch(`/api/tenants/members/${membershipId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (res.ok) {
        await fetchMembers();
        if (selectedUserId) runAccessExplorer(selectedUserId);
      } else {
        const err = await res.json();
        setMemberActionError(err.detail || "Failed to update role.");
      }
    } catch {
      setMemberActionError("Failed to update role.");
    }
  };

  const handleRemoveMember = async (membershipId: string, email: string) => {
    if (!confirm(`Are you sure you want to remove ${email} from this tenant?`)) return;
    setMemberActionError(null);
    try {
      const res = await fetch(`/api/tenants/members/${membershipId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        const rowEl = document.getElementById(`member-row-${membershipId}`);
        if (rowEl) {
          await particleDelete(rowEl, { duration: 600, direction: "right" });
        }
        await fetchMembers();
      } else {
        const err = await res.json();
        setMemberActionError(err.detail || "Failed to remove member.");
      }
    } catch {
      setMemberActionError("Failed to remove member.");
    }
  };

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setMemberActionError(null);
    try {
      const res = await fetch("/api/tenants/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
          first_name: inviteName.trim(),
          password: invitePassword.trim() || undefined,
        }),
      });
      if (res.ok) {
        setInviteEmail("");
        setInviteName("");
        setInvitePassword("");
        await fetchMembers();
      } else {
        const err = await res.json();
        setMemberActionError(err.detail || "Failed to add member.");
      }
    } catch {
      setMemberActionError("Failed to add member.");
    } finally {
      setInviting(false);
    }
  };

  // Group handlers
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    setCreatingGroup(true);
    setGroupActionError(null);
    try {
      const res = await fetch("/api/tenants/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newGroupName.trim(), description: newGroupDesc.trim() }),
      });
      if (res.ok) {
        setNewGroupName("");
        setNewGroupDesc("");
        await fetchGroups();
        await fetchMembers();
      } else {
        const err = await res.json();
        setGroupActionError(err.detail || "Failed to create group.");
      }
    } catch {
      setGroupActionError("Failed to create group.");
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleDeleteGroup = async (groupId: string, name: string) => {
    if (!confirm(`Are you sure you want to delete access group "${name}"?`)) return;
    setGroupActionError(null);
    try {
      const res = await fetch(`/api/tenants/groups/${groupId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        const cardEl = document.getElementById(`group-card-${groupId}`);
        if (cardEl) {
          await particleDelete(cardEl, { duration: 600, direction: "down" });
        }
        await fetchGroups();
        await fetchMembers();
        if (selectedUserId) runAccessExplorer(selectedUserId);
      } else {
        const err = await res.json();
        setGroupActionError(err.detail || "Failed to delete group.");
      }
    } catch {
      setGroupActionError("Failed to delete group.");
    }
  };

  const handleAddUserToGroup = async (groupId: string) => {
    const userId = selectedGroupAddUser[groupId];
    if (!userId) return;
    setGroupActionError(null);
    try {
      const res = await fetch(`/api/tenants/groups/${groupId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      if (res.ok) {
        setSelectedGroupAddUser((prev) => ({ ...prev, [groupId]: "" }));
        await fetchGroups();
        await fetchMembers();
        if (selectedUserId) runAccessExplorer(selectedUserId);
      } else {
        const err = await res.json();
        setGroupActionError(err.detail || "Failed to add user to group.");
      }
    } catch {
      setGroupActionError("Failed to add user to group.");
    }
  };

  const handleRemoveUserFromGroup = async (groupId: string, userId: string) => {
    setGroupActionError(null);
    try {
      const res = await fetch(`/api/tenants/groups/${groupId}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      if (res.ok) {
        await fetchGroups();
        await fetchMembers();
        if (selectedUserId) runAccessExplorer(selectedUserId);
      } else {
        const err = await res.json();
        setGroupActionError(err.detail || "Failed to remove user from group.");
      }
    } catch {
      setGroupActionError("Failed to remove user from group.");
    }
  };

  // Filtered explorer documents
  const filteredDocs = (explorerData?.documents || []).filter((doc) => {
    if (explorerFilter === "allowed" && doc.access_status !== "ALLOWED") return false;
    if (explorerFilter === "denied" && doc.access_status !== "DENIED") return false;
    if (explorerSearch) {
      const q = explorerSearch.toLowerCase();
      return (
        doc.title.toLowerCase().includes(q) ||
        doc.owner_email.toLowerCase().includes(q) ||
        doc.matched_rules.some((r) => r.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const currentTenant = authData?.tenants?.find((t) => t.is_current);

  if (!authData) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] text-[#0F172A] flex flex-col items-center justify-center p-6 text-center font-sans">
        <KineticTextLoader text="VaultRAG" className="scale-75" />
        <p className="text-xs text-[#64748B] font-mono mt-4">
          Verifying security authorization credentials...
        </p>
      </div>
    );
  }

  if (!authData.authenticated) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] text-[#0F172A] flex flex-col items-center justify-center p-6 text-center font-sans">
        <KineticTextLoader text="VaultRAG" className="scale-75" />
        <p className="text-xs text-[#64748B] font-mono mt-4">
          Authentication required. Redirecting to sign in...
        </p>
      </div>
    );
  }

  if (!authData.context?.is_admin) {
    return (
      <div className="min-h-screen bg-[#FAF9F6] text-[#0F172A] flex flex-col items-center justify-center p-6 text-center font-sans">
        <KineticTextLoader text="VaultRAG" className="scale-75" />
        <p className="text-xs text-[#64748B] font-mono mt-4">
          Member account verified. Redirecting to Anti-Leak Chat...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF9F6] text-[#0F172A] flex flex-col font-sans">
      {/* Global App Header */}
      <AppHeader
        userEmail={authData?.user?.email}
        tenantName={currentTenant?.name}
        role={authData?.context?.role}
        onLogout={fetchSession}
      />

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Title & Tenant Info Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-[#E6E6E1]">
          <div className="space-y-1.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0F172A]">
              Tenant Administration
            </h1>
            <p className="text-xs sm:text-sm text-[#52525B] max-w-2xl leading-relaxed">
              Manage member roles, configure fine-grained group permissions, and run the Access Explorer
              to verify document security rules for <span className="font-semibold text-[#0F172A]">{currentTenant?.name || "this organization"}</span>.
            </p>
          </div>

          {/* Tab Navigation */}
          <div className="inline-flex rounded-xl bg-white border border-[#E6E6E1] p-1 self-start md:self-auto shadow-xs">
            <button
              type="button"
              onClick={() => setActiveTab("members")}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeTab === "members"
                  ? "bg-[#0F172A] text-white shadow-xs"
                  : "text-[#52525B] hover:text-[#0F172A] hover:bg-[#FAF9F6]"
              }`}
            >
              Members ({members.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("groups")}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeTab === "groups"
                  ? "bg-[#0F172A] text-white shadow-xs"
                  : "text-[#52525B] hover:text-[#0F172A] hover:bg-[#FAF9F6]"
              }`}
            >
              Groups ({groups.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("explorer")}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === "explorer"
                  ? "bg-[#0F172A] text-white shadow-xs"
                  : "text-[#0284C7] hover:text-[#0F172A] hover:bg-[#FAF9F6]"
              }`}
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Access Explorer</span>
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: MEMBERS */}
        {/* ========================================================================= */}
        {activeTab === "members" && (
          <div className="space-y-6">
            {memberActionError && (
              <div
                role="alert"
                className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{memberActionError}</span>
              </div>
            )}

            {/* Add Member Card */}
            <div className="bg-white border border-[#E6E6E1] rounded-2xl p-6 shadow-card space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-sky-50 border border-sky-100 flex items-center justify-center text-[#0284C7]">
                    <UserPlus className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-[#0F172A]">Add or Provision Tenant Member</h2>
                    <p className="text-[11px] text-[#64748B]">
                      Enter a colleague&apos;s email to onboard them. New accounts are automatically provisioned.
                    </p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleInviteMember} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="user@acme.com *"
                    required
                    className="bg-[#FAF9F6] border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#0F172A] focus:bg-white"
                  />
                  <input
                    type="text"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="Full Name (optional)"
                    className="bg-[#FAF9F6] border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#0F172A] focus:bg-white"
                  />
                  <input
                    type="password"
                    value={invitePassword}
                    onChange={(e) => setInvitePassword(e.target.value)}
                    placeholder="Initial Password (leave empty to auto-generate)"
                    className="bg-[#FAF9F6] border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-xs text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#0F172A] focus:bg-white"
                  />
                  <div className="flex gap-2">
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as "admin" | "member" | "viewer")}
                      className="flex-1 bg-[#FAF9F6] border border-[#E2E8F0] rounded-xl px-3 py-2.5 text-xs text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#0F172A] focus:bg-white"
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                      <option value="viewer">Viewer</option>
                    </select>
                    <button
                      type="submit"
                      disabled={inviting}
                      className="bg-[#0F172A] hover:bg-[#1E293B] text-white active:scale-98 disabled:opacity-50 font-semibold px-4 py-2.5 rounded-xl text-xs transition-all shadow-xs cursor-pointer shrink-0"
                    >
                      {inviting ? "Adding..." : "Add"}
                    </button>
                  </div>
                </div>
              </form>
            </div>

            {/* Members Table */}
            <div className="bg-white border border-[#E6E6E1] rounded-2xl overflow-hidden shadow-card">
              <div className="px-6 py-4 border-b border-[#E6E6E1] flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#0F172A]">Tenant Members</h3>
                <span className="text-xs text-[#64748B] font-mono font-medium">{members.length} members</span>
              </div>

              {loadingMembers ? (
                <div className="p-12 text-center text-[#64748B] text-xs flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-[#0F172A] border-t-transparent rounded-full animate-spin" />
                  <span>Loading tenant members...</span>
                </div>
              ) : members.length === 0 ? (
                <div className="p-12 text-center text-[#64748B] text-xs">No members found in this tenant.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-[#F8FAFC] border-b border-[#E6E6E1] text-[#64748B] uppercase tracking-wider font-mono text-[11px]">
                      <tr>
                        <th className="px-6 py-3 font-semibold">Member</th>
                        <th className="px-6 py-3 font-semibold">Current Role</th>
                        <th className="px-6 py-3 font-semibold">Assigned Groups</th>
                        <th className="px-6 py-3 font-semibold">Joined</th>
                        <th className="px-6 py-3 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E6E6E1] text-[#0F172A]">
                      {members.map((m) => (
                        <tr key={m.id} id={`member-row-${m.id}`} className="hover:bg-[#FAF9F6] transition-colors">
                          <td className="px-6 py-3.5">
                            <div className="font-semibold text-[#0F172A]">{m.email}</div>
                            {m.first_name || m.last_name ? (
                              <div className="text-[#64748B] text-[11px]">{m.first_name} {m.last_name}</div>
                            ) : null}
                          </td>
                          <td className="px-6 py-3.5">
                            <select
                              value={m.role}
                              onChange={(e) =>
                                handleRoleChange(m.id, e.target.value as "admin" | "member" | "viewer")
                              }
                              className={`text-xs font-mono font-semibold px-2.5 py-1 rounded-lg border bg-[#FAF9F6] focus:outline-none focus:ring-1 focus:ring-[#0F172A] ${
                                m.role === "admin"
                                  ? "text-emerald-800 border-emerald-200 bg-emerald-50"
                                  : m.role === "member"
                                  ? "text-sky-800 border-sky-200 bg-sky-50"
                                  : "text-[#64748B] border-[#E2E8F0]"
                              }`}
                            >
                              <option value="admin">Admin</option>
                              <option value="member">Member</option>
                              <option value="viewer">Viewer</option>
                            </select>
                          </td>
                          <td className="px-6 py-3.5">
                            <div className="flex flex-wrap gap-1.5">
                              {m.groups && m.groups.length > 0 ? (
                                m.groups.map((g) => (
                                  <span
                                    key={g.id}
                                    className="px-2.5 py-0.5 rounded-md bg-[#FAF9F6] border border-[#E2E8F0] text-[#0F172A] text-[10px] font-mono font-medium"
                                  >
                                    {g.name}
                                  </span>
                                ))
                              ) : (
                                <span className="text-[#94A3B8] italic text-[11px]">No groups</span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-3.5 text-[#64748B] font-mono whitespace-nowrap">
                            {new Date(m.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-3.5 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoveMember(m.id, m.email)}
                              aria-label={`Remove member ${m.email}`}
                              className="text-[#94A3B8] hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: GROUPS */}
        {/* ========================================================================= */}
        {activeTab === "groups" && (
          <div className="space-y-6">
            {groupActionError && (
              <div
                role="alert"
                className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{groupActionError}</span>
              </div>
            )}

            {/* Create Group Card */}
            <div className="bg-white border border-[#E6E6E1] rounded-2xl p-6 shadow-card space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-sky-50 border border-sky-100 flex items-center justify-center text-[#0284C7]">
                  <Users className="w-4 h-4" />
                </div>
                <h2 className="text-sm font-bold text-[#0F172A]">Create New Access Control Group</h2>
              </div>
              <form onSubmit={handleCreateGroup} className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="Group Name (e.g. Legal, Finance, Engineering)"
                  required
                  className="bg-[#FAF9F6] border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#0F172A] focus:bg-white sm:w-1/3"
                />
                <input
                  type="text"
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  placeholder="Optional description"
                  className="flex-1 bg-[#FAF9F6] border border-[#E2E8F0] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#0F172A] focus:bg-white"
                />
                <button
                  type="submit"
                  disabled={creatingGroup}
                  className="bg-[#0F172A] hover:bg-[#1E293B] text-white active:scale-98 disabled:opacity-50 font-semibold px-5 py-2.5 rounded-xl text-xs sm:text-sm transition-all shadow-xs cursor-pointer"
                >
                  {creatingGroup ? "Creating..." : "Create Group"}
                </button>
              </form>
            </div>

            {/* Groups Grid */}
            {loadingGroups ? (
              <div className="p-12 text-center text-[#64748B] text-xs flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-[#0F172A] border-t-transparent rounded-full animate-spin" />
                <span>Loading groups...</span>
              </div>
            ) : groups.length === 0 ? (
              <div className="p-12 text-center text-[#64748B] text-xs bg-white rounded-2xl border border-[#E6E6E1]">
                No access groups configured yet. Create one above to grant fine-grained document access.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {groups.map((group) => (
                  <div
                    key={group.id}
                    id={`group-card-${group.id}`}
                    className="bg-white border border-[#E6E6E1] rounded-2xl p-6 flex flex-col justify-between shadow-card space-y-5"
                  >
                    <div>
                      <div className="flex items-center justify-between pb-3.5 border-b border-[#E6E6E1]">
                        <div>
                          <h3 className="font-bold text-[#0F172A] text-sm flex items-center gap-2">
                            <Users className="w-4 h-4 text-[#0284C7]" />
                            <span>{group.name}</span>
                          </h3>
                          {group.description && (
                            <p className="text-xs text-[#64748B] mt-1">{group.description}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteGroup(group.id, group.name)}
                          aria-label={`Delete group ${group.name}`}
                          className="text-[#94A3B8] hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Group Members List */}
                      <div className="mt-4 space-y-2.5">
                        <div className="text-xs font-bold text-[#0F172A] flex items-center justify-between">
                          <span>Assigned Members</span>
                          <span className="text-[10px] font-mono bg-[#FAF9F6] px-2.5 py-0.5 rounded-md border border-[#E2E8F0] text-[#64748B]">
                            {group.members.length} members
                          </span>
                        </div>

                        {group.members.length === 0 ? (
                          <p className="text-xs text-[#64748B] italic py-1">No users assigned to this group.</p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {group.members.map((gm) => (
                              <span
                                key={gm.id}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FAF9F6] border border-[#E2E8F0] text-xs text-[#0F172A]"
                              >
                                <span className="font-mono text-[11px] font-medium">{gm.email}</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveUserFromGroup(group.id, gm.user_id)}
                                  aria-label={`Remove ${gm.email} from group`}
                                  className="text-[#94A3B8] hover:text-rose-600 transition-colors ml-0.5 p-0.5 cursor-pointer"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Add Member to Group Selector */}
                    <div className="pt-3.5 border-t border-[#E6E6E1] flex items-center gap-2">
                      <select
                        value={selectedGroupAddUser[group.id] || ""}
                        onChange={(e) =>
                          setSelectedGroupAddUser((prev) => ({
                            ...prev,
                            [group.id]: e.target.value,
                          }))
                        }
                        className="flex-1 bg-[#FAF9F6] border border-[#E2E8F0] rounded-xl px-3 py-1.5 text-xs text-[#0F172A] focus:outline-none focus:ring-1 focus:ring-[#0F172A]"
                      >
                        <option value="">Select member to add...</option>
                        {members
                          .filter((m) => !group.members.some((gm) => gm.user_id === m.user_id))
                          .map((m) => (
                            <option key={m.id} value={m.user_id}>
                              {m.email} ({m.role})
                            </option>
                          ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => handleAddUserToGroup(group.id)}
                        disabled={!selectedGroupAddUser[group.id]}
                        className="bg-white hover:bg-[#F4F4F0] disabled:opacity-40 text-[#0F172A] font-semibold px-4 py-1.5 rounded-xl text-xs border border-[#E6E6E1] transition-colors cursor-pointer shadow-2xs"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: ACCESS EXPLORER */}
        {/* ========================================================================= */}
        {activeTab === "explorer" && (
          <div className="space-y-6">
            {/* Inspector Header & Target User Selector */}
            <div className="bg-white border border-[#E6E6E1] rounded-2xl p-6 shadow-card space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-[#0F172A] flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-sky-50 border border-sky-100 flex items-center justify-center text-[#0284C7]">
                      <KeyRound className="w-4 h-4" />
                    </div>
                    <span>Access Policy Simulation Engine</span>
                    <span className="text-[10px] font-mono bg-emerald-50 border border-emerald-200 text-emerald-800 px-2 py-0.5 rounded-md font-semibold">
                      SSOT Active
                    </span>
                  </h2>
                  <p className="text-xs text-[#52525B] mt-1 leading-relaxed">
                    Select any tenant user to simulate the exact SQL WHERE clauses generated by the permissions engine. Inspect why each document is allowed or blocked.
                  </p>
                </div>

                {/* Target User Dropdown */}
                <div className="flex items-center gap-2">
                  <label htmlFor="user-inspector-select" className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">Target User:</label>
                  <select
                    id="user-inspector-select"
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="bg-[#FAF9F6] border border-[#E2E8F0] text-[#0F172A] font-mono text-xs rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#0F172A]"
                  >
                    {members.map((m) => (
                      <option key={m.id} value={m.user_id}>
                        {m.email} [{m.role.toUpperCase()}]
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Persona Context Card */}
              {explorerData && (
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5 pt-4 border-t border-[#E6E6E1]">
                  <div className="bg-[#FAF9F6] border border-[#E2E8F0] p-3.5 rounded-xl">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-[#64748B] font-semibold">User Role</div>
                    <div className="text-xs font-bold text-[#0F172A] uppercase mt-0.5 font-mono">
                      {explorerData.target_user.role}
                    </div>
                  </div>
                  <div className="bg-[#FAF9F6] border border-[#E2E8F0] p-3.5 rounded-xl">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-[#64748B] font-semibold">Assigned Groups</div>
                    <div className="text-xs font-semibold text-[#0F172A] mt-0.5 font-mono truncate">
                      {explorerData.target_user.groups.length > 0
                        ? explorerData.target_user.groups.map((g) => g.name).join(", ")
                        : "None"}
                    </div>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-xl">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-emerald-800 font-bold">Accessible Docs</div>
                    <div className="text-sm font-extrabold text-emerald-700 mt-0.5 font-mono">
                      {explorerData.accessible_documents} / {explorerData.total_documents}
                    </div>
                  </div>
                  <div className="bg-rose-50 border border-rose-200 p-3.5 rounded-xl">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-rose-800 font-bold">Denied Docs</div>
                    <div className="text-sm font-extrabold text-rose-700 mt-0.5 font-mono">
                      {explorerData.denied_documents} / {explorerData.total_documents}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Documents Evaluation Matrix */}
            <div className="bg-white border border-[#E6E6E1] rounded-2xl overflow-hidden shadow-card">
              <div className="px-6 py-4 border-b border-[#E6E6E1] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-bold text-[#0F172A]">Permission Evaluation Matrix</h3>
                  <div className="flex rounded-lg bg-[#FAF9F6] border border-[#E2E8F0] p-1 text-[11px] font-mono">
                    <button
                      type="button"
                      onClick={() => setExplorerFilter("all")}
                      className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
                        explorerFilter === "all" ? "bg-white text-[#0F172A] font-bold shadow-2xs border border-[#E6E6E1]" : "text-[#64748B]"
                      }`}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      onClick={() => setExplorerFilter("allowed")}
                      className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
                        explorerFilter === "allowed" ? "bg-emerald-100 text-emerald-900 font-bold shadow-2xs" : "text-[#64748B]"
                      }`}
                    >
                      Allowed ({explorerData?.accessible_documents || 0})
                    </button>
                    <button
                      type="button"
                      onClick={() => setExplorerFilter("denied")}
                      className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
                        explorerFilter === "denied" ? "bg-rose-100 text-rose-900 font-bold shadow-2xs" : "text-[#64748B]"
                      }`}
                    >
                      Denied ({explorerData?.denied_documents || 0})
                    </button>
                  </div>
                </div>

                <ExpandableSearch
                  placeholder="Filter by title or policy..."
                  onSearch={(q) => setExplorerSearch(q)}
                  variant="light"
                />
              </div>

              {loadingExplorer ? (
                <div className="p-12 text-center text-[#64748B] text-xs flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-[#0F172A] border-t-transparent rounded-full animate-spin" />
                  <span>Evaluating access policies...</span>
                </div>
              ) : filteredDocs.length === 0 ? (
                <div className="p-12 text-center text-[#64748B] text-xs">No documents match the current filter.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-[#F8FAFC] border-b border-[#E6E6E1] text-[#64748B] uppercase tracking-wider font-mono text-[11px]">
                      <tr>
                        <th className="px-6 py-3 font-semibold">Document</th>
                        <th className="px-6 py-3 font-semibold">Visibility</th>
                        <th className="px-6 py-3 font-semibold">Owner</th>
                        <th className="px-6 py-3 font-semibold">Access Verdict</th>
                        <th className="px-6 py-3 font-semibold">Authoritative Policy Reasoning</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E6E6E1] text-[#0F172A]">
                      {filteredDocs.map((doc) => (
                        <tr key={doc.document_id} className="hover:bg-[#FAF9F6] transition-colors">
                          <td className="px-6 py-3.5">
                            <div className="font-semibold text-[#0F172A] flex items-center gap-2">
                              <FileText className="w-3.5 h-3.5 text-[#64748B] shrink-0" />
                              <span>{doc.title}</span>
                            </div>
                            <div className="text-[11px] text-[#64748B] font-mono">{doc.chunk_count} searchable chunks</div>
                          </td>
                          <td className="px-6 py-3.5 whitespace-nowrap">
                            <span
                              className={`px-2.5 py-0.5 rounded-md text-[10px] font-mono font-semibold uppercase tracking-wider ${
                                doc.visibility === "tenant"
                                  ? "bg-sky-50 text-sky-800 border border-sky-200"
                                  : doc.visibility === "group"
                                  ? "bg-indigo-50 text-indigo-800 border border-indigo-200"
                                  : "bg-amber-50 text-amber-800 border border-amber-200"
                              }`}
                            >
                              {doc.visibility}
                            </span>
                          </td>
                          <td className="px-6 py-3.5 text-[#64748B] font-mono whitespace-nowrap">{doc.owner_email}</td>
                          <td className="px-6 py-3.5 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] font-mono font-bold tracking-wider ${
                                doc.access_status === "ALLOWED"
                                  ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                                  : "bg-rose-50 text-rose-800 border border-rose-200"
                              }`}
                            >
                              {doc.access_status === "ALLOWED" ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  <span>ALLOWED</span>
                                </>
                              ) : (
                                <>
                                  <X className="w-3 h-3 text-rose-600" />
                                  <span>DENIED</span>
                                </>
                              )}
                            </span>
                          </td>
                          <td className="px-6 py-3.5">
                            <div className="flex flex-wrap gap-1.5">
                              {doc.matched_rules.map((rule, idx) => (
                                <span
                                  key={idx}
                                  className={`px-2.5 py-0.5 rounded-md text-[10px] font-mono font-medium ${
                                    doc.access_status === "ALLOWED"
                                      ? "bg-emerald-50/70 text-emerald-900 border border-emerald-200"
                                      : "bg-rose-50/70 text-rose-900 border border-rose-200"
                                  }`}
                                >
                                  {rule}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
      <AppFooter />
    </div>
  );
}
