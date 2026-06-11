import type { RoutesService } from '@/services/routes';
import type { WarningItem } from '@/types/route';

/**
 * Process-wide store of user-reported sensory warnings, shared by every map
 * (routes list preload, route-details sheet, live journey). It mirrors the
 * module-singleton style of `active-journey.ts` but adds a subscribe/snapshot
 * pair so React components can read it via `useSyncExternalStore`.
 *
 * Why a shared store: warnings used to live in each screen's own `useState`, so
 * a report made on one screen never reached the others, and a per-screen reload
 * (filtered by sensitivity/route on the backend) could drop a just-reported
 * warning. Here every consumer reads the same in-memory dictionary, seeded once
 * on the routes page, so markers appear instantly and stay put.
 */

type Listener = () => void;

const warnings = new Map<string, WarningItem>();
const listeners = new Set<Listener>();

// Cached array so `getWarningsSnapshot` returns a stable reference between
// mutations (required by useSyncExternalStore to avoid render loops).
let snapshot: WarningItem[] = [];

let loading = false;
let lastLoadedAt = 0;

// Collapse the bursts of reloads that fire close together (routes fetch + screen
// focus + each warning-hook mounting), which would otherwise hit the backend
// several times within a few ms for the same data. The 20s poll interval is well
// outside this window, so periodic refresh is unaffected.
const MIN_RELOAD_INTERVAL_MS = 8000;

function emit() {
  snapshot = Array.from(warnings.values());
  for (const listener of listeners) listener();
}

/** Subscribe to store changes. Returns an unsubscribe function. */
export function subscribeWarnings(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Current warnings as a stable array (same ref until the next mutation). */
export function getWarningsSnapshot(): WarningItem[] {
  return snapshot;
}

/** Optimistically add (or replace) a warning — e.g. right after reporting one. */
export function addReportedWarning(warning: WarningItem): void {
  warnings.set(warning.id, warning);
  emit();
}

/** Optimistically remove a warning — e.g. when the owner deletes theirs. */
export function removeReportedWarning(id: string): void {
  if (warnings.delete(id)) {
    emit();
  }
}

/**
 * Refresh the store from the backend. Uses `generic=true` so the response is
 * the full set of non-expired reported warnings, unfiltered by sensitivity or
 * route — each screen narrows to its own route client-side. Replacing the map
 * each load lets expired/removed warnings drop off; concurrent calls are deduped
 * via the `loading` guard, and rapid repeat calls are throttled to
 * `MIN_RELOAD_INTERVAL_MS` (pass `force` to bypass). Optimistic adds survive
 * until the next load, by which point they've been persisted and are returned.
 */
export async function loadWarningStore(
  service: RoutesService,
  username: string,
  force = false,
): Promise<void> {
  if (loading) return;
  if (!force && Date.now() - lastLoadedAt < MIN_RELOAD_INTERVAL_MS) return;
  loading = true;
  lastLoadedAt = Date.now();
  try {
    const all = await service.getWarnings(username || '', true);
    // Only geolocated user reports can be drawn as map markers.
    const reported = all.filter(
      (w) => w.username != null && w.lat != null && w.lon != null,
    );
    warnings.clear();
    for (const w of reported) warnings.set(w.id, w);
    emit();
  } catch (e) {
    console.warn('Error loading warning store:', e);
  } finally {
    loading = false;
  }
}
