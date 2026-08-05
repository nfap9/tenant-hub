import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import {
  fetchMe,
  login as loginApi,
  type Membership,
  type SessionUser,
} from '@/api/auth';

const TOKEN_KEY = 'tenantHub.token';
const ORG_KEY = 'tenantHub.currentOrgId';

/**
 * 会话状态机：
 * - loading：启动恢复中（或正在验证 token）
 * - signedOut：未登录
 * - needsOrg：已登录但还没选择组织
 * - ready：已登录且已选组织，可进入主界面
 */
export type SessionStatus = 'loading' | 'signedOut' | 'needsOrg' | 'ready';

type SessionState = {
  status: SessionStatus;
  token: string | null;
  user: SessionUser | null;
  memberships: Membership[];
  currentOrgId: string | null;
  /** 启动时恢复会话：读本地 token，验证并拉取组织列表 */
  restore: () => Promise<void>;
  login: (phone: string, password: string) => Promise<void>;
  selectOrg: (orgId: string) => Promise<void>;
  /** 已登录状态下重新选择组织（设置页「切换组织」入口） */
  switchOrg: () => void;
  logout: () => Promise<void>;
  /** API 返回 401 时调用：清空会话回到登录页 */
  handleUnauthorized: () => void;
};

const signedOutState = {
  status: 'signedOut' as SessionStatus,
  token: null,
  user: null,
  memberships: [],
  currentOrgId: null,
};

export const useSessionStore = create<SessionState>((set, get) => {
  /** token 验证通过后，根据已保存的 orgId 决定进入 ready 还是 needsOrg */
  const applyMe = async (user: SessionUser, memberships: Membership[]) => {
    const savedOrgId = await SecureStore.getItemAsync(ORG_KEY);
    const valid =
      savedOrgId != null &&
      memberships.some((m) => m.organization.id === savedOrgId);
    if (valid) {
      set({ status: 'ready', user, memberships, currentOrgId: savedOrgId });
    } else {
      if (savedOrgId != null) await SecureStore.deleteItemAsync(ORG_KEY);
      set({ status: 'needsOrg', user, memberships, currentOrgId: null });
    }
  };

  return {
    status: 'loading',
    token: null,
    user: null,
    memberships: [],
    currentOrgId: null,

    restore: async () => {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      if (!token) {
        set(signedOutState);
        return;
      }
      // 先写入 token，fetchMe 才能带上 Authorization
      set({ token, status: 'loading' });
      try {
        const { user, memberships } = await fetchMe();
        await applyMe(user, memberships);
      } catch {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        await SecureStore.deleteItemAsync(ORG_KEY);
        set(signedOutState);
      }
    },

    login: async (phone, password) => {
      const { user, token } = await loginApi(phone, password);
      await SecureStore.setItemAsync(TOKEN_KEY, token);
      set({ token });
      const { memberships } = await fetchMe();
      await applyMe(user, memberships);
    },

    selectOrg: async (orgId) => {
      await SecureStore.setItemAsync(ORG_KEY, orgId);
      set({ currentOrgId: orgId, status: 'ready' });
    },

    switchOrg: () => {
      if (get().status !== 'ready') return;
      set({ status: 'needsOrg', currentOrgId: null });
    },

    logout: async () => {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(ORG_KEY);
      set(signedOutState);
    },

    handleUnauthorized: () => {
      if (get().status === 'signedOut') return;
      void SecureStore.deleteItemAsync(TOKEN_KEY);
      void SecureStore.deleteItemAsync(ORG_KEY);
      set(signedOutState);
    },
  };
});
