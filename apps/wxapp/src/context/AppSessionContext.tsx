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

export type PlatformInfo = {
  name: string;
  logoUrl: string;
  contactPhone: string;
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
  signIn: (s: MobileSession) => Promise<void>;
  signOut: () => void;
  reload: () => Promise<void>;
  loading: boolean;
  platformInfo: PlatformInfo;
};

const AppSessionContext = createContext<AppSessionContextType | undefined>(undefined);

const isLoginPageActive = () => {
  try {
    const pages = Taro.getCurrentPages?.() ?? [];
    const current = pages[pages.length - 1];
    return current?.route === 'pages/login/index';
  } catch {
    return false;
  }
};

export function AppSessionProvider({ children }) {
  const [session, setSessionState] = useState<MobileSession | undefined>(() => getSession());
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [currentOrgId, setCurrentOrgIdState] = useState<string | undefined>();
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [roles, setRoles] = useState<OrgRole[]>([]);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [platformInfo, setPlatformInfo] = useState<PlatformInfo>({ name: 'Tenant Hub', logoUrl: '', contactPhone: '' });

  const token = session?.token;
  const currentMembership = useMemo(
    () => memberships.find((item) => item.organization.id === currentOrgId),
    [currentOrgId, memberships]
  );

  const loadMe = useCallback(
    async (nextToken = token) => {
      if (!nextToken) {
        setMemberships([]);
        return;
      }
      try {
        const me = await apiClient<{ user: MobileSession["user"]; memberships: Membership[] }>("/auth/me");
        setMemberships(me.memberships);
        setCurrentOrgIdState((old) =>
          old && me.memberships.some((item) => item.organization.id === old)
            ? old
            : me.memberships[0]?.organization.id
        );
      } catch (e) {
        // 401 已在 apiClient 中处理（跳转登录页），其他错误显示提示
        if (e instanceof Error && !e.message.includes('登录已过期')) {
          setNotice(e.message || "加载用户信息失败");
        }
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
        if (e instanceof Error && !e.message.includes('登录已过期')) {
          setNotice(e.message || "加载组织数据失败");
        }
      }
    },
    [currentOrgId, token]
  );

  const setCurrentOrgId = useCallback((id: string) => {
    setCurrentOrgIdState(id);
    Taro.setStorageSync('tenantHubCurrentOrgId', id);
  }, []);

  const signIn = useCallback(
    async (nextSession: MobileSession) => {
      setSession(nextSession);
      setSessionState(nextSession);
      await loadMe(nextSession.token);
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
    Taro.reLaunch({ url: '/pages/login/index' });
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

  // 启动时：从 storage 恢复 orgId
  useEffect(() => {
    try {
      const savedOrgId = Taro.getStorageSync('tenantHubCurrentOrgId');
      if (savedOrgId) setCurrentOrgIdState(savedOrgId);
    } catch {}
  }, []);

  // 启动时：加载平台信息（无需登录）
  useEffect(() => {
    apiClient<PlatformInfo>("/platform/info")
      .then((info) => {
        if (info.name) {
          setPlatformInfo(info);
          Taro.setNavigationBarTitle({ title: info.name });
        }
      })
      .catch(() => undefined);
  }, []);

  // 启动时：检查登录状态，无 token 则跳登录页，有 token 则加载用户信息
  useEffect(() => {
    const init = async () => {
      const s = getSession();
      if (!s?.token) {
        setLoading(false);
        setAuthChecked(true);
        if (!isLoginPageActive()) {
          Taro.reLaunch({ url: '/pages/login/index' });
        }
        return;
      }
      try {
        await loadMe(s.token);
      } finally {
        setLoading(false);
        setAuthChecked(true);
      }
    };
    init();
  }, []);

  // token/组织变化时加载组织数据
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
      platformInfo,
    }),
    [session, memberships, currentMembership, currentOrgId, members, roles, notice, loading, platformInfo, setCurrentOrgId, signIn, signOut, reload]
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
