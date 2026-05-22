import { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { getSession, setSession, clearSession, getOrgId, setOrgId } from "@/utils/storage";
import { getMe } from "@/api/auth";
import {
  getOrganizationMembers,
  getOrganizationRoles,
  getOrganizationSubscription,
} from "@/api/organization";
import { getPlatformInfo } from "@/api/platform";
import type { Membership, OrgMember, OrgRole } from "@/types/domain";

export type PlatformInfo = {
  name: string;
  logoUrl: string;
  contactPhone: string;
};

export type AppSession = {
  token: string;
  user: { id: string; phone: string; username: string };
};

type AppSessionContextType = {
  session: AppSession | undefined;
  memberships: Membership[];
  currentMembership: Membership | undefined;
  currentOrgId: string | undefined;
  setCurrentOrgId: (id: string) => void;
  members: OrgMember[];
  roles: OrgRole[];
  notice: string;
  setNotice: (n: string) => void;
  signIn: (s: AppSession) => Promise<void>;
  signOut: () => void;
  reload: () => Promise<void>;
  loading: boolean;
  platformInfo: PlatformInfo;
  quotaLimitEnabled: boolean;
  platformRole: string | undefined;
};

const AppSessionContext = createContext<AppSessionContextType | undefined>(undefined);

export function AppSessionProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [session, setSessionState] = useState<AppSession | undefined>(() => getSession());
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [currentOrgId, setCurrentOrgIdState] = useState<string | undefined>(() => getOrgId());
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [roles, setRoles] = useState<OrgRole[]>([]);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);

  const [platformInfo, setPlatformInfo] = useState<PlatformInfo>({ name: "Tenant Hub", logoUrl: "", contactPhone: "" });
  const [quotaLimitEnabled, setQuotaLimitEnabled] = useState(false);
  const [platformRole, setPlatformRole] = useState<string | undefined>(undefined);

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
        const me = await getMe();
        setMemberships(me.memberships);
        setPlatformRole(me.user.platformRole);
        setCurrentOrgIdState((old) => {
          const validOld = old && me.memberships.some((item) => item.organization.id === old);
          const nextId = validOld ? old : me.memberships[0]?.organization.id;
          if (nextId) setOrgId(nextId);
          return nextId;
        });
      } catch (e) {
        if (e instanceof Error && !e.message.includes("登录已过期")) {
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
        setQuotaLimitEnabled(false);
        return;
      }
      try {
        const [nextMembers, nextRoles, quotaOverview] = await Promise.all([
          getOrganizationMembers(organizationId),
          getOrganizationRoles(organizationId),
          getOrganizationSubscription(organizationId),
        ]);
        setMembers(nextMembers);
        setRoles(nextRoles);
        setQuotaLimitEnabled(quotaOverview.quotaLimitEnabled ?? false);
      } catch (e) {
        if (e instanceof Error && !e.message.includes("登录已过期")) {
          setNotice(e.message || "加载组织数据失败");
        }
      }
    },
    [currentOrgId, token]
  );

  const setCurrentOrgId = useCallback((id: string) => {
    setCurrentOrgIdState(id);
    setOrgId(id);
  }, []);

  const signIn = useCallback(
    async (nextSession: AppSession) => {
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
    setQuotaLimitEnabled(false);
    setPlatformRole(undefined);
    navigate("/login", { replace: true });
  }, [navigate]);

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
    const savedOrgId = getOrgId();
    if (savedOrgId) setCurrentOrgIdState(savedOrgId);
  }, []);

  // 启动时：加载平台信息（无需登录）
  useEffect(() => {
    getPlatformInfo()
      .then((info) => {
        if (info.name) setPlatformInfo(info);
      })
      .catch(() => undefined);
  }, []);

  // 启动时：检查登录状态
  useEffect(() => {
    const init = async () => {
      const s = getSession();
      if (!s?.token) {
        setLoading(false);
        return;
      }
      try {
        await loadMe(s.token);
      } finally {
        setLoading(false);
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
      quotaLimitEnabled,
      platformRole,
    }),
    [session, memberships, currentMembership, currentOrgId, members, roles, notice, loading, platformInfo, quotaLimitEnabled, platformRole, setCurrentOrgId, signIn, signOut, reload]
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

export function useHasPermission(permission: string): boolean {
  const { currentMembership } = useAppSession();
  return Boolean(
    currentMembership?.role.permissions.includes("*") ||
      currentMembership?.role.permissions.includes(permission)
  );
}
