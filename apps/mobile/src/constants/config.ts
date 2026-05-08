import { Platform } from "react-native";
// @ts-expect-error - react-native-dotenv generates this module at build time
import { API_BASE_URL as ENV_API_BASE_URL } from "@env";

type Env = Record<string, string | undefined>;

export const DEFAULT_API_BASE_URL =
  Platform.OS === "android"
    ? "http://10.0.2.2:4000/api"
    : "http://localhost:4000/api";

export const resolveApiBaseUrl = (env: Env = {}) => {
  const configured = env.API_BASE_URL?.trim() || ENV_API_BASE_URL?.trim();
  return configured || DEFAULT_API_BASE_URL;
};

const runtimeEnv = (globalThis as { process?: { env?: Env } }).process?.env;

export const API_BASE_URL = resolveApiBaseUrl(runtimeEnv);
