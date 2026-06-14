import type { RouteTimeQuery } from '@/services/routes';
import type { RouteOption } from '@/types/route';

/**
 * How the user wants the journey timed:
 * - `now`    — leave right now (the default; no specific time sent to the backend).
 * - `leave`  — depart at a chosen time.
 * - `arrive` — arrive by a chosen time.
 */
export type JourneyTimeMode = 'now' | 'leave' | 'arrive';

export interface JourneyTime {
  mode: JourneyTimeMode;
  /**
   * Epoch ms of the chosen leave/arrive instant. For `now` this is the moment
   * the search was issued — kept around as a stable reference for the on-card
   * fallback (offline routes that carry no live timetable).
   */
  at: number;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Naive *local* ISO string (`YYYY-MM-DDTHH:mm`) — no timezone, as TfL expects. */
export function toLocalISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 24-hour `HH:MM` clock label for the small card indicator. */
export function formatClock(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Map the chosen time to the backend query — `now` plans for the server's clock. */
export function toRouteTimeQuery(t: JourneyTime): RouteTimeQuery | undefined {
  if (t.mode === 'now') return undefined;
  return {
    time: toLocalISO(new Date(t.at)),
    timeIs: t.mode === 'arrive' ? 'arriving' : 'departing',
  };
}

/**
 * The small grey "Leave at/by HH:MM" line for a route card. Prefers the live
 * timetable's real departure (which already snaps to the next viable service);
 * for offline routes with no `departs_at` (e.g. walking) it derives the leave
 * time from the requested instant and the route duration.
 */
export function leaveIndicator(
  route: Pick<RouteOption, 'departs_at' | 'duration'>,
  t: JourneyTime,
): { label: string; time: string } {
  const arriving = t.mode === 'arrive';

  let depMs: number | null = null;
  if (route.departs_at) {
    const parsed = Date.parse(route.departs_at);
    if (!Number.isNaN(parsed)) depMs = parsed;
  }
  if (depMs == null) {
    depMs = arriving ? t.at - route.duration * 60_000 : t.at;
  }

  return { label: arriving ? 'Leave by' : 'Leave at', time: formatClock(new Date(depMs)) };
}
