const SESSION_KEY = 'tenantHubSession';

export const storage = {
  getItem<T>(key: string): T | undefined {
    try {
      const raw = wx.getStorageSync(key);
      return raw ? (JSON.parse(raw) as T) : undefined;
    } catch {
      return undefined;
    }
  },

  setItem<T>(key: string, value: T): void {
    try {
      wx.setStorageSync(key, JSON.stringify(value));
    } catch {
      // Silent fail
    }
  },

  removeItem(key: string): void {
    try {
      wx.removeStorageSync(key);
    } catch {
      // Silent fail
    }
  },

  // Convenience aliases for session
  getSession<T>(): T | undefined {
    return this.getItem<T>(SESSION_KEY);
  },

  setSession<T>(value: T): void {
    this.setItem(SESSION_KEY, value);
  },

  clearSession(): void {
    this.removeItem(SESSION_KEY);
  }
};
