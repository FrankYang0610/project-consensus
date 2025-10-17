import type { PaginatedResponse } from '@/types/api/common';
import type { NotificationItem } from '@/types/api/notification';
import { apiGet, apiPost, apiDeleteVoid, getAPIBaseUrl } from './api-utils';

export async function fetchNotifications(params?: { page?: number; pageSize?: number; unreadOnly?: boolean }): Promise<PaginatedResponse<NotificationItem>> {
  const q = new URLSearchParams();
  if (params?.page) q.set('page', String(params.page));
  if (params?.pageSize) q.set('page_size', String(params.pageSize));
  if (params?.unreadOnly) q.set('unreadOnly', '1');
  return apiGet(`/api/notifications/${q.toString() ? `?${q.toString()}` : ''}`);
}

export async function fetchUnreadCount(): Promise<number> {
  const res = await apiGet<{ count: number }>(`/api/notifications/unread_count/`);
  return Number(res?.count ?? 0);
}

export async function markRead(id: number): Promise<void> {
  await apiPost(`/api/notifications/mark_read/`, { id });
}

export async function markAllRead(): Promise<void> {
  await apiPost(`/api/notifications/mark_all_read/`, {});
}

export async function deleteRead(): Promise<void> {
  await apiPost(`/api/notifications/delete_read/`, {});
}

export function openNotificationSSE(): EventSource {
  const sseBase = process.env.NEXT_PUBLIC_SSE_BASE_URL || getAPIBaseUrl();
  const url = `${sseBase}/api/notifications/stream/`;
  // Use withCredentials to send session cookie with SSE
  // For older TS versions (4.8 and below), use: new (EventSource as any)(url, { withCredentials: true })
  const es = new EventSource(url, { withCredentials: true });
  return es;
}
