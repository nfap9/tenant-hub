const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";

export type Session = {
  token?: string;
  organizationId?: string;
  user?: { id: string; phone: string; username: string; platformRole?: string };
};

export const readSession = (): Session => JSON.parse(localStorage.getItem("tenantHubSession") || "{}");

export const writeSession = (patch: Partial<Session>) => {
  const next = { ...readSession(), ...patch };
  localStorage.setItem("tenantHubSession", JSON.stringify(next));
  return next;
};

export const clearSession = () => localStorage.removeItem("tenantHubSession");

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const session = readSession();
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(session.token ? { authorization: `Bearer ${session.token}` } : {}),
      ...(session.organizationId ? { "x-organization-id": session.organizationId } : {}),
      ...options.headers
    }
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(body.error || "请求失败");
  return body.data;
}
