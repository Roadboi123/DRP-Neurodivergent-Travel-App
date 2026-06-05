import React, { useEffect, useMemo, useState } from 'react';
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
import { RouteSearchInputs } from '@/components/routes/route-search-inputs';
import { SegmentedControl, type SegmentOption } from '@/components/routes/segmented-control';
import { WarningsPanel } from '@/components/routes/warnings-panel';
import { Fonts, getPalette, getSemanticColors, hardShadow } from '@/constants/theme';
import { useIsFocused } from '@react-navigation/native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useRoutesService } from '@/services/services-context';
import type { RouteOption, WarningItem } from '@/types/route';
import { useAuth } from '@/context/auth-context';
import { usePresets } from '@/context/presets-context';
import { ProfileModal } from '@/components/profile/profile-modal';

// How many routes to show in the ungrouped (Google-Maps-style) list.
const MAX_RESULTS = 5;

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
  const { username, isLoggedIn } = useAuth();
  const { values: prefValues } = usePresets();
  const isFocused = useIsFocused();

  // Backend route scoring reads the user's saved sensitivities, so re-fetch
  // whenever the active preset changes (it's already been persisted by then).
  const prefKey = useMemo(() => JSON.stringify(prefValues), [prefValues]);

  // Input states
  const [startLoc, setStartLoc] = useState('Current Location');
  const [endLoc, setEndLoc] = useState('Imperial College London');
  const [loading, setLoading] = useState(false);
  const [profileVisible, setProfileVisible] = useState(false);

  // Real-time coordinates state
  const [coords, setCoords] = useState<string | null>(null);

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

  // Filter states
  const [filters, setFilters] = useState<RouteFilters>(DEFAULT_FILTERS);
  const [filtersVisible, setFiltersVisible] = useState(false);

  // Routes state
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<RouteOption | null>(null);
  const [warnings, setWarnings] = useState<WarningItem[]>([]);

  // Hydration fix
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch warnings dynamically
  useEffect(() => {
    let active = true;
    async function fetchWarnings() {
      if (!isFocused) return;
      try {
        const data = await routesService.getWarnings(username, false);
        if (active) {
          setWarnings(data);
        }
      } catch (error) {
        console.warn('Failed to fetch live warnings:', error);
        if (active) {
          setWarnings([]);
        }
      }
    }
    fetchWarnings();
    return () => {
      active = false;
    };
  }, [username, routesService, isFocused]);

  // Fetch routes from the backend (debounced) with preference scoring
  useEffect(() => {
    let active = true;

    async function fetchRoutes() {
      if (!isFocused) return;
      if (!startLoc.trim() || !endLoc.trim()) {
        setRoutes([]);
        return;
      }

      setLoading(true);
      try {
        let originQuery = startLoc;
        if (startLoc === 'Current Location') {
          let activeCoords = coords;
          if (!activeCoords) {
            activeCoords = await fetchCurrentLocation();
          }
          if (activeCoords) {
            originQuery = activeCoords;
          }
        }
        const data = await routesService.getRoutes(originQuery, endLoc, username);
        if (active) {
          setRoutes(data);
        }
      } catch (error) {
        console.warn('Local backend unavailable...', error);
        if (active) {
          setRoutes([]);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    const timer = setTimeout(fetchRoutes, 800);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [startLoc, endLoc, username, routesService, prefKey, isFocused, coords]);

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
      <HeaderNav onProfilePress={() => setProfileVisible(true)} />

      <RouteSearchInputs
        startLoc={startLoc}
        endLoc={endLoc}
        loading={loading}
        onStartChange={setStartLoc}
        onEndChange={setEndLoc}
      />

      {/* Personalization warning bar */}
      {!isLoggedIn && (
        <TouchableOpacity
          onPress={() => setProfileVisible(true)}
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

        {/* Warnings Banner */}
        <WarningsPanel warnings={warnings} />

        {/* Sort tab (Preference | Speed) + Filters button */}
        <View style={styles.controlsRow}>
          <View style={{ flex: 1 }}>
            <SegmentedControl
              variant="tab"
              options={SORT_TABS}
              value={filters.sort}
              onChange={(sort) => setFilters((f) => ({ ...f, sort }))}
            />
          </View>
          <TouchableOpacity
            onPress={() => setFiltersVisible(true)}
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
                onPress={() => setFiltersVisible(true)}
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
            <Ionicons name="map" size={48} color={palette.textPrimary} />
            <Text style={[styles.emptyText, { color: palette.textPrimary }]}>
              {routes.length === 0
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
                    onPress={() => setSelectedRoute(route)}
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
                onPress={() => setSelectedRoute(route)}
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

      <ProfileModal visible={profileVisible} onClose={() => setProfileVisible(false)} />

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
