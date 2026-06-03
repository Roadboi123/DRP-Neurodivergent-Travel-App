import type { HttpClient } from '@/services/http-client';
import type { RouteOption } from '@/types/route';

/** Build the `/routes/` query string, applying a username only when provided. */
function buildRoutesQuery(start: string, end: string, username: string): string {
  const startParam = encodeURIComponent(start.trim());
  const endParam = encodeURIComponent(end.trim());
  const userParam = username.trim()
    ? `&username=${encodeURIComponent(username.trim())}`
    : '';
  return `routes/?start=${startParam}&end=${endParam}${userParam}`;
}

export interface RoutesService {
  /**
   * Fetch route suggestions. Throws if the (possibly failover-wrapped) client
   * cannot reach a backend; callers decide how to surface that.
   */
  getRoutes(start: string, end: string, username: string): Promise<RouteOption[]>;
}

/**
 * Build a {@link RoutesService} over an injected client. Production→local
 * failover, when desired, is supplied by handing in a fallback client at the
 * composition root — this service stays unaware of it.
 */
export function createRoutesService(client: HttpClient): RoutesService {
  return {
    getRoutes(start, end, username) {
      const query = buildRoutesQuery(start, end, username);
      // Trailing slash is already part of the query to avoid an HTTP redirect.
      return client.get<RouteOption[]>(`/${query}`);
    },
  };
}
