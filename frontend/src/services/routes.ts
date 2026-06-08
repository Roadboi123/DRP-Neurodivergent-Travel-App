import type { HttpClient } from '@/services/http-client';
import type { LocationSuggestion, RouteOption, WarningItem } from '@/types/route';

/** Build the `/routes/` query string, applying a username only when provided. */
function buildRoutesQuery(start: string, end: string, username: string): string {
  const startParam = encodeURIComponent(start.trim());
  const endParam = encodeURIComponent(end.trim());
  const userParam = username.trim()
    ? `&username=${encodeURIComponent(username.trim())}`
    : '';
  return `routes/?start=${startParam}&end=${endParam}${userParam}`;
}

function buildWarningsQuery(
  username: string,
  generic?: boolean,
  routeContext?: { lines: string[]; stations: string[] },
): string {
  const params: string[] = [];
  if (username.trim()) {
    params.push(`username=${encodeURIComponent(username.trim())}`);
  }
  if (generic) {
    params.push(`generic=true`);
  }
  if (routeContext?.lines?.length) {
    params.push(`lines=${encodeURIComponent(routeContext.lines.join(','))}`);
  }
  if (routeContext?.stations?.length) {
    params.push(`stations=${encodeURIComponent(routeContext.stations.join(','))}`);
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
   * Pass `routeContext` (lines/stations from the fetched route legs) so the
   * backend can filter warnings to those relevant to the actual journey.
   */
  getWarnings(
    username: string,
    generic?: boolean,
    routeContext?: { lines: string[]; stations: string[] },
  ): Promise<WarningItem[]>;

  /**
   * Fetch location suggestions based on search text query.
   */
  suggestLocations(query: string, userCoords?: string | null): Promise<LocationSuggestion[]>;
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
    getWarnings(username, generic, routeContext) {
      const query = buildWarningsQuery(username, generic, routeContext);
      return client.get<WarningItem[]>(`/${query}`);
    },
    suggestLocations(query, userCoords) {
      const queryParam = encodeURIComponent(query.trim());
      const coordParam = userCoords ? `&user_coords=${encodeURIComponent(userCoords.trim())}` : '';
      return client.get<LocationSuggestion[]>(`/routes/suggest-locations?q=${queryParam}${coordParam}`);
    },
  };
}
