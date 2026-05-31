import { apiClient } from './client';
import type { AppSession } from '@/context/AppSessionContext';
import type { Membership } from '@/types/domain';

export type LoginResult = {
  token: string;
  user: AppSession['user'];
};

export type SendOtpInput = {
  phone: string;
  purpose: 'REGISTER' | 'LOGIN' | 'RESET_PASSWORD';
};

export type PasswordLoginInput = {
  phone: string;
  password: string;
};

export type OtpLoginInput = {
  phone: string;
  code: string;
};

export type RegisterInput = {
  phone: string;
  username: string;
  password: string;
  confirmPassword: string;
  code: string;
};

export type UpdatePasswordInput = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export type ResetPasswordInput = {
  phone: string;
  code: string;
  password: string;
  confirmPassword: string;
};

export async function sendOtp(input: SendOtpInput) {
  return apiClient<{ message: string }>('/auth/otp', {
    method: 'POST',
    body: input as Record<string, unknown>,
  });
}

export async function loginWithPassword(input: PasswordLoginInput) {
  return apiClient<LoginResult>('/auth/login/password', {
    method: 'POST',
    body: input as Record<string, unknown>,
  });
}

export async function loginWithOtp(input: OtpLoginInput) {
  return apiClient<LoginResult>('/auth/login/otp', {
    method: 'POST',
    body: input as Record<string, unknown>,
  });
}

export async function register(input: RegisterInput) {
  return apiClient<LoginResult>('/auth/register', {
    method: 'POST',
    body: input as Record<string, unknown>,
  });
}

export async function getMe() {
  return apiClient<{
    user: AppSession['user'] & { platformRole?: string };
    memberships: Membership[];
  }>('/auth/me');
}

export async function updatePassword(input: UpdatePasswordInput) {
  return apiClient<{ message: string }>('/auth/password', {
    method: 'PUT',
    body: input as Record<string, unknown>,
  });
}

export async function resetPassword(input: ResetPasswordInput) {
  return apiClient<{ message: string }>('/auth/reset-password', {
    method: 'POST',
    body: input as Record<string, unknown>,
  });
}

export async function updateMe(input: { username: string }) {
  return apiClient<AppSession['user']>('/auth/me', {
    method: 'PUT',
    body: input as Record<string, unknown>,
  });
}

export async function logout() {
  return apiClient<{ message: string }>('/auth/logout', {
    method: 'POST',
  });
}

export async function refreshToken() {
  return apiClient<LoginResult>('/auth/refresh', {
    method: 'POST',
  });
}
