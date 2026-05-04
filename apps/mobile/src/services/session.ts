import type { MobileSession } from "../types/auth";

const MOBILE_SESSION_KEY = "tenantHubMobileSession";

type WebStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

export const readMobileSession = (): MobileSession | undefined => {
  const storage = (globalThis as { localStorage?: WebStorage }).localStorage;
  if (!storage) return undefined;
  const value = storage.getItem(MOBILE_SESSION_KEY);
  return value ? JSON.parse(value) : undefined;
};

export const writeMobileSession = (session: MobileSession) => {
  const storage = (globalThis as { localStorage?: WebStorage }).localStorage;
  storage?.setItem(MOBILE_SESSION_KEY, JSON.stringify(session));
};

export const clearMobileSession = () => {
  const storage = (globalThis as { localStorage?: WebStorage }).localStorage;
  storage?.removeItem(MOBILE_SESSION_KEY);
};
