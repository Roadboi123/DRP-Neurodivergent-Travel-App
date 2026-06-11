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
import { filterWarningsNearRoute } from '@/utils/geo';
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
  /** Open the action card for a marker tapped on the map. */
  openWarningById: (id: string) => void;
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
          // Only notify if it was reported by someone else (not the current user)
          if (!username || w.username !== username) {
            sendLocalNotification(
              'New Real-time Warning on your Route!',
              `${w.title}: ${w.desc}`
            ).catch((err) => console.warn('Failed to send local notification:', err));
          }
        }
      }
    }
  }, [warnings, route, enabled, username]);

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

  const selectedIsOwn = !!selectedWarning && !!username && selectedWarning.username === username;

  return {
    warnings,
    formattedWarnings,
    selectedWarning,
    setSelectedWarning,
    openWarningById,
    selectedIsOwn,
    removeOwnWarning,
    dismissWarning,
    addWarning,
    hideAll,
    setHideAll,
    reload,
  };
}
