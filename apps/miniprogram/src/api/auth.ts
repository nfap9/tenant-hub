import { apiClient } from './client';
import type { MobileSession } from '../context/AppSessionContext';

export async function getMe(): Promise<{
  user: MobileSession['user'];
  memberships: import('../types/domain').Membership[];
}> {
  return apiClient('/auth/me');
}

export async function loginPassword(payload: {
  phone: string;
  password: string;
}): Promise<MobileSession> {
  return apiClient('/auth/login/password', {
    method: 'POST',
    body: payload,
  });
}

export async function loginOtp(payload: {
  phone: string;
  code: string;
}): Promise<MobileSession> {
  return apiClient('/auth/login/otp', {
    method: 'POST',
    body: payload,
  });
}

export async function register(payload: {
  phone: string;
  username: string;
  password: string;
  confirmPassword: string;
  code?: string;
}): Promise<MobileSession> {
  return apiClient('/auth/register', {
    method: 'POST',
    body: payload,
  });
}

export async function sendOtp(payload: {
  phone: string;
  purpose: 'REGISTER' | 'LOGIN';
}): Promise<void> {
  return apiClient('/auth/otp', {
    method: 'POST',
    body: payload,
  });
}

export async function updatePassword(payload: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<void> {
  return apiClient('/auth/password', {
    method: 'PUT',
    body: payload,
  });
}
