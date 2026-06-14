import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useLocalSearchParams } from 'expo-router';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';

import { GradientBackground } from '@/components/ui/gradient-background';
import { HeaderNav } from '@/components/ui/header-nav';
import { RouteCard } from '@/components/routes/route-card';
import { RouteDetailsModal } from '@/components/routes/route-details-modal';
import { RouteFilterSheet } from '@/components/routes/route-filter-sheet';
import {
  applyAcFilter,
  DEFAULT_FILTERS,
  groupByChangeCount,
  rankRoutes,
  type RouteFilters,
  type SortMode,
} from '@/components/routes/route-filtering';
import { PresetIndicator } from '@/components/routes/preset-indicator';
import { RouteSearchInputs } from '@/components/routes/route-search-inputs';
import { RouteTimeSheet, journeyTimeLabel } from '@/components/routes/route-time-sheet';
import { toRouteTimeQuery, type JourneyTime } from '@/components/routes/journey-time';
import { SegmentedControl, type SegmentOption } from '@/components/routes/segmented-control';
import { WarningsPanel } from '@/components/routes/warnings-panel';
import { Fonts, getPalette, getSemanticColors, hardShadow } from '@/constants/theme';
import { useIsFocused } from '@react-navigation/native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useNavBar } from '@/contexts/navbar-context';
import { useRoutesService } from '@/services/services-context';
import { consumeReopenJourneyDetails, getActiveJourneyRoute } from '@/services/active-journey';
import { getWarningsSnapshot, loadWarningStore, subscribeWarnings } from '@/services/warning-store';
import type { RouteOption, WarningItem } from '@/types/route';
import { useAuth } from '@/context/auth-context';
import { usePresets } from '@/context/presets-context';
import { analytics } from '@/services/analytics';

// How many routes to show in the ungrouped (Google-Maps-style) list.
const MAX_RESULTS = Infinity;

const SORT_TABS: SegmentOption<SortMode>[] = [
  { value: 'preference', label: 'Preference', icon: 'heart-outline' },
  { value: 'speed', label: 'Speed', icon: 'flash-outline' },
];

/** Active-filter chips for state NOT already shown by the on-screen sort tab. */
function statusChips(filters: RouteFilters): string[] {
  const chips: string[] = [];
  if (filters.ac === 'preferred') {
    chips.push('A/C preferred');
  } else if (filters.ac === 'every') {
    chips.push('A/C throughout');
  }
  if (filters.groupByChanges) {
    chips.push('Grouped by number of changes');
  }
  return chips;
}

