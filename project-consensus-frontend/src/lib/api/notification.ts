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

/**
 * Fetches SSE availability status from the server.
 * Returns true if SSE is enabled, false otherwise.
 * This allows the client to skip SSE connection attempts when the server has SSE disabled.
 */
export async function fetchSSEStatus(): Promise<boolean> {
  try {
    const res = await apiGet<{ sseEnabled: boolean }>(`/api/notifications/sse_status/`);
    return res?.sseEnabled ?? false;
  } catch {
    // If status check fails, assume SSE is disabled to be safe
    return false;
  }
}

// Opens a session-authenticated SSE connection via cookies (default method).
// Note: For cross-subdomain usage or SameSite cookie issues, consider using a short-lived token flow.
export async function openNotificationSSE(): Promise<EventSource> {
  const base = getAPIBaseUrl();
  const url = `${base}/api/notifications/stream/`;
  // Use withCredentials to send session cookie with SSE
  // For older TS versions (4.8 and below), use: new (EventSource as any)(url, { withCredentials: true })
  const es = new EventSource(url, { withCredentials: true });
  return es;
}
