import type { RouteOption, WarningItem } from '@/types/route';

const EARTH_RADIUS_M = 6371000;

/** Great-circle distance between two [lat, lon] points, in metres. */
export function haversineMeters(a: [number, number], b: [number, number]): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Flatten a route into the ordered list of [lat, lon] points it actually
 * traces — every leg's `path_coords`, falling back to its departure/arrival
 * coordinates when a leg has no detailed geometry. Using the traced path (not
 * just stations) means a warning reported *between* stops is still considered
 * "on the route".
 */
export function routePathCoords(route: RouteOption | null): [number, number][] {
  if (!route?.legs) return [];
  const coords: [number, number][] = [];
  for (const leg of route.legs) {
    if (leg.path_coords && leg.path_coords.length > 0) {
      for (const pt of leg.path_coords) {
        coords.push([pt[0], pt[1]]);
      }
    } else if (
      leg.departure_lat != null &&
      leg.departure_lon != null &&
      leg.arrival_lat != null &&
      leg.arrival_lon != null
    ) {
      coords.push([leg.departure_lat, leg.departure_lon]);
      coords.push([leg.arrival_lat, leg.arrival_lon]);
    }
  }
  return coords;
}

/**
 * Keep only the warnings within `radiusM` of any point along the route's path.
 * Mirrors the backend's proximity rule but measures against the whole traced
 * journey rather than just stations. Warning counts are small, so the
 * point-by-point scan is cheap.
 */
export function filterWarningsNearRoute(
  warnings: WarningItem[],
  route: RouteOption | null,
  radiusM = 1500,
): WarningItem[] {
  const path = routePathCoords(route);
  if (path.length === 0) return [];
  return warnings.filter((w) => {
    if (w.lat == null || w.lon == null) return false;
    const point: [number, number] = [w.lat, w.lon];
    return path.some((p) => haversineMeters(point, p) <= radiusM);
  });
}
