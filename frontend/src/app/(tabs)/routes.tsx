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

import { GradientBackground } from '@/components/ui/gradient-background';
import { HeaderNav } from '@/components/ui/header-nav';
import { RouteCard } from '@/components/routes/route-card';
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
import { BRAND, Fonts, getPalette, hardShadow } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useRoutesService } from '@/services/services-context';
import type { RouteOption } from '@/types/route';

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
  const routesService = useRoutesService();

  // Input states
  const [startLoc, setStartLoc] = useState('Current Location');
  const [endLoc, setEndLoc] = useState('Imperial College London');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);

  // Filter states
  const [filters, setFilters] = useState<RouteFilters>(DEFAULT_FILTERS);
  const [filtersVisible, setFiltersVisible] = useState(false);

  // Routes state
  const [routes, setRoutes] = useState<RouteOption[]>([]);

  // Hydration fix
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch routes from the backend (debounced) with preference scoring
  useEffect(() => {
    let active = true;

    async function fetchRoutes() {
      if (!startLoc.trim() || !endLoc.trim()) {
        setRoutes([]);
        return;
      }

      setLoading(true);
      try {
        const data = await routesService.getRoutes(startLoc, endLoc, username);
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
  }, [startLoc, endLoc, username, routesService]);

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
      <HeaderNav />

      <RouteSearchInputs
        startLoc={startLoc}
        endLoc={endLoc}
        username={username}
        loading={loading}
        onStartChange={setStartLoc}
        onEndChange={setEndLoc}
        onUsernameChange={setUsername}
      />

      <ScrollView style={{ backgroundColor: palette.background }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Warnings Banner */}
        <WarningsPanel />

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
                style={styles.statusChip}>
                <Text style={[styles.statusChipText, { color: palette.textPrimary }]}>{chip}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {loading ? (
          <View style={styles.loadingSpinner}>
            <ActivityIndicator size="large" color="#4A90E2" />
            <Text style={[styles.loadingText, { color: palette.textSecondary }]}>
              Calculating calmest routes...
            </Text>
          </View>
        ) : pool.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="map" size={48} color={BRAND.ink} />
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
                  <RouteCard key={`g${group.changes}-${route.id}`} route={route} hideTitle />
                ))}
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.routesList}>
            {ranked.map((route) => (
              <RouteCard key={route.id} route={route} hideTitle />
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
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
    backgroundColor: BRAND.white,
    borderWidth: 2,
    borderColor: BRAND.ink,
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
