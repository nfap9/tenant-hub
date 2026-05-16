import Taro from '@tarojs/taro';

export type WxappSession = {
  token: string;
  user: { id: string; phone: string; username: string };
};

const SESSION_KEY = 'tenantHubWxappSession';

export function getSession(): WxappSession | undefined {
  try {
    return Taro.getStorageSync(SESSION_KEY) || undefined;
  } catch {
    return undefined;
  }
}

export function setSession(session: WxappSession): void {
  Taro.setStorageSync(SESSION_KEY, session);
}

export function clearSession(): void {
  Taro.removeStorageSync(SESSION_KEY);
}
