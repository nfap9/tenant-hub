import { apiClient } from './client';

export type Notification = {
  id: string;
  organizationId: string;
  userId: string;
  type: string;
  title: string;
  content: string;
  link?: string;
  readAt?: string;
  createdAt: string;
};

export async function getNotifications(
  organizationId: string,
  unreadOnly?: boolean
) {
  const query = unreadOnly ? '?unreadOnly=true' : '';
  return apiClient<Notification[]>(`/notifications${query}`, {
    organizationId,
  });
}

export async function getUnreadCount(organizationId: string) {
  return apiClient<{ count: number }>('/notifications/unread-count', {
    organizationId,
  });
}

export async function markNotificationRead(organizationId: string, id: string) {
  return apiClient<{ read: boolean }>(`/notifications/${id}/read`, {
    method: 'PATCH',
    organizationId,
  });
}

export async function markAllNotificationsRead(organizationId: string) {
  return apiClient<{ readAll: boolean }>('/notifications/read-all', {
    method: 'POST',
    organizationId,
  });
}

export async function deleteNotification(organizationId: string, id: string) {
  return apiClient<{ deleted: boolean }>(`/notifications/${id}`, {
    method: 'DELETE',
    organizationId,
  });
}
