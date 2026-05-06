import { API_BASE_URL } from "../constants/config";

const parseJsonBody = (text: string): Record<string, unknown> => {
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { error: text };
  }
};

const errorMessage = (body: Record<string, unknown>) => (typeof body.error === "string" && body.error.trim() ? body.error : "请求失败");

export async function mobileApi<T>(path: string, token?: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });
  const text = await response.text();
  const body = parseJsonBody(text);
  if (!response.ok) throw new Error(errorMessage(body));
  return body.data as T;
}

export async function mobileText(path: string, token?: string, options: RequestInit = {}): Promise<string> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(errorMessage(parseJsonBody(text)));
  }
  return text;
}
