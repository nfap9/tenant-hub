import type { AppSession } from '@/context/AppSessionContext';
import type { SystemRole } from '@/types/domain';

const SESSION_KEY = 'tenantHubSession';
const ORG_KEY = 'tenantHubCurrentOrgId';

type WebSession = {
  token: string;
  user: {
    id: string;
    phone: string;
    username: string;
    systemRole?: string | null;
  };
};

export function getSession(): AppSession | undefined {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as WebSession;
    return {
      token: parsed.token,
      user: {
        id: parsed.user.id,
        phone: parsed.user.phone,
        username: parsed.user.username,
        systemRole: (parsed.user.systemRole as SystemRole) ?? null,
      },
    };
  } catch {
    return undefined;
  }
}

export function setSession(session: AppSession) {
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
