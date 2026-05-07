import type { MobileSession } from "../types/auth";

const MOBILE_SESSION_KEY = "tenantHubMobileSession";

type WebStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

export const readMobileSession = (): MobileSession | undefined => {
  try {
    const storage = (globalThis as { localStorage?: WebStorage }).localStorage;
    if (!storage) return undefined;
    const value = storage.getItem(MOBILE_SESSION_KEY);
    return value ? JSON.parse(value) : undefined;
  } catch {
    return undefined;
  }
};

export const writeMobileSession = (session: MobileSession) => {
  try {
    const storage = (globalThis as { localStorage?: WebStorage }).localStorage;
    storage?.setItem(MOBILE_SESSION_KEY, JSON.stringify(session));
  } catch {
    // Native storage can be unavailable during Expo lifecycle transitions.
  }
};

export const clearMobileSession = () => {
  try {
    const storage = (globalThis as { localStorage?: WebStorage }).localStorage;
    storage?.removeItem(MOBILE_SESSION_KEY);
  } catch {
    // Ignore storage cleanup failures so sign out can still reset in-memory state.
  }
};
