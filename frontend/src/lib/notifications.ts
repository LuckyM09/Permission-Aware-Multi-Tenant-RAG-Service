export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  type: "success" | "security" | "info" | "warning";
  read: boolean;
  userEmail?: string;
}

const STORAGE_KEY_PREFIX = "vaultrag_notifications_";

export function getNotificationsKey(userEmail?: string): string {
  return `${STORAGE_KEY_PREFIX}${userEmail ? userEmail.toLowerCase().trim() : "default"}`;
}

export function loadStoredNotifications(userEmail?: string): NotificationItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(getNotificationsKey(userEmail));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveStoredNotifications(
  notifications: NotificationItem[],
  userEmail?: string
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getNotificationsKey(userEmail), JSON.stringify(notifications));
  } catch {
    // Ignore localStorage storage quota or access errors
  }
}

export function addNotification(notification: {
  title: string;
  description: string;
  type?: "success" | "security" | "info" | "warning";
  userEmail?: string;
  read?: boolean;
}): void {
  if (typeof window === "undefined") return;

  const item: NotificationItem = {
    id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    title: notification.title,
    description: notification.description,
    timestamp: "Just now",
    type: notification.type || "success",
    read: notification.read ?? false,
    userEmail: notification.userEmail,
  };

  const current = loadStoredNotifications(notification.userEmail);
  // Avoid duplicate notifications with identical title and description
  const isDuplicate = current.some(
    (n) => n.title === item.title && n.description === item.description
  );

  if (!isDuplicate) {
    const updated = [item, ...current].slice(0, 20);
    saveStoredNotifications(updated, notification.userEmail);
  }

  // Dispatch custom window event so any mounted NotificationBell updates instantly
  window.dispatchEvent(
    new CustomEvent("vaultrag:new_notification", {
      detail: item,
    })
  );
}

