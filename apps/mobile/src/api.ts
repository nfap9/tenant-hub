const API_BASE = "http://localhost:4000/api";

export type MobileSession = {
  token: string;
  user: { id: string; phone: string; username: string };
};

export const readMobileSession = (): MobileSession | undefined => {
  const storage = (globalThis as any).localStorage;
  if (!storage) return undefined;
  const value = storage.getItem("tenantHubMobileSession");
  return value ? JSON.parse(value) : undefined;
};

export const writeMobileSession = (session: MobileSession) => {
  const storage = (globalThis as any).localStorage;
  storage?.setItem("tenantHubMobileSession", JSON.stringify(session));
};

export const clearMobileSession = () => {
  const storage = (globalThis as any).localStorage;
  storage?.removeItem("tenantHubMobileSession");
};

export async function mobileApi<T>(path: string, token?: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(body.error || "请求失败");
  return body.data;
}
