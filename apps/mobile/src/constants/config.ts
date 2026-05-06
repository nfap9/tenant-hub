type Env = Record<string, string | undefined>;

export const DEFAULT_API_BASE_URL = "http://localhost:4000/api";

export const resolveApiBaseUrl = (env: Env = {}) => {
  const configured = env.EXPO_PUBLIC_API_BASE_URL?.trim() || env.VITE_API_BASE_URL?.trim();
  return configured || DEFAULT_API_BASE_URL;
};

const runtimeEnv = (globalThis as { process?: { env?: Env } }).process?.env;

export const API_BASE_URL = resolveApiBaseUrl(runtimeEnv);
