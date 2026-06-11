import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { formatWarnings, type FormattedWarning } from '@/components/routes/warning-markers';
import { getAccents } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { analytics } from '@/services/analytics';
import { useRoutesService } from '@/services/services-context';
import type { RouteOption, WarningItem } from '@/types/route';

type Accents = ReturnType<typeof getAccents>;

export interface RouteWarnings {
  /** Raw user-reported warnings near this route. */
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
  /** Prepend a freshly reported warning (optimistic). */
  addWarning: (warning: WarningItem) => void;
  /** Hide every warning marker without dismissing any individually. */
  hideAll: boolean;
  setHideAll: (next: boolean) => void;
  /** Manually refetch (also polled while enabled). */
  reload: () => void;
}

/**
 * Owns the user-reported warnings shown on a route map: fetching/polling,
 * per-user dismissal, owner deletion, and a hide-all toggle. Shared by the
 * pre-Go route details and the live journey so both behave identically.
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

  // Real user-reported warnings near this journey (no mocks, no live TfL items).
  const [warnings, setWarnings] = useState<WarningItem[]>([]);
  // Other users' warnings this user has closed — hidden locally only, never deleted.
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  // The warning whose action card (Remove / Close) is currently open.
  const [selectedWarning, setSelectedWarning] = useState<WarningItem | null>(null);
  // Hide the whole warning layer from the map without dismissing any item.
  const [hideAll, setHideAll] = useState(false);

  // Latest warnings, readable from the map's (stale-closure) message handlers.
  const warningsRef = useRef<WarningItem[]>([]);
  useEffect(() => {
    warningsRef.current = warnings;
  }, [warnings]);

  const openWarningById = useCallback((id: string) => {
    const warning = warningsRef.current.find((w) => w.id === id);
    if (warning) {
      analytics.trackWarningClick();
      setSelectedWarning(warning);
    }
  }, []);

  // Fetch the real, user-reported warnings near this route. Live TfL/weather
  // warnings (no coordinates) are intentionally not placed on the map — we keep
  // only items reported by users (they have a reporter and real coordinates).
  const loadingRef = useRef(false);
  const reload = useCallback(async () => {
    if (!route || loadingRef.current) return;
    loadingRef.current = true;
    try {
      const lineSet = new Set<string>();
      const stationSet = new Set<string>();
      route.legs?.forEach((leg) => {
        if (leg.line) lineSet.add(leg.line);
        if (leg.departure) stationSet.add(leg.departure);
        if (leg.arrival) stationSet.add(leg.arrival);
        leg.stops?.forEach((stop) => stationSet.add(stop));
      });

      const routeContext = {
        lines: Array.from(lineSet),
        stations: Array.from(stationSet),
      };

      const liveWarnings = await routesService.getWarnings(username || '', false, routeContext);

      const userReports = liveWarnings.filter(
        (w) => w.username != null && w.lat != null && w.lon != null,
      );
      // Avoid re-rendering (and a marker flicker) when the set is unchanged.
      setWarnings((prev) => {
        const prevIds = new Set(prev.map((p) => p.id));
        const unchanged =
          prev.length === userReports.length && userReports.every((w) => prevIds.has(w.id));
        return unchanged ? prev : userReports;
      });
    } catch (e) {
      console.warn('Error loading route warnings:', e);
    } finally {
      loadingRef.current = false;
    }
  }, [route, routesService, username]);

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

  const formattedWarnings = useMemo(
    () => formatWarnings(warnings, accents, dismissedIds, hideAll),
    [warnings, accents, dismissedIds, hideAll],
  );

  // Own warning: delete from the DB (gone for everyone). Optimistically drop it.
  const removeOwnWarning = useCallback(
    async (warning: WarningItem) => {
      setSelectedWarning(null);
      setWarnings((prev) => prev.filter((w) => w.id !== warning.id));
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
    setSelectedWarning(null);
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(warning.id);
      return next;
    });
  }, []);

  const addWarning = useCallback((warning: WarningItem) => {
    setWarnings((prev) => [warning, ...prev]);
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