export default function RoutesScreen() {
  const isDark = useColorScheme() === 'dark';
  const palette = getPalette(isDark);
  const semantic = getSemanticColors(isDark);
  const routesService = useRoutesService();
  const { username, isLoggedIn, setProfileModalVisible } = useAuth();
  const { values: prefValues } = usePresets();
  const isFocused = useIsFocused();

  // Backend route scoring reads the user's saved sensitivities, so re-fetch
  // whenever the active preset changes (it's already been persisted by then).
  const prefKey = useMemo(() => JSON.stringify(prefValues), [prefValues]);

  // Input states
  const [startLoc, setStartLoc] = useState('Current Location');
  const [endLoc, setEndLoc] = useState('');
  const [loading, setLoading] = useState(false);

  // When to travel: leave now (default), leave at, or arrive by a chosen time.
  const [journeyTime, setJourneyTime] = useState<JourneyTime>({ mode: 'now', at: Date.now() });
  const [timeSheetVisible, setTimeSheetVisible] = useState(false);

  // Active search query states (used for fetching routes only after user commits search)
  const [activeStart, setActiveStart] = useState('Current Location');
  const [activeEnd, setActiveEnd] = useState('');
  // Pinned coordinates from suggestion picks — bypass backend re-geocoding.
  const [activeStartCoords, setActiveStartCoords] = useState<string | undefined>(undefined);
  const [activeEndCoords, setActiveEndCoords] = useState<string | undefined>(undefined);

  // Real-time coordinates state
  const [coords, setCoords] = useState<string | null>(null);

  const params = useLocalSearchParams<{ start?: string; end?: string; reroute?: string }>();

  useEffect(() => {
    if (params.start && params.end) {
      setStartLoc(params.start.includes(',') ? 'Current Location' : params.start);
      setEndLoc(params.end);
      setActiveStart(params.start.includes(',') ? 'Current Location' : params.start);
      setActiveEnd(params.end);
      if (params.start.includes(',')) {
        setActiveStartCoords(params.start);
      } else {
        setActiveStartCoords(undefined);
      }
      setActiveEndCoords(undefined);
      analytics.startSearch(params.start, params.end);
    }
  }, [params.start, params.end]);

  const fetchCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const currentCoords = `${loc.coords.latitude},${loc.coords.longitude}`;
        setCoords(currentCoords);
        return currentCoords;
      }
    } catch (e) {
      console.warn('Could not retrieve real-time location:', e);
    }
    return null;
  };

  useEffect(() => {
    if (isFocused && startLoc === 'Current Location' && !coords) {
      fetchCurrentLocation();
    }
  }, [isFocused, startLoc, coords]);

  useEffect(() => {
    if (isFocused) {
      analytics.trackScreenChange();
    }
    return () => {
      // Log session if they leave the routes screen or switch tabs
      analytics.endSearchSession();
    };
  }, [isFocused]);

  // Google-Maps-style swap of the start and end locations.
  const handleSwapLocations = () => {
    analytics.startSearch(endLoc, startLoc);
    const newStart = endLoc;
    const newEnd = startLoc;
    setStartLoc(newStart);
    setEndLoc(newEnd);
    setActiveStart(newStart);
    setActiveEnd(newEnd);
    // Swap pinned coords too so each field still maps to the right location.
    setActiveStartCoords(activeEndCoords);
    setActiveEndCoords(activeStartCoords);
  };

  // Filter states
  const [filters, setFilters] = useState<RouteFilters>(DEFAULT_FILTERS);
  const [filtersVisible, setFiltersVisible] = useState(false);

  // Routes state
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<RouteOption | null>(null);
  const [warnings, setWarnings] = useState<WarningItem[]>([]);

  const allWarnings = useSyncExternalStore(
    subscribeWarnings,
    getWarningsSnapshot,
    getWarningsSnapshot,
  );

  const visibleWarnings = useMemo(() => {
    return warnings.filter((w) => {
      const isUserReported = w.username != null && w.report_count != null;
      if (isUserReported) {
        return allWarnings.some((aw) => aw.id === w.id);
      }
      return true;
    });
  }, [warnings, allWarnings]);

  // The route-details modal is full-screen; hide the floating tab bar while it's
  // open so the pill doesn't bleed over it (and restore it on close/unmount).
  const { setHidden } = useNavBar();
  useEffect(() => {
    setHidden(!!selectedRoute);
  }, [selectedRoute, setHidden]);
  useEffect(() => () => setHidden(false), [setHidden]);

  // Coming back from an active journey re-opens the details sheet the user
  // saw before pressing "Go", so Back lands there rather than on the list.
  useEffect(() => {
    if (!isFocused) return;
    // Refresh the shared store on focus so a sheet re-opened after a journey
    // (or a tab revisit) reflects warnings reported elsewhere.
    loadWarningStore(routesService, username);
    if (consumeReopenJourneyDetails()) {
      const activeRoute = getActiveJourneyRoute();
      if (activeRoute) setSelectedRoute(activeRoute);
    }
  }, [isFocused, routesService, username]);

  // Hydration fix
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch routes from the backend with preference scoring (only when active/submitted queries change)
  useEffect(() => {
    let active = true;

    async function fetchRoutes() {
      if (!isFocused) return;
      if (!activeStart.trim() || !activeEnd.trim()) {
        setRoutes([]);
        return;
      }

      setLoading(true);
      // Clear stale warnings when starting a new journey search
      setWarnings([]);
      try {
        let originQuery = activeStartCoords ?? activeStart;
        if (activeStart === 'Current Location') {
          let activeCoords = coords;
          if (!activeCoords) {
            activeCoords = await fetchCurrentLocation();
          }
          if (activeCoords) {
            originQuery = activeCoords;
          }
        }
        // Use pinned end coords if available, otherwise let the backend geocode the name.
        const endQuery = activeEndCoords ?? activeEnd;
        const routeData = await routesService.getRoutes(
          originQuery,
          endQuery,
          username,
          toRouteTimeQuery(journeyTime),
        );

        // Extract every line name and station name from all legs of all routes
        // so the warnings endpoint can filter to only journey-relevant disruptions.
        const lineSet = new Set<string>();
        const stationSet = new Set<string>();
        for (const route of routeData) {
          for (const leg of route.legs ?? []) {
            if (leg.line) lineSet.add(leg.line);
            if (leg.departure) stationSet.add(leg.departure);
            if (leg.arrival) stationSet.add(leg.arrival);
            for (const stop of leg.stops ?? []) stationSet.add(stop);
          }
        }
        const routeContext = {
          lines: Array.from(lineSet),
          stations: Array.from(stationSet),
        };

        const warningData = await routesService.getWarnings(username, false, routeContext);
        if (active) {
          setRoutes(routeData);
          setWarnings(warningData);
          // Warm the shared map-marker store so opening a route's map shows the
          // reported warnings instantly, without its own DB round-trip.
          loadWarningStore(routesService, username);
        }
      } catch (error) {
        console.warn('Local backend unavailable...', error);
        if (active) {
          setRoutes([]);
          setWarnings([]);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    const timer = setTimeout(fetchRoutes, 50);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [activeStart, activeEnd, activeStartCoords, activeEndCoords, username, routesService, prefKey, isFocused, coords, journeyTime]);

  // A/C filter applies to the whole pool before ranking or grouping.
  const pool = useMemo(() => applyAcFilter(routes, filters.ac), [routes, filters.ac]);

  // Ungrouped: top results ranked by the active sort tab, best first.
  const ranked = useMemo(
    () => rankRoutes(pool, filters.sort, MAX_RESULTS),
    [pool, filters.sort]
  );

  // Grouped: every route under its change-count heading, ranked by the sort.
  const groups = useMemo(
    () => (filters.groupByChanges ? groupByChangeCount(pool, filters.sort) : []),
    [pool, filters.groupByChanges, filters.sort]
  );

  if (!mounted) {
    return null;
  }

  const chips = statusChips(filters);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>
      <GradientBackground />
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Top Header Navigation Icons */}
      <HeaderNav onProfilePress={() => setProfileModalVisible(true)} />

      <RouteSearchInputs
        startLoc={startLoc}
        endLoc={endLoc}
        loading={loading}
        onStartChange={setStartLoc}
        onEndChange={setEndLoc}
        onSwap={handleSwapLocations}
        onSubmit={(start, end, startCoords, endCoords) => {
          analytics.startSearch(start, end);
          setActiveStart(start);
          setActiveEnd(end);
          setActiveStartCoords(startCoords);
          setActiveEndCoords(endCoords);
        }}
        userCoords={coords}
      />

      {/* Departure / arrival time picker trigger */}
      <View style={styles.timeRow}>
        <TouchableOpacity
          onPress={() => {
            analytics.trackClick();
            setTimeSheetVisible(true);
          }}
          activeOpacity={0.85}
          accessibilityLabel="Set leave or arrival time"
          style={[styles.timeButton, { borderColor: palette.borderStrong, backgroundColor: palette.surface }]}>
          <Ionicons name="time-outline" size={16} color={palette.textPrimary} />
          <Text style={[styles.timeButtonText, { color: palette.textPrimary }]} numberOfLines={1}>
            {journeyTimeLabel(journeyTime)}
          </Text>
          <Ionicons name="chevron-down" size={15} color={palette.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Personalization warning bar */}
      {!isLoggedIn && (
        <TouchableOpacity
          onPress={() => setProfileModalVisible(true)}
          style={[
            styles.loginWarningBanner,
            {
              backgroundColor: semantic.warningSurface,
              borderColor: semantic.warningBorder,
            }
          ]}
          activeOpacity={0.8}
          accessibilityLabel="Click to log in and personalize routes"
        >
          <Ionicons name="warning" size={16} color={semantic.warningIcon} />
          <Text style={[styles.loginWarningText, { color: semantic.warningText }]}>
            Viewing generic routes. <Text style={{ textDecorationLine: 'underline', fontWeight: 'bold' }}>Log in</Text> to personalize.
          </Text>
        </TouchableOpacity>
      )}

      <ScrollView style={{ backgroundColor: palette.background }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Which sensory preset these results are scored against (+ shortcut to change) */}
        {isLoggedIn && pool.length > 0 && <PresetIndicator />}

        {/* Warnings Banner — only shown once routes are loaded for a specific journey */}
        {pool.length > 0 && <WarningsPanel warnings={visibleWarnings} />}

        {/* Sort tab (Preference | Speed) + Filters button */}
        <View style={styles.controlsRow}>
          <View style={{ flex: 1 }}>
            <SegmentedControl
              variant="tab"
              options={SORT_TABS}
              value={filters.sort}
              onChange={(sort) => {
                analytics.trackClick();
                setFilters((f) => ({ ...f, sort }));
              }}
            />
          </View>
          <TouchableOpacity
            onPress={() => {
              analytics.trackClick();
              setFiltersVisible(true);
            }}
            activeOpacity={0.85}
            style={[styles.filtersButton, { borderColor: palette.borderStrong, backgroundColor: palette.surface }]}>
            <Ionicons name="options-outline" size={16} color={palette.textPrimary} />
            <Text style={[styles.filtersButtonText, { color: palette.textPrimary }]}>Filters</Text>
          </TouchableOpacity>
        </View>

        {/* Active non-default filter chips (tap to open the sheet) */}
        {chips.length > 0 && (
          <View style={styles.chipRow}>
            {chips.map((chip) => (
              <TouchableOpacity
                key={chip}
                onPress={() => {
                  analytics.trackClick();
                  setFiltersVisible(true);
                }}
                activeOpacity={0.85}
                style={[
                  styles.statusChip,
                  { backgroundColor: palette.surface, borderColor: palette.border },
                ]}>
                <Text style={[styles.statusChipText, { color: palette.textPrimary }]}>{chip}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {loading ? (
          <View style={styles.loadingSpinner}>
            <ActivityIndicator size="large" color={palette.textPrimary} />
            <Text style={[styles.loadingText, { color: palette.textSecondary }]}>
              Calculating calmest routes...
            </Text>
          </View>
        ) : pool.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons
              name={!endLoc.trim() ? 'location-outline' : 'map'}
              size={48}
              color={palette.textPrimary}
            />
            <Text style={[styles.emptyText, { color: palette.textPrimary }]}>
              {!endLoc.trim()
                ? 'Enter a destination to see calm routes.'
                : routes.length === 0
                ? 'No routes found. Please check location inputs.'
                : 'No routes are air conditioned throughout. Try relaxing the A/C filter.'}
            </Text>
          </View>
        ) : filters.groupByChanges ? (
          <View style={styles.routesList}>
            {groups.map((group) => (
              <View key={`group-${group.changes}`} style={styles.group}>
                <Text style={[styles.groupHeading, { color: palette.textPrimary }]}>
                  {group.changes} {group.changes === 1 ? 'change' : 'changes'}
                </Text>
                {group.routes.map((route) => (
                  <RouteCard
                    key={`g${group.changes}-${route.id}`}
                    route={route}
                    hideTitle
                    journeyTime={journeyTime}
                    onPress={() => {
                      analytics.trackClick();
                      analytics.trackRouteView(route.id, visibleWarnings.length > 0);
                      setSelectedRoute(route);
                    }}
                  />
                ))}
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.routesList}>
            {ranked.map((route) => (
              <RouteCard
                key={route.id}
                route={route}
                hideTitle
                journeyTime={journeyTime}
                onPress={() => {
                  analytics.trackClick();
                  analytics.trackRouteView(route.id, visibleWarnings.length > 0);
                  setSelectedRoute(route);
                }}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <RouteFilterSheet
        visible={filtersVisible}
        filters={filters}
        onChange={setFilters}
        onClose={() => setFiltersVisible(false)}
      />

      <RouteTimeSheet
        visible={timeSheetVisible}
        value={journeyTime}
        onChange={setJourneyTime}
        onClose={() => setTimeSheetVisible(false)}
      />



      <RouteDetailsModal
        visible={!!selectedRoute}
        route={selectedRoute}
        onClose={() => setSelectedRoute(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  loginWarningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    gap: 10,
    ...hardShadow(3),
  },
  loginWarningText: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: Fonts?.sans,
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  timeRow: {
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 30,
    borderWidth: 2,
    ...hardShadow(3),
  },
  timeButtonText: {
    fontSize: 13,
    fontFamily: Fonts?.display,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
    marginBottom: 4,
  },
  filtersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 11,
    paddingHorizontal: 18,
    borderRadius: 30,
    borderWidth: 2,
    ...hardShadow(4),
  },
  filtersButtonText: {
    fontSize: 13,
    fontFamily: Fonts?.display,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  statusChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 30,
    borderWidth: 2,
    ...hardShadow(3),
  },
  statusChipText: {
    fontSize: 12,
    fontFamily: Fonts?.display,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  routesList: {
    gap: 18,
    marginTop: 14,
  },
  group: {
    gap: 14,
  },
  groupHeading: {
    fontSize: 16,
    fontFamily: Fonts?.display,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  loadingSpinner: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
  },
});
