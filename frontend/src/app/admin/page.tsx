"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { DevUserSwitcher } from "@/components/dev-user-switcher";

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
  const [authData, setAuthData] = useState<UserContextData | null>(null);
  const [activeTab, setActiveTab] = useState<"members" | "groups" | "explorer">("members");

  // Members state
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [loadingMembers, setLoadingMembers] = useState<boolean>(true);
  const [inviteEmail, setInviteEmail] = useState<string>("");
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
        if (data.length > 0 && !selectedUserId) {
          setSelectedUserId(data[0].user_id);
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
  }, [selectedUserId]);

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
    fetchSession();
    fetchMembers();
    fetchGroups();
  }, [fetchSession, fetchMembers, fetchGroups]);

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
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      if (res.ok) {
        setInviteEmail("");
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
    if (!confirm(`Are you sure you want to delete group "${name}"?`)) return;
    setGroupActionError(null);
    try {
      const res = await fetch(`/api/tenants/groups/${groupId}`, {
        method: "DELETE",
      });
      if (res.ok) {
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
    const targetUserId = selectedGroupAddUser[groupId];
    if (!targetUserId) return;
    setGroupActionError(null);
    try {
      const res = await fetch(`/api/tenants/groups/${groupId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: targetUserId }),
      });
      if (res.ok) {
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <Link href="/documents" className="flex items-center space-x-2">
              <span className="text-xl font-bold bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
                VaultRAG
              </span>
              <span className="text-xs uppercase tracking-wider px-2 py-0.5 rounded bg-blue-900/40 border border-blue-700/50 text-blue-300 font-semibold">
                Admin
              </span>
            </Link>

            <nav className="hidden md:flex space-x-4">
              <Link
                href="/documents"
                className="text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors px-3 py-1.5 rounded-md hover:bg-slate-800/50"
              >
                Documents
              </Link>
              <Link
                href="/chat"
                className="text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors px-3 py-1.5 rounded-md hover:bg-slate-800/50"
              >
                Chat
              </Link>
              <Link
                href="/audit"
                className="text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors px-3 py-1.5 rounded-md hover:bg-slate-800/50"
              >
                Audit Log
              </Link>
              <Link
                href="/admin"
                className="text-sm font-medium text-blue-400 bg-blue-950/40 border border-blue-800/50 px-3 py-1.5 rounded-md"
              >
                Tenant Admin
              </Link>
            </nav>
          </div>

          <div className="flex items-center space-x-4">
            <DevUserSwitcher onSwitched={() => {
              fetchSession();
              fetchMembers();
              fetchGroups();
            }} />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Title & Tenant Info Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <h1 className="text-2xl font-bold text-slate-100 flex items-center space-x-2">
              <span>Tenant Administration</span>
              <span className="text-xs bg-indigo-950 border border-indigo-700/50 text-indigo-300 font-medium px-2.5 py-0.5 rounded-full">
                Active Tenant: {authData?.tenants?.find((t) => t.is_current)?.name || "Default"}
              </span>
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Manage member roles, configure permission groups, and run the authoritative Access Explorer to inspect document visibility rules.
            </p>
          </div>

          {/* Tab Navigation */}
          <div className="flex rounded-lg bg-slate-900 border border-slate-800 p-1">
            <button
              onClick={() => setActiveTab("members")}
              className={`px-4 py-2 text-xs font-semibold rounded-md transition-all ${
                activeTab === "members"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Members ({members.length})
            </button>
            <button
              onClick={() => setActiveTab("groups")}
              className={`px-4 py-2 text-xs font-semibold rounded-md transition-all ${
                activeTab === "groups"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Groups ({groups.length})
            </button>
            <button
              onClick={() => setActiveTab("explorer")}
              className={`px-4 py-2 text-xs font-semibold rounded-md transition-all flex items-center space-x-1.5 ${
                activeTab === "explorer"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-indigo-400 hover:text-indigo-200"
              }`}
            >
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
              <div className="p-3 bg-red-950/60 border border-red-800 text-red-300 rounded-lg text-xs">
                {memberActionError}
              </div>
            )}

            {/* Add Member Card */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-200 mb-3">Add Existing User to Tenant</h2>
              <form onSubmit={handleInviteMember} className="flex flex-col sm:flex-row gap-3">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="user@acme.com"
                  required
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as "admin" | "member" | "viewer")}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                  <option value="viewer">Viewer</option>
                </select>
                <button
                  type="submit"
                  disabled={inviting}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors"
                >
                  {inviting ? "Adding..." : "Add Member"}
                </button>
              </form>
            </div>

            {/* Members Table */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-200">Tenant Members</h3>
                <span className="text-xs text-slate-400">{members.length} members</span>
              </div>

              {loadingMembers ? (
                <div className="p-8 text-center text-slate-400 text-sm">Loading tenant members...</div>
              ) : members.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">No members found in this tenant.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                      <tr>
                        <th className="px-5 py-3">Member</th>
                        <th className="px-5 py-3">Current Role</th>
                        <th className="px-5 py-3">Assigned Groups</th>
                        <th className="px-5 py-3">Joined</th>
                        <th className="px-5 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {members.map((m) => (
                        <tr key={m.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="px-5 py-4">
                            <div className="font-medium text-slate-100">{m.email}</div>
                            {m.first_name || m.last_name ? (
                              <div className="text-slate-400 text-xs">{m.first_name} {m.last_name}</div>
                            ) : null}
                          </td>
                          <td className="px-5 py-4">
                            <select
                              value={m.role}
                              onChange={(e) =>
                                handleRoleChange(m.id, e.target.value as "admin" | "member" | "viewer")
                              }
                              className={`text-xs font-semibold px-2.5 py-1 rounded-md border bg-slate-950 focus:outline-none ${
                                m.role === "admin"
                                  ? "text-purple-300 border-purple-800"
                                  : m.role === "member"
                                  ? "text-emerald-300 border-emerald-800"
                                  : "text-slate-400 border-slate-700"
                              }`}
                            >
                              <option value="admin">Admin</option>
                              <option value="member">Member</option>
                              <option value="viewer">Viewer</option>
                            </select>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex flex-wrap gap-1.5">
                              {m.groups && m.groups.length > 0 ? (
                                m.groups.map((g) => (
                                  <span
                                    key={g.id}
                                    className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 text-[11px]"
                                  >
                                    {g.name}
                                  </span>
                                ))
                              ) : (
                                <span className="text-slate-500 italic text-[11px]">No groups</span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-4 text-slate-400">
                            {new Date(m.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-5 py-4 text-right">
                            <button
                              onClick={() => handleRemoveMember(m.id, m.email)}
                              className="text-red-400 hover:text-red-300 text-xs hover:underline font-medium"
                            >
                              Remove
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
              <div className="p-3 bg-red-950/60 border border-red-800 text-red-300 rounded-lg text-xs">
                {groupActionError}
              </div>
            )}

            {/* Create Group Card */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-200 mb-3">Create New Access Control Group</h2>
              <form onSubmit={handleCreateGroup} className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="Group Name (e.g. Legal, Finance, Engineering)"
                  required
                  className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 sm:w-1/3"
                />
                <input
                  type="text"
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  placeholder="Optional description"
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
                <button
                  type="submit"
                  disabled={creatingGroup}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors"
                >
                  {creatingGroup ? "Creating..." : "Create Group"}
                </button>
              </form>
            </div>

            {/* Groups Grid */}
            {loadingGroups ? (
              <div className="p-8 text-center text-slate-400 text-sm">Loading groups...</div>
            ) : groups.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm bg-slate-900/40 rounded-xl border border-slate-800">
                No access groups configured yet. Create one above to grant fine-grained document access.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {groups.map((group) => (
                  <div
                    key={group.id}
                    className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 flex flex-col justify-between shadow-sm"
                  >
                    <div>
                      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                        <div>
                          <h3 className="font-semibold text-slate-100 text-sm">{group.name}</h3>
                          {group.description && (
                            <p className="text-xs text-slate-400 mt-0.5">{group.description}</p>
                          )}
                        </div>
                        <button
                          onClick={() => handleDeleteGroup(group.id, group.name)}
                          className="text-red-400 hover:text-red-300 text-xs font-medium hover:underline"
                        >
                          Delete
                        </button>
                      </div>

                      {/* Group Members List */}
                      <div className="mt-4 space-y-2">
                        <div className="text-xs font-semibold text-slate-400 flex items-center justify-between">
                          <span>Group Members</span>
                          <span className="text-[11px] bg-slate-800 px-2 py-0.5 rounded text-slate-300">
                            {group.members.length} members
                          </span>
                        </div>

                        {group.members.length === 0 ? (
                          <p className="text-xs text-slate-500 italic py-2">No users assigned to this group.</p>
                        ) : (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {group.members.map((gm) => (
                              <span
                                key={gm.id}
                                className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-xs text-slate-200"
                              >
                                <span>{gm.email}</span>
                                <button
                                  onClick={() => handleRemoveUserFromGroup(group.id, gm.user_id)}
                                  className="text-slate-400 hover:text-red-400 transition-colors font-bold ml-1"
                                  title="Remove from group"
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Add Member to Group Selector */}
                    <div className="mt-5 pt-3 border-t border-slate-800 flex items-center space-x-2">
                      <select
                        value={selectedGroupAddUser[group.id] || ""}
                        onChange={(e) =>
                          setSelectedGroupAddUser((prev) => ({
                            ...prev,
                            [group.id]: e.target.value,
                          }))
                        }
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-md px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
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
                        onClick={() => handleAddUserToGroup(group.id)}
                        disabled={!selectedGroupAddUser[group.id]}
                        className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 font-medium px-3 py-1.5 rounded-md text-xs transition-colors"
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
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-slate-100 flex items-center space-x-2">
                    <span>Access Policy Simulation Engine</span>
                    <span className="text-[11px] bg-emerald-950 border border-emerald-800 text-emerald-300 px-2 py-0.5 rounded-full font-medium">
                      Rule #4 SSOT Active
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Select any tenant user to simulate the exact SQL WHERE clauses generated by the permissions engine. Inspect why each document is allowed or blocked.
                  </p>
                </div>

                {/* Target User Dropdown */}
                <div className="flex items-center space-x-2">
                  <label htmlFor="user-inspector-select" className="text-xs font-semibold text-slate-400">Target User:</label>
                  <select
                    id="user-inspector-select"
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="bg-slate-950 border border-indigo-700/60 text-indigo-200 font-medium text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    {members.map((m) => (
                      <option key={m.id} value={m.user_id}>
                        {m.email} — [{m.role.toUpperCase()}]
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Persona Context Card */}
              {explorerData && (
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-3 border-t border-slate-800/80">
                  <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-lg">
                    <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">User Role</div>
                    <div className="text-sm font-bold text-slate-100 uppercase mt-0.5">
                      {explorerData.target_user.role}
                    </div>
                  </div>
                  <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-lg">
                    <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">Assigned Groups</div>
                    <div className="text-sm font-medium text-slate-200 mt-0.5">
                      {explorerData.target_user.groups.length > 0
                        ? explorerData.target_user.groups.map((g) => g.name).join(", ")
                        : "None"}
                    </div>
                  </div>
                  <div className="bg-emerald-950/30 border border-emerald-900/60 p-3 rounded-lg">
                    <div className="text-[11px] uppercase tracking-wider text-emerald-400 font-semibold">Accessible Docs</div>
                    <div className="text-sm font-bold text-emerald-300 mt-0.5">
                      {explorerData.accessible_documents} / {explorerData.total_documents}
                    </div>
                  </div>
                  <div className="bg-red-950/30 border border-red-900/60 p-3 rounded-lg">
                    <div className="text-[11px] uppercase tracking-wider text-red-400 font-semibold">Denied Docs</div>
                    <div className="text-sm font-bold text-red-300 mt-0.5">
                      {explorerData.denied_documents} / {explorerData.total_documents}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Documents Evaluation Matrix */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <h3 className="text-sm font-semibold text-slate-200">Permission Evaluation Matrix</h3>
                  <div className="flex rounded-md bg-slate-950 border border-slate-800 p-0.5 text-[11px]">
                    <button
                      onClick={() => setExplorerFilter("all")}
                      className={`px-2.5 py-1 rounded font-medium ${
                        explorerFilter === "all" ? "bg-slate-800 text-slate-100" : "text-slate-400"
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setExplorerFilter("allowed")}
                      className={`px-2.5 py-1 rounded font-medium ${
                        explorerFilter === "allowed" ? "bg-emerald-900/60 text-emerald-300" : "text-slate-400"
                      }`}
                    >
                      Allowed ({explorerData?.accessible_documents || 0})
                    </button>
                    <button
                      onClick={() => setExplorerFilter("denied")}
                      className={`px-2.5 py-1 rounded font-medium ${
                        explorerFilter === "denied" ? "bg-red-900/60 text-red-300" : "text-slate-400"
                      }`}
                    >
                      Denied ({explorerData?.denied_documents || 0})
                    </button>
                  </div>
                </div>

                <input
                  type="text"
                  value={explorerSearch}
                  onChange={(e) => setExplorerSearch(e.target.value)}
                  placeholder="Filter by title or policy..."
                  className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 sm:w-64"
                />
              </div>

              {loadingExplorer ? (
                <div className="p-8 text-center text-slate-400 text-sm">Evaluating access policies...</div>
              ) : filteredDocs.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">No documents match the current filter.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                      <tr>
                        <th className="px-5 py-3">Document</th>
                        <th className="px-5 py-3">Visibility</th>
                        <th className="px-5 py-3">Owner</th>
                        <th className="px-5 py-3">Access Verdict</th>
                        <th className="px-5 py-3">Authoritative Policy Reasoning</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {filteredDocs.map((doc) => (
                        <tr key={doc.document_id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="px-5 py-4">
                            <div className="font-medium text-slate-100">{doc.title}</div>
                            <div className="text-[11px] text-slate-500">{doc.chunk_count} searchable chunks</div>
                          </td>
                          <td className="px-5 py-4">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                doc.visibility === "tenant"
                                  ? "bg-blue-900/40 text-blue-300 border border-blue-800/50"
                                  : doc.visibility === "group"
                                  ? "bg-amber-900/40 text-amber-300 border border-amber-800/50"
                                  : "bg-purple-900/40 text-purple-300 border border-purple-800/50"
                              }`}
                            >
                              {doc.visibility}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-slate-400">{doc.owner_email}</td>
                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wider ${
                                doc.access_status === "ALLOWED"
                                  ? "bg-emerald-950/80 text-emerald-300 border border-emerald-800/60"
                                  : "bg-red-950/80 text-red-300 border border-red-800/60"
                              }`}
                            >
                              {doc.access_status === "ALLOWED" ? "✓ ALLOWED" : "✕ DENIED"}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex flex-wrap gap-1.5">
                              {doc.matched_rules.map((rule, idx) => (
                                <span
                                  key={idx}
                                  className={`px-2 py-0.5 rounded text-[11px] font-mono ${
                                    doc.access_status === "ALLOWED"
                                      ? "bg-emerald-950/50 text-emerald-200 border border-emerald-800/40"
                                      : "bg-red-950/50 text-red-200 border border-red-800/40"
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
    </div>
  );
}
