import { apiClient } from "./client";
import type { Plan } from "@/types/domain";

// 运营总览
export async function getAdminSummary() {
  return apiClient<{
    organizations: number;
    users: number;
    apartments: number;
    rooms: number;
    activeLeases: number;
    unpaidBills: number;
  }>("/admin/summary");
}

export async function getAdminOrganizations() {
  return apiClient<
    Array<{
      id: string;
      name: string;
      code: string;
      status: string;
      _count?: { apartments: number; members: number; bills: number };
      subscriptions?: Array<{ active: boolean; endsAt?: string; plan?: { name: string } }>;
    }>
  >("/admin/organizations");
}

// 用户管理
export async function getAdminUsers(keyword?: string) {
  return apiClient<
    Array<{
      id: string;
      username: string;
      phone: string;
      platformRole: string;
      _count?: { memberships: number };
    }>
  >(`/admin/users${keyword ? `?keyword=${encodeURIComponent(keyword)}` : ""}`);
}

export async function updateUserPlatformRole(userId: string, platformRole: string) {
  return apiClient<void>(`/admin/users/${userId}/platform-role`, {
    method: "PUT",
    body: { platformRole },
  });
}

// 套餐配置
export async function getAdminPlans() {
  return apiClient<Plan[]>("/admin/plans");
}

export async function createAdminPlan(payload: {
  name: string;
  apartmentLimit: number;
  roomLimit: number;
  memberLimit: number;
  price: number;
}) {
  return apiClient<Plan>("/admin/plans", { method: "POST", body: payload });
}

export async function updateAdminPlan(planId: string, payload: { enabled: boolean }) {
  return apiClient<Plan>(`/admin/plans/${planId}`, { method: "PUT", body: payload });
}

// 角色权限
export async function getAdminRoles() {
  return apiClient<
    Array<{
      id: string;
      code: string;
      name: string;
      description?: string;
      system: boolean;
      permissions: string[];
    }>
  >("/admin/roles");
}

export async function createAdminRole(payload: {
  code: string;
  name: string;
  description?: string;
  permissions: string[];
}) {
  return apiClient<{ id: string }>("/admin/roles", { method: "POST", body: payload });
}

export async function updateAdminRole(roleId: string, payload: {
  code?: string;
  name?: string;
  description?: string;
  permissions: string[];
}) {
  return apiClient<void>(`/admin/roles/${roleId}`, { method: "PUT", body: payload });
}

export async function deleteAdminRole(roleId: string) {
  return apiClient<void>(`/admin/roles/${roleId}`, { method: "DELETE" });
}

// 短信配置
export async function getSmsConfig() {
  return apiClient<{
    value?: {
      url?: string;
      method?: "GET" | "POST" | "PUT";
      headers?: Record<string, string>;
      params?: Record<string, string>;
    };
  }>("/admin/settings/sms_config");
}

export async function updateSmsConfig(payload: {
  value: {
    url: string;
    method: "GET" | "POST" | "PUT";
    headers: Record<string, string>;
    params: Record<string, string>;
  };
  description: string;
}) {
  return apiClient<void>("/admin/settings/sms_config", { method: "PUT", body: payload });
}

// 系统配置
export async function getQuotaLimitEnabled() {
  return apiClient<{ value?: { enabled: boolean } }>("/admin/settings/quota_limit_enabled");
}

export async function updateQuotaLimitEnabled(payload: {
  value: { enabled: boolean };
  description: string;
}) {
  return apiClient<void>("/admin/settings/quota_limit_enabled", { method: "PUT", body: payload });
}

export async function getPlatformInfoSetting() {
  return apiClient<{ value?: { name: string; logoUrl: string; contactPhone: string } }>("/admin/settings/platform_info");
}

export async function updatePlatformInfoSetting(payload: {
  value: { name: string; logoUrl: string; contactPhone: string };
  description: string;
}) {
  return apiClient<void>("/admin/settings/platform_info", { method: "PUT", body: payload });
}
