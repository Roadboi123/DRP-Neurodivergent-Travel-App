/**
 * The single place that knows how to talk HTTP to a backend: it owns base-URL
 * concatenation, JSON headers/serialization, response-status checking, and JSON
 * parsing. Services depend on the {@link HttpClient} interface and never touch
 * `fetch`, a base URL, or a host string directly.
 */

import { authStore } from '@/services/auth-store';

/** Thrown by {@link HttpClient.get}/{@link HttpClient.post} when a response is not `ok`. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly path: string
  ) {
    super(`HTTP ${status} for ${path}`);
    this.name = 'HttpError';
  }
}

export interface HttpClient {
  /** GET `path`, parse JSON as `T`. Throws {@link HttpError} on a non-ok response. */
  get<T>(path: string): Promise<T>;
  /** POST `body` as JSON to `path`, parse JSON as `T`. Throws {@link HttpError} on a non-ok response. */
  post<T>(path: string, body: unknown): Promise<T>;
  /** DELETE `path`, parse JSON as `T`. Throws {@link HttpError} on a non-ok response. */
  delete<T>(path: string): Promise<T>;
  /**
   * GET `path` returning the raw {@link Response} without status checking or
   * parsing — for callers that treat specific statuses (e.g. 404) as data
   * rather than an error.
   */
  getResponse(path: string): Promise<Response>;
  /**
   * POST `body` returning the raw {@link Response} without status checking or
   * parsing — for callers that treat a specific status (e.g. 409 conflict) as
   * data rather than an error.
   */
  postResponse(path: string, body: unknown): Promise<Response>;
}

export interface HttpClientOptions {
  /** Absolute origin (and optional prefix) every path is resolved against. */
  baseUrl: string;
}

/** Build an {@link HttpClient} bound to a single `baseUrl`. */
export function createHttpClient({ baseUrl }: HttpClientOptions): HttpClient {
  const url = (path: string) => `${baseUrl}${path}`;

  const getHeaders = (extraHeaders: Record<string, string> = {}): HeadersInit => {
    const headers: Record<string, string> = { ...extraHeaders };
    const token = authStore.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  };

  async function parse<T>(res: Response, path: string): Promise<T> {
    if (res.status === 401) {
      authStore.triggerUnauthorized();
      throw new HttpError(res.status, path);
    }
    if (!res.ok) {
      throw new HttpError(res.status, path);
    }
    return (await res.json()) as T;
  }

  return {
    async get<T>(path: string): Promise<T> {
      const res = await fetch(url(path), {
        headers: getHeaders(),
      });
      return parse<T>(res, path);
    },

    async post<T>(path: string, body: unknown): Promise<T> {
      const res = await fetch(url(path), {
        method: 'POST',
        headers: getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(body),
      });
      return parse<T>(res, path);
    },

    async delete<T>(path: string): Promise<T> {
      const res = await fetch(url(path), {
        method: 'DELETE',
        headers: getHeaders(),
      });
      return parse<T>(res, path);
    },

    async getResponse(path: string): Promise<Response> {
      const res = await fetch(url(path), {
        headers: getHeaders(),
      });
      if (res.status === 401) {
        authStore.triggerUnauthorized();
      }
      return res;
    },

    async postResponse(path: string, body: unknown): Promise<Response> {
      const res = await fetch(url(path), {
        method: 'POST',
        headers: getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(body),
      });
      if (res.status === 401) {
        authStore.triggerUnauthorized();
      }
      return res;
    },
  };
}
