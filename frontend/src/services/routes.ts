import type { HttpClient } from '@/services/http-client';
import type { RouteOption, WarningItem } from '@/types/route';

/** Build the `/routes/` query string, applying a username only when provided. */
function buildRoutesQuery(start: string, end: string, username: string): string {
  const startParam = encodeURIComponent(start.trim());
  const endParam = encodeURIComponent(end.trim());
  const userParam = username.trim()
    ? `&username=${encodeURIComponent(username.trim())}`
    : '';
  return `routes/?start=${startParam}&end=${endParam}${userParam}`;
}

function buildWarningsQuery(username: string, generic?: boolean): string {
  const params: string[] = [];
  if (username.trim()) {
    params.push(`username=${encodeURIComponent(username.trim())}`);
  }
  if (generic) {
    params.push(`generic=true`);
  }
  const queryStr = params.length > 0 ? `?${params.join('&')}` : '';
  return `routes/warnings${queryStr}`;
}

export interface RoutesService {
  /**
   * Fetch route suggestions. Throws if the (possibly failover-wrapped) client
   * cannot reach a backend; callers decide how to surface that.
   */
  getRoutes(start: string, end: string, username: string): Promise<RouteOption[]>;
  
  /**
   * Fetch live warnings tailored to the user's sensory sensitivities.
   */
  getWarnings(username: string, generic?: boolean): Promise<WarningItem[]>;
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
    getWarnings(username, generic) {
      const query = buildWarningsQuery(username, generic);
      return client.get<WarningItem[]>(`/${query}`);
    },
  };
}
