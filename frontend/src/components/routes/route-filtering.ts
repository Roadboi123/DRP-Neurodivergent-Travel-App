import type { RouteOption } from '@/types/route';

/**
 * Client-side filtering/sorting for the routes screen.
 *
 * Everything here is derived from the *frozen* `GET /routes/` contract — no
 * backend or schema changes. Kept as pure functions (no React) so the screen
 * stays thin and these can be unit-tested.
 */

// Which "best by" summary cards to pin at the top; both default on. At least one
// must stay on (the screen guards against turning the last one off).
export type BestByFilter = { preference: boolean; speed: boolean };

// A/C preference. 'any' = don't care, 'preferred' = float A/C routes first,
// 'every' = only keep routes that are air conditioned throughout.
export type AcFilter = 'any' | 'preferred' | 'every';

export interface RouteFilters {
  bestBy: BestByFilter;
  ac: AcFilter;
  groupByChanges: boolean;
}

export const DEFAULT_FILTERS: RouteFilters = {
  bestBy: { preference: true, speed: true },
  ac: 'any',
  groupByChanges: false,
};

/** Lower is calmer. Mirrors the screen's previous sensory ranking. */
export function sensoryScoreOf(route: RouteOption): number {
  return route.sensory_score ?? route.noise + route.crowds + route.heat + route.light + route.smell;
}

/** Number of interchanges: non-walking legs minus one, clamped at 0. */
export function changesOf(route: RouteOption): number {
  if (!route.legs) {
    return 0;
  }
  const transit = route.legs.filter((leg) => leg.mode.toLowerCase() !== 'walking').length;
  return Math.max(0, transit - 1);
}

/**
 * Route-level air-conditioning status, read from the `aircon` feature badge.
 * The contract only exposes one route-level badge, so this is the finest
 * granularity available (see plan: "present at every point" caveat).
 */
export function acStatusOf(route: RouteOption): 'ac' | 'none' | 'unknown' {
  const aircon = route.features?.find((f) => f.type === 'aircon');
  if (!aircon) {
    return 'unknown';
  }
  if (aircon.label === 'Air Conditioned' || aircon.label === 'Fresh Air') {
    return 'ac';
  }
  return 'none';
}

/** Apply the A/C filter to a pool of routes (does not mutate the input). */
export function applyAcFilter(routes: RouteOption[], ac: AcFilter): RouteOption[] {
  if (ac === 'any') {
    return [...routes];
  }
  if (ac === 'every') {
    return routes.filter((r) => acStatusOf(r) === 'ac');
  }
  // 'preferred': keep all, but float air-conditioned routes to the front,
  // preserving relative order otherwise (stable partition).
  const air = routes.filter((r) => acStatusOf(r) === 'ac');
  const rest = routes.filter((r) => acStatusOf(r) !== 'ac');
  return [...air, ...rest];
}

export type BestByMode = 'preference' | 'speed';

/** Compare two routes by a best-by mode (negative = `a` ranks first). */
export function compareByMode(a: RouteOption, b: RouteOption, mode: BestByMode): number {
  if (mode === 'speed') {
    return a.duration - b.duration;
  }
  const byScore = sensoryScoreOf(a) - sensoryScoreOf(b);
  if (byScore !== 0) {
    return byScore;
  }
  // Tie-break preference ranking by the higher match percentage.
  return (b.match_percentage ?? 0) - (a.match_percentage ?? 0);
}

/** The single best route for a mode, or undefined if the pool is empty. */
export function pickBest(routes: RouteOption[], mode: BestByMode): RouteOption | undefined {
  if (routes.length === 0) {
    return undefined;
  }
  return [...routes].sort((a, b) => compareByMode(a, b, mode))[0];
}

export interface ChangeGroup {
  changes: number;
  routes: RouteOption[];
}

/**
 * Group routes by interchange count, ascending, ordered within each group by
 * the given best-by mode. Only counts that actually occur get a group, so the
 * list naturally stops at the real maximum.
 */
export function groupByChangeCount(routes: RouteOption[], mode: BestByMode): ChangeGroup[] {
  const buckets = new Map<number, RouteOption[]>();
  for (const route of routes) {
    const count = changesOf(route);
    const bucket = buckets.get(count);
    if (bucket) {
      bucket.push(route);
    } else {
      buckets.set(count, [route]);
    }
  }
  return [...buckets.keys()]
    .sort((a, b) => a - b)
    .map((changes) => ({
      changes,
      routes: [...buckets.get(changes)!].sort((a, b) => compareByMode(a, b, mode)),
    }));
}
