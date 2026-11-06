import type { ApiError } from '@pinpoint/shared';

const TOKEN_KEY = 'pinpoint.token';

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, body: ApiError | null, fallback: string) {
    super(body?.error?.message ?? fallback);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = body?.error?.code ?? 'internal_error';
    this.details = body?.error?.details;
  }
}

export const tokenStore = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  },
  clear(): void {
    localStorage.removeItem(TOKEN_KEY);
  },
};

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  form?: FormData;
  signal?: AbortSignal;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = tokenStore.get();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body !== undefined) headers['content-type'] = 'application/json';

  const res = await fetch(`/api${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.form ?? (options.body !== undefined ? JSON.stringify(options.body) : undefined),
    signal: options.signal,
  });

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const parsed = text ? (JSON.parse(text) as unknown) : null;

  if (!res.ok) {
    if (res.status === 401) tokenStore.clear();
    throw new ApiRequestError(res.status, parsed as ApiError | null, `Request failed (${res.status})`);
  }
  return parsed as T;
}

export const apiGet = <T>(path: string) => api<T>(path);
export const apiPost = <T>(path: string, body?: unknown) => api<T>(path, { method: 'POST', body });
export const apiPatch = <T>(path: string, body?: unknown) => api<T>(path, { method: 'PATCH', body });
export const apiDelete = <T>(path: string) => api<T>(path, { method: 'DELETE' });
export const apiUpload = <T>(path: string, form: FormData) => api<T>(path, { method: 'POST', form });
