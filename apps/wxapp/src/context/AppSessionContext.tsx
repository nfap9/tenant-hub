// @ts-nocheck
import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import Taro from '@tarojs/taro';
import { apiClient } from '../api/client';
import { getSession, setSession, clearSession } from '../utils/storage';
import type { Membership, OrgMember, OrgRole } from '../types/domain';

export type MobileSession = {
  token: string;
  user: { id: string; phone: string; username: string };
};

type AppSessionContextType = {
  session: MobileSession | undefined;
  memberships: Membership[];
  currentMembership: Membership | undefined;
  currentOrgId: string | undefined;
  setCurrentOrgId: (id: string) => void;
  members: OrgMember[];
  roles: OrgRole[];
  notice: string;
  setNotice: (n: string) => void;
  signIn: (s: MobileSession) => void;
  signOut: () => void;
  reload: () => Promise<void>;
  loading: boolean;
};

const AppSessionContext = createContext<AppSessionContextType | undefined>(undefined);

export function AppSessionProvider({ children }) {
  const [session, setSessionState] = useState<MobileSession | undefined>(() => getSession());
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [currentOrgId, setCurrentOrgIdState] = useState<string | undefined>();
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [roles, setRoles] = useState<OrgRole[]>([]);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  const token = session?.token;
  const currentMembership = useMemo(
    () => memberships.find((item) => item.organization.id === currentOrgId),
    [currentOrgId, memberships]
  );

  const loadMe = useCallback(
    async (nextToken = token) => {
      if (!nextToken) return;
      try {
        const me = await apiClient<{ user: MobileSession["user"]; memberships: Membership[] }>("/auth/me");
        setMemberships(me.memberships);
        setCurrentOrgIdState((old) =>
          old && me.memberships.some((item) => item.organization.id === old)
            ? old
            : me.memberships[0]?.organization.id
        );
      } catch (e) {
        setNotice(e instanceof Error ? e.message : "加载用户信息失败");
      }
    },
    [token]
  );

  const loadOrgData = useCallback(
    async (organizationId = currentOrgId) => {
      if (!token || !organizationId) {
        setMembers([]);
        setRoles([]);
        return;
      }
      try {
        const [nextMembers, nextRoles] = await Promise.all([
          apiClient<OrgMember[]>(`/organizations/${organizationId}/members`, { organizationId }),
          apiClient<OrgRole[]>(`/organizations/${organizationId}/roles`, { organizationId }),
        ]);
        setMembers(nextMembers);
        setRoles(nextRoles);
      } catch (e) {
        setNotice(e instanceof Error ? e.message : "加载组织数据失败");
      }
    },
    [currentOrgId, token]
  );

  const setCurrentOrgId = useCallback((id: string) => {
    setCurrentOrgIdState(id);
    Taro.setStorageSync('tenantHubCurrentOrgId', id);
  }, []);

  const signIn = useCallback(
    (nextSession: MobileSession) => {
      setSession(nextSession);
      setSessionState(nextSession);
      loadMe(nextSession.token).catch((error) => setNotice(error.message));
    },
    [loadMe]
  );

  const signOut = useCallback(() => {
    clearSession();
    setSessionState(undefined);
    setMemberships([]);
    setCurrentOrgIdState(undefined);
    setMembers([]);
    setRoles([]);
    Taro.removeStorageSync('tenantHubCurrentOrgId');
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      await loadMe();
      await loadOrgData();
    } finally {
      setLoading(false);
    }
  }, [loadMe, loadOrgData]);

  useEffect(() => {
    try {
      const savedOrgId = Taro.getStorageSync('tenantHubCurrentOrgId');
      if (savedOrgId) setCurrentOrgIdState(savedOrgId);
    } catch {}
  }, []);

  useEffect(() => {
    if (session?.token) {
      loadMe(session.token).catch((error) => setNotice(error.message));
    }
  }, []);

  useEffect(() => {
    loadOrgData().catch((error) => setNotice(error.message));
  }, [loadOrgData]);

  const value = useMemo(
    () => ({
      session,
      memberships,
      currentMembership,
      currentOrgId,
      setCurrentOrgId,
      members,
      roles,
      notice,
      setNotice,
      signIn,
      signOut,
      reload,
      loading,
    }),
    [session, memberships, currentMembership, currentOrgId, members, roles, notice, loading, setCurrentOrgId, signIn, signOut, reload]
  );

  return (
    <AppSessionContext.Provider value={value}>
      {children}
    </AppSessionContext.Provider>
  );
}

export function useAppSession() {
  const ctx = useContext(AppSessionContext);
  if (!ctx) throw new Error("useAppSession must be used within AppSessionProvider");
  return ctx;
}

export function useHasPermission(permission: string) {
  const { currentMembership } = useAppSession();
  return Boolean(
    currentMembership?.role.permissions.includes("*") ||
    currentMembership?.role.permissions.includes(permission)
  );
}
