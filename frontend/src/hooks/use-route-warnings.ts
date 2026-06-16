import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { formatWarnings, type FormattedWarning } from '@/components/routes/warning-markers';
import { getAccents } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { analytics } from '@/services/analytics';
import { useRoutesService } from '@/services/services-context';
import {
  addReportedWarning,
  getWarningsSnapshot,
  loadWarningStore,
  removeReportedWarning,
  subscribeWarnings,
} from '@/services/warning-store';
import type { RouteOption, WarningItem } from '@/types/route';
import { filterWarningsNearRoute, nearestRouteStop } from '@/utils/geo';
import { cleanPlaceLabel } from '@/utils/place-label';
import { sendLocalNotification } from '@/services/notifications';

type Accents = ReturnType<typeof getAccents>;

export interface RouteWarnings {
  /** Reported warnings near this route (from the shared store). */
  warnings: WarningItem[];
  /** Markers ready for the Leaflet map (`hidden` reflects dismiss + hide-all). */
  formattedWarnings: FormattedWarning[];
  /** The warning whose action card is open, if any. */
  selectedWarning: WarningItem | null;
  setSelectedWarning: (w: WarningItem | null) => void;
  /** Warnings in a tapped cluster, shown as a breakdown list (or null). */
  selectedCluster: WarningItem[] | null;
  setSelectedCluster: (w: WarningItem[] | null) => void;
  /** Open the action card for a marker tapped on the map. */
  openWarningById: (id: string) => void;
  /** Open the breakdown list for a tapped cluster of nearby markers. */
  openClusterByIds: (ids: string[]) => void;
  /** Whether the selected warning belongs to the current user. */
  selectedIsOwn: boolean;
  /** Own warning: delete from the DB (gone for everyone). */
  removeOwnWarning: (warning: WarningItem) => Promise<void>;
  /** Someone else's warning: hide for this user only. */
  dismissWarning: (warning: WarningItem) => void;
  /** Add a freshly reported warning to the shared store (optimistic). */
  addWarning: (warning: WarningItem) => void;
  /** Hide every warning marker without dismissing any individually. */
  hideAll: boolean;
  setHideAll: (next: boolean) => void;
  /** Manually refresh the shared store (also polled while enabled). */
  reload: () => void;
}

/**
 * Surfaces the reported warnings relevant to a given route. Warning data lives
 * in a process-wide store (`services/warning-store.ts`) seeded on the routes
 * page, so every screen sees the same set instantly and a report on one screen
 * shows on the others. This hook narrows the store to warnings near `route` and
 * layers on per-screen view state (dismissed items, hide-all, the open card).
 *
 * Pass `enabled: false` (e.g. a closed modal) to pause polling.
 */
