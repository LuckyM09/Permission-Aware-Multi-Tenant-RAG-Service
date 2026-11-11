"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Bell,
  CheckCircle2,
  Shield,
  FileCheck,
  X,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  NotificationItem,
  loadStoredNotifications,
  saveStoredNotifications,
} from "@/lib/notifications";

export interface NotificationBellProps extends React.HTMLAttributes<HTMLDivElement> {
  userEmail?: string;
}

export function NotificationBell({ className, userEmail }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isRinging, setIsRinging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load notifications from scoped localStorage on mount and when user changes
  useEffect(() => {
    const loaded = loadStoredNotifications(userEmail);
    setNotifications(loaded);
  }, [userEmail]);

  // Listen for live new notification events emitted from across the application
  useEffect(() => {
    const handleNewNotification = (e: Event) => {
      const customEvent = e as CustomEvent<NotificationItem>;
      if (!customEvent.detail) return;
      const item = customEvent.detail;
      // Only accept if notification matches current user or is global
      if (!item.userEmail || !userEmail || item.userEmail.toLowerCase() === userEmail.toLowerCase()) {
        setNotifications((prev) => {
          if (prev.some((n) => n.id === item.id)) return prev;
          const updated = [item, ...prev].slice(0, 20);
          saveStoredNotifications(updated, userEmail);
          return updated;
        });
        setIsRinging(true);
        setTimeout(() => setIsRinging(false), 800);
      }
    };

    window.addEventListener("vaultrag:new_notification", handleNewNotification);
    return () => {
      window.removeEventListener("vaultrag:new_notification", handleNewNotification);
    };
  }, [userEmail]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => {
      const updated = prev.map((n) => ({ ...n, read: true }));
      saveStoredNotifications(updated, userEmail);
      return updated;
    });
  }, [userEmail]);

  const clearNotification = useCallback(
    (id: string) => {
      setNotifications((prev) => {
        const updated = prev.filter((n) => n.id !== id);
        saveStoredNotifications(updated, userEmail);
        return updated;
      });
    },
    [userEmail]
  );

  return (
    <div ref={containerRef} className={cn("relative inline-block", className)}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => {
          setOpen(!open);
          setIsRinging(true);
          setTimeout(() => setIsRinging(false), 800);
        }}
        onMouseEnter={() => setIsRinging(true)}
        onMouseLeave={() => setIsRinging(false)}
        aria-label="Workspace notifications"
        aria-expanded={open}
        className={cn(
          "relative p-2 rounded-xl border border-[#E6E6E1] bg-white hover:bg-[#FAF9F6] text-[#52525B] hover:text-[#0F172A] transition-all shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F172A] cursor-pointer",
          open && "bg-[#FAF9F6] border-[#0F172A] text-[#0F172A]"
        )}
      >
        <Bell
          className={cn(
            "w-4 h-4 transition-transform duration-300",
            isRinging && "animate-[bell-ring_0.6s_ease-in-out]"
          )}
        />

        {/* Unread Ping Badge: ONLY rendered when real unread notifications exist */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00D2FF] opacity-75" />
            <span className="relative inline-flex rounded-full h-4 w-4 bg-[#0F172A] text-white text-[9px] font-mono font-bold items-center justify-center border border-white">
              {unreadCount}
            </span>
          </span>
        )}
      </button>

      {/* Floating Notification Popover */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-2xl border border-[#E6E6E1] bg-white p-4 shadow-elevated z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between border-b border-[#E6E6E1] pb-3 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#0F172A]">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-sky-50 text-[#0284C7] border border-sky-200">
                  {unreadCount} new
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="text-[11px] font-semibold text-[#0284C7] hover:text-[#0F172A] transition-colors cursor-pointer"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notification List */}
          <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#64748B] space-y-1.5">
                <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1 opacity-80" />
                <p className="font-semibold text-[#0F172A]">All caught up</p>
                <p className="text-[11px] text-[#64748B] max-w-xs mx-auto leading-relaxed">
                  Notifications for document ready, chunking status, and workspace events will appear here.
                </p>
              </div>
            ) : (
              notifications.map((item) => {
                const isDocReady = item.title.toLowerCase().includes("doc") || item.title.toLowerCase().includes("ready");
                const isSignup = item.title.toLowerCase().includes("welcome");

                return (
                  <div
                    key={item.id}
                    className={cn(
                      "p-3 rounded-xl border transition-all flex items-start gap-2.5 relative group",
                      item.read
                        ? "bg-white border-[#E6E6E1] opacity-75"
                        : "bg-[#FAF9F6] border-[#CBD5E1] shadow-2xs"
                    )}
                  >
                    <div className="w-7 h-7 rounded-lg bg-white border border-[#E6E6E1] flex items-center justify-center shrink-0 shadow-2xs text-[#0284C7]">
                      {isDocReady ? (
                        <FileCheck className="w-3.5 h-3.5 text-emerald-600" />
                      ) : isSignup ? (
                        <Sparkles className="w-3.5 h-3.5 text-[#0284C7]" />
                      ) : item.type === "security" ? (
                        <Shield className="w-3.5 h-3.5 text-[#00D2FF]" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#0F172A] truncate">
                          {item.title}
                        </span>
                        <span className="text-[10px] font-mono text-[#64748B]">
                          {item.timestamp}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#52525B] leading-snug">
                        {item.description}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => clearNotification(item.id)}
                      aria-label="Dismiss notification"
                      className="opacity-0 group-hover:opacity-100 text-[#94A3B8] hover:text-rose-600 transition-opacity p-0.5 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          <div className="pt-3 mt-3 border-t border-[#E6E6E1] flex items-center justify-between text-[11px] text-[#64748B]">
            <span>System Security Status</span>
            <span className="flex items-center gap-1 font-mono text-emerald-600 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Healthy
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
