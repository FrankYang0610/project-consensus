// API utility functions for backend requests
// This module contains all API-related helper functions

// Simple API helper for backend requests
export function getAPIBaseUrl(): string {
  // Prefer NEXT_PUBLIC_API_BASE_URL if provided, fallback to local dev default
  return process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
}

// Read a cookie value by name. Used for CSRF token.
export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const cookies = document.cookie ? document.cookie.split('; ') : [];
  for (const cookie of cookies) {
    const [key, ...rest] = cookie.split('=');
    if (key === name) {
      try {
        return decodeURIComponent(rest.join('='));
      } catch {
        return rest.join('=');
      }
    }
  }
  return null;
}

// Ensure CSRF cookie exists for session-authenticated write operations
export async function ensureCSRFCookie(): Promise<void> {
  const existing = getCookie('csrftoken');
  if (existing) return;
  const base = getAPIBaseUrl();
  try {
    await fetch(`${base}/api/accounts/csrf/`, {
      method: 'GET',
      credentials: 'include',
      headers: { 'Accept': 'application/json' },
    });
  } catch {
    // Best-effort only; backend may set CSRF later or be unnecessary in some contexts
  }
}

// HTTP error with status and response details for better downstream handling
export class HttpError extends Error {
  status: number;
  url: string;
  body: string;

  constructor(method: string, url: string, status: number, body: string) {
    super(`${method} ${url} failed: ${status} ${body}`);
    this.name = 'HttpError';
    this.status = status;
    this.url = url;
    this.body = body;
  }
}

export async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  const base = getAPIBaseUrl();
  const url = `${base}${path}`;
  const res = await fetch(url, {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Accept': 'application/json',
    },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new HttpError('GET', url, res.status, text);
  }
  return res.json();
}

export async function apiPost<T>(path: string, body: unknown, init?: RequestInit): Promise<T> {
  const base = getAPIBaseUrl();
  const url = `${base}${path}`;
  let csrftoken = getCookie('csrftoken');
  if (!csrftoken) {
    await ensureCSRFCookie();
    csrftoken = getCookie('csrftoken');
  }
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...(csrftoken ? { 'X-CSRFToken': csrftoken } : {}),
    },
    body: JSON.stringify(body ?? {}),
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new HttpError('POST', url, res.status, text);
  }
  return res.json();
}


export async function apiDeleteVoid(path: string, init?: RequestInit): Promise<void> {
  const base = getAPIBaseUrl();
  const url = `${base}${path}`;
  let csrftoken = getCookie('csrftoken');
  if (!csrftoken) {
    await ensureCSRFCookie();
    csrftoken = getCookie('csrftoken');
  }
  const res = await fetch(url, {
    method: 'DELETE',
    credentials: 'include',
    headers: {
      'Accept': 'application/json',
      ...(csrftoken ? { 'X-CSRFToken': csrftoken } : {}),
    },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new HttpError('DELETE', url, res.status, text);
  }
}

// CSRF-protected PATCH helper
export async function apiPatch<T>(path: string, body: unknown, init?: RequestInit): Promise<T> {
  const base = getAPIBaseUrl();
  const url = `${base}${path}`;
  let csrftoken = getCookie('csrftoken');
  if (!csrftoken) {
    await ensureCSRFCookie();
    csrftoken = getCookie('csrftoken');
  }
  const res = await fetch(url, {
    method: 'PATCH',
    credentials: 'include',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...(csrftoken ? { 'X-CSRFToken': csrftoken } : {}),
    },
    body: JSON.stringify(body ?? {}),
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new HttpError('PATCH', url, res.status, text);
  }
  return res.json();
}

// CSRF-protected multipart/form-data upload helper
export async function apiUpload<T>(path: string, formData: FormData, init?: RequestInit): Promise<T> {
  const base = getAPIBaseUrl();
  const url = `${base}${path}`;
  let csrftoken = getCookie('csrftoken');
  if (!csrftoken) {
    await ensureCSRFCookie();
    csrftoken = getCookie('csrftoken');
  }
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: {
      // Don't set Content-Type - browser will set it with boundary for multipart/form-data
      ...(csrftoken ? { 'X-CSRFToken': csrftoken } : {}),
    },
    body: formData,
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new HttpError('UPLOAD', url, res.status, text);
  }
  return res.json();
}