export function useRouteWarnings(
  route: RouteOption | null,
  accents: Accents,
  enabled: boolean = true,
  // Push notifications for newly-arriving warnings only fire when `notify` is
  // true. This is reserved for the *active journey* screen — the pre-Go map
  // (route details) polls/show warnings but must NOT notify, so revisiting it
  // doesn't spam alerts.
  notify: boolean = false,
  // Called for the same new, non-own warnings that fire a notification, so the
  // active-journey screen can also show an in-app banner. An OS notification is
  // unreliable while the app is foregrounded (the user is staring at the
  // screen); the banner is the alert they actually see. Same gating as notify.
  onNewWarning?: (title: string, body: string) => void,
): RouteWarnings {
  const routesService = useRoutesService();
  const { username } = useAuth();

  // Shared, process-wide reported warnings (all routes).
  const allWarnings = useSyncExternalStore(
    subscribeWarnings,
    getWarningsSnapshot,
    getWarningsSnapshot,
  );

  // Other users' warnings this user has closed — hidden locally only, never deleted.
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  // The warning whose action card (Remove / Close) is currently open.
  const [selectedWarning, setSelectedWarning] = useState<WarningItem | null>(null);
  // The warnings in a tapped cluster (breakdown list), or null.
  const [selectedCluster, setSelectedCluster] = useState<WarningItem[] | null>(null);
  // Hide the whole warning layer from the map without dismissing any item.
  const [hideAll, setHideAll] = useState(false);

  // Narrow the store to warnings along this route's traced path (not just stations).
  const warnings = useMemo(
    () => filterWarningsNearRoute(allWarnings, route),
    [allWarnings, route],
  );

  // Latest nearby warnings, readable from the map's (stale-closure) handlers.
  const warningsRef = useRef<WarningItem[]>([]);
  useEffect(() => {
    warningsRef.current = warnings;
  }, [warnings]);

  const openWarningById = useCallback((id: string) => {
    const warning = warningsRef.current.find((w) => w.id === id);
    if (warning) {
      analytics.trackWarningInteraction();
      setSelectedWarning(warning);
    }
  }, []);

  const openClusterByIds = useCallback((ids: string[]) => {
    const group = warningsRef.current.filter((w) => ids.includes(w.id));
    if (group.length === 1) {
      analytics.trackWarningInteraction();
      setSelectedWarning(group[0]);
    } else if (group.length > 1) {
      analytics.trackWarningInteraction();
      setSelectedCluster(group);
    }
  }, []);

  const reload = useCallback(() => {
    loadWarningStore(routesService, username || '');
  }, [routesService, username]);

  // Poll so warnings reported by others appear, and expired ones drop off.
  useEffect(() => {
    if (!enabled) return;
    reload();
    const interval = setInterval(reload, 20000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') reload();
    });
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [enabled, reload]);

  // Keep track of warning IDs we already know about for this route.
  // We reset this set whenever the route changes so we don't notify for pre-existing warnings.
  const knownWarningIdsRef = useRef<Set<string>>(new Set());
  const prevRouteIdRef = useRef<string | null>(null);

  useEffect(() => {
    const currentRouteId = route?.id || null;
    if (currentRouteId !== prevRouteIdRef.current) {
      // Route changed or was cleared. Reset our known warnings set.
      knownWarningIdsRef.current = new Set(warnings.map((w) => w.id));
      prevRouteIdRef.current = currentRouteId;
    } else if (route && enabled) {
      // Same route, check if any warning is new
      for (const w of warnings) {
        if (!knownWarningIdsRef.current.has(w.id)) {
          knownWarningIdsRef.current.add(w.id);
          // Only notify during an active journey (notify), and never for the
          // current user's own report (compare against 'anonymous' too, since a
          // logged-out user's reports are stored under that name).
          const me = username || 'anonymous';
          const isOwn = w.username === me;
          if (notify && !isOwn) {
            // Phrase it by roughly where the warning is and attribute it
            // generically, e.g. "Sound reported by a traveller near South
            // Kensington" (never "here" — the traveller may be elsewhere).
            const place =
              w.lat != null && w.lon != null ? nearestRouteStop(route, w.lat, w.lon) : null;
            const label = (w.title || '').replace(/\s+reported$/i, '').trim() || w.title;
            const body = place
              ? `${label} reported by a traveller near ${cleanPlaceLabel(place, 'your route')}`
              : `${label} reported by a traveller nearby`;
            const title = 'New warning on your journey';
            sendLocalNotification(title, body).catch((err) =>
              console.warn('Failed to send local notification:', err),
            );
            // Also surface it in-app — the OS banner is unreliable while the
            // journey screen is foregrounded, which is exactly when this fires.
            onNewWarning?.(title, body);
          }
        }
      }
    }
  }, [warnings, route, enabled, username, notify, onNewWarning]);

  const formattedWarnings = useMemo(
    () => formatWarnings(warnings, accents, dismissedIds, hideAll),
    [warnings, accents, dismissedIds, hideAll],
  );

  // Own warning: delete from the DB (gone for everyone). Optimistically drop it.
  const removeOwnWarning = useCallback(
    async (warning: WarningItem) => {
      analytics.trackWarningInteraction();
      setSelectedWarning(null);
      removeReportedWarning(warning.id);
      setDismissedIds((prev) => {
        const next = new Set(prev);
        next.add(warning.id);
        return next;
      });
      try {
        await routesService.deleteWarning(warning.id, username || 'anonymous');
      } catch (err) {
        console.warn('Failed to delete warning on backend:', err);
      }
    },
    [routesService, username],
  );

  // Someone else's warning: hide it for this user only, no API call.
  const dismissWarning = useCallback((warning: WarningItem) => {
    analytics.trackWarningInteraction();
    setSelectedWarning(null);
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(warning.id);
      return next;
    });
  }, []);

  const addWarning = useCallback((warning: WarningItem) => {
    addReportedWarning(warning);
  }, []);

  const selectedIsOwn = !!selectedWarning && selectedWarning.username === (username || 'anonymous');

  return {
    warnings,
    formattedWarnings,
    selectedWarning,
    setSelectedWarning,
    selectedCluster,
    setSelectedCluster,
    openWarningById,
    openClusterByIds,
    selectedIsOwn,
    removeOwnWarning,
    dismissWarning,
    addWarning,
    hideAll,
    setHideAll,
    reload,
  };
}
