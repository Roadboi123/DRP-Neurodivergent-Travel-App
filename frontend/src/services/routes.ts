import type { HttpClient } from '@/services/http-client';
import type { LocationSuggestion, RouteOption, WarningItem } from '@/types/route';

/** Optional departure/arrival timing for a route search. */
export interface RouteTimeQuery {
  /** ISO-8601 local timestamp, e.g. "2026-06-14T10:35". Omit to plan for "now". */
  time?: string;
  /** Whether `time` is the desired departure or arrival instant. */
  timeIs?: 'departing' | 'arriving';
}

/** Build the `/routes/` query string, applying a username only when provided. */
function buildRoutesQuery(
  start: string,
  end: string,
  username: string,
  timing?: RouteTimeQuery,
  reroute?: boolean,
): string {
  const startParam = encodeURIComponent(start.trim());
  const endParam = encodeURIComponent(end.trim());
  const userParam = username.trim()
    ? `&username=${encodeURIComponent(username.trim())}`
    : '';
  const timeParam = timing?.time
    ? `&time=${encodeURIComponent(timing.time)}&time_is=${timing.timeIs ?? 'departing'}`
    : '';
  const rerouteParam = reroute ? `&reroute=true` : '';
  return `routes/?start=${startParam}&end=${endParam}${userParam}${timeParam}${rerouteParam}`;
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

/** Outcome of {@link RoutesService.reportWarning}. */
export type ReportWarningResult =
  | { duplicate: false; warning: WarningItem }
  | { duplicate: true };

export interface RoutesService {
  /**
   * Fetch route suggestions. Throws if the (possibly failover-wrapped) client
   * cannot reach a backend; callers decide how to surface that.
   */
  getRoutes(
    start: string,
    end: string,
    username: string,
    timing?: RouteTimeQuery,
    reroute?: boolean,
  ): Promise<RouteOption[]>;
  
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
   * Submit a user-reported sensory warning to persist on the backend.
   *
   * Resolves to `{ duplicate: true }` when the backend rejects the report as a
   * spam/near-duplicate (HTTP 409) so the caller can show a friendly notice,
   * or `{ duplicate: false, warning }` with the persisted item on success.
   */
  reportWarning(body: {
    id: string;
    username: string;
    warning_type: string;
    title: string;
    desc: string;
    lat: number;
    lon: number;
  }): Promise<ReportWarningResult>;

  /**
   * Delete a warning from the database. Owner-only on the backend: pass the
   * current `username`; only the reporter's own warning is removed.
   */
  deleteWarning(warningId: string, username: string): Promise<{ deleted: boolean }>;

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
    getRoutes(start, end, username, timing, reroute) {
      const query = buildRoutesQuery(start, end, username, timing, reroute);
      // Trailing slash is already part of the query to avoid an HTTP redirect.
      return client.get<RouteOption[]>(`/${query}`);
    },
    getWarnings(username, generic, routeContext) {
      const query = buildWarningsQuery(username, generic, routeContext);
      return client.get<WarningItem[]>(`/${query}`);
    },
    async reportWarning(body) {
      // Use the raw response so a 409 (near-duplicate) is treated as data, not a
      // thrown error that would otherwise trip the production→local failover.
      const res = await client.postResponse('/routes/warnings/report', body);
      if (res.status === 409) {
        return { duplicate: true };
      }
      if (!res.ok) {
        throw new Error(`Failed to report warning: HTTP ${res.status}`);
      }
      const warning = (await res.json()) as WarningItem;
      return { duplicate: false, warning };
    },
    deleteWarning(warningId, username) {
      return client.delete<{ deleted: boolean }>(
        `/routes/warnings/${encodeURIComponent(warningId)}?username=${encodeURIComponent(username)}`,
      );
    },
    suggestLocations(query, userCoords) {
      const queryParam = encodeURIComponent(query.trim());
      const coordParam = userCoords ? `&user_coords=${encodeURIComponent(userCoords.trim())}` : '';
      return client.get<LocationSuggestion[]>(`/routes/suggest-locations?q=${queryParam}${coordParam}`);
    },
  };
}

