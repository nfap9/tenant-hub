const SESSION_KEY = "tenantHubSession";
const ORG_KEY = "tenantHubCurrentOrgId";

export type WebSession = {
  token: string;
  user: { id: string; phone: string; username: string };
};

export function getSession(): WebSession | undefined {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return undefined;
    return JSON.parse(raw) as WebSession;
  } catch {
    return undefined;
  }
}

export function setSession(session: WebSession) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(ORG_KEY);
}

export function getOrgId(): string | undefined {
  return localStorage.getItem(ORG_KEY) || undefined;
}

export function setOrgId(id: string) {
  localStorage.setItem(ORG_KEY, id);
}
