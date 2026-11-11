import { useState, useEffect, useCallback } from "react";

export interface UserContextData {
  authenticated: boolean;
  user?: {
    id: string;
    email: string;
    full_name: string;
    is_platform_owner?: boolean;
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

const STORAGE_KEY = "vaultrag_auth_session";
let memorySession: UserContextData | null = null;
let inflightPromise: Promise<UserContextData> | null = null;

export function getCachedAuthSession(): UserContextData | null {
  if (memorySession && memorySession.authenticated) {
    return memorySession;
  }
  if (typeof window !== "undefined") {
    try {
      const stored = window.sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as UserContextData;
        if (parsed && typeof parsed === "object" && parsed.authenticated) {
          memorySession = parsed;
          return memorySession;
        }
      }
    } catch {
      // Ignore sessionStorage parsing or quota errors
    }
  }
  return null;
}

export function setCachedAuthSession(data: UserContextData | null): void {
  memorySession = data;
  if (typeof window !== "undefined") {
    try {
      if (data && data.authenticated) {
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } else {
        window.sessionStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Ignore sessionStorage errors
    }
  }
}

export function clearCachedAuthSession(): void {
  memorySession = null;
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
  }
}

export async function fetchAuthSession(force = false): Promise<UserContextData> {
  if (!force && inflightPromise) {
    return inflightPromise;
  }

  inflightPromise = (async () => {
    try {
      const res = await fetch("/api/auth/me", {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (!res.ok) {
        const unauth: UserContextData = { authenticated: false };
        setCachedAuthSession(unauth);
        return unauth;
      }
      const data: UserContextData = await res.json();
      setCachedAuthSession(data);
      return data;
    } catch {
      const cached = getCachedAuthSession();
      if (!force && cached) {
        return cached;
      }
      const unauth: UserContextData = { authenticated: false };
      setCachedAuthSession(unauth);
      return unauth;
    } finally {
      inflightPromise = null;
    }
  })();

  return inflightPromise;
}

/**
 * React hook that returns the cached authentication session immediately if present,
 * and revalidates in the background (stale-while-revalidate pattern) so tab switching
 * is instantaneous without flashing full-page loaders.
 */
export function useAuthSession() {
  const [authData, setAuthData] = useState<UserContextData | null>(() => getCachedAuthSession());
  const [authLoading, setAuthLoading] = useState<boolean>(() => {
    const cached = getCachedAuthSession();
    return !cached || !cached.authenticated;
  });

  const refreshSession = useCallback(async (force = false) => {
    try {
      const fresh = await fetchAuthSession(force);
      setAuthData(fresh);
      return fresh;
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  return {
    authData,
    authLoading,
    setAuthData,
    refreshSession,
  };
}

