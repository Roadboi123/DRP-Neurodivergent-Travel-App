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
import { router } from 'expo-router';

import { RouteCard } from '@/components/routes/route-card';
import { RouteFilterSheet } from '@/components/routes/route-filter-sheet';
import {
  applyAcFilter,
  DEFAULT_FILTERS,
  groupByChangeCount,
  pickBest,
  type BestByMode,
  type RouteFilters,
} from '@/components/routes/route-filtering';
import { RouteSearchInputs } from '@/components/routes/route-search-inputs';
import { WarningsPanel } from '@/components/routes/warnings-panel';
import { getPalette } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useRoutesService } from '@/services/services-context';
import type { RouteOption } from '@/types/route';

/** A pinned summary card: a route plus the heading it's shown under. */
interface PinnedCard {
  route: RouteOption;
  title: string;
}

/** Active-filter status chips that mirror the filter sheet. */
function statusChips(filters: RouteFilters): string[] {
  const chips: string[] = [];
  if (filters.bestBy.preference) {
    chips.push('Preference');
  }
  if (filters.bestBy.speed) {
    chips.push('Speed');
  }
  if (filters.ac === 'preferred') {
    chips.push('A/C preferred');
  } else if (filters.ac === 'every') {
    chips.push('A/C every point');
  }
  if (filters.groupByChanges) {
    chips.push('Grouped by changes');
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

  // A/C filter applies to the whole pool before anything else.
  const pool = useMemo(() => applyAcFilter(routes, filters.ac), [routes, filters.ac]);

  // The two pinned "best by" cards, de-duplicated if both resolve to one route.
  const pinned = useMemo<PinnedCard[]>(() => {
    const pref = filters.bestBy.preference ? pickBest(pool, 'preference') : undefined;
    const speed = filters.bestBy.speed ? pickBest(pool, 'speed') : undefined;

    if (pref && speed && pref.id === speed.id) {
      return [{ route: pref, title: 'Best by Preference & Speed' }];
    }
    const cards: PinnedCard[] = [];
    if (pref) {
      cards.push({ route: pref, title: 'Best by Preference' });
    }
    if (speed) {
      cards.push({ route: speed, title: 'Best by Speed' });
    }
    return cards;
  }, [pool, filters.bestBy]);

  // When grouping is on, order each group by the dominant best-by mode.
  const groupMode: BestByMode = filters.bestBy.preference ? 'preference' : 'speed';
  const groups = useMemo(
    () => (filters.groupByChanges ? groupByChangeCount(pool, groupMode) : []),
    [pool, filters.groupByChanges, groupMode]
  );

  if (!mounted) {
    return null;
  }

  const chips = statusChips(filters);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* Top Header Navigation Icons */}
      <View style={styles.headerNavRow}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.navIconBtn, { backgroundColor: isDark ? '#2E3543' : '#F0F0EE' }]}>
          <Ionicons name="arrow-back" size={20} color={palette.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.replace('/')} style={[styles.navIconBtn, { backgroundColor: isDark ? '#2E3543' : '#F0F0EE' }]}>
          <Ionicons name="home-outline" size={20} color={palette.textPrimary} />
        </TouchableOpacity>
      </View>

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

        {/* Warnings Banner + Options/Edit button */}
        <View style={styles.warningsRow}>
          <View style={{ flex: 1 }}>
            <WarningsPanel />
          </View>
          <TouchableOpacity
            onPress={() => router.push('/preferences')}
            activeOpacity={0.8}
            style={[
              styles.editButton,
              {
                backgroundColor: isDark ? '#2E3543' : '#FFF5F0',
                borderColor: '#FF7F50',
              }
            ]}
          >
            <Ionicons name="construct-outline" size={16} color="#FF7F50" />
            <Text style={[styles.editButtonText, { color: isDark ? '#FF9E79' : '#D04E1F' }]}>Edit</Text>
          </TouchableOpacity>
        </View>

        {/* Filters button + active-filter status chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersRow}
          style={{ backgroundColor: palette.background }}>
          <TouchableOpacity
            onPress={() => setFiltersVisible(true)}
            activeOpacity={0.85}
            style={[styles.filtersButton, { borderColor: palette.borderStrong, backgroundColor: palette.surface }]}>
            <Ionicons name="options-outline" size={16} color={palette.textPrimary} />
            <Text style={[styles.filtersButtonText, { color: palette.textPrimary }]}>Filters</Text>
            <Ionicons name="chevron-down" size={14} color={palette.textSecondary} />
          </TouchableOpacity>

          {chips.map((chip) => (
            <TouchableOpacity
              key={chip}
              onPress={() => setFiltersVisible(true)}
              activeOpacity={0.85}
              style={[styles.statusChip, { backgroundColor: isDark ? '#2E3543' : '#EAEAEA' }]}>
              <Text style={[styles.statusChipText, { color: palette.textPrimary }]}>{chip}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading ? (
          <View style={styles.loadingSpinner}>
            <ActivityIndicator size="large" color="#4A90E2" />
            <Text style={[styles.loadingText, { color: palette.textSecondary }]}>
              Calculating calmest routes...
            </Text>
          </View>
        ) : pool.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="map" size={48} color={isDark ? '#333' : '#CCC'} />
            <Text style={[styles.emptyText, { color: '#888' }]}>
              {routes.length === 0
                ? 'No routes found. Please check location inputs.'
                : 'No routes are air conditioned throughout. Try relaxing the A/C filter.'}
            </Text>
          </View>
        ) : (
          <View style={styles.routesList}>
            {/* Pinned "best by" summary cards */}
            {pinned.map(({ route, title }) => (
              <RouteCard key={`pinned-${route.id}`} route={route} customTitle={title} />
            ))}

            {/* Full list grouped by number of changes */}
            {groups.map((group) => (
              <View key={`group-${group.changes}`} style={styles.group}>
                <Text style={[styles.groupHeading, { color: isDark ? '#AAA' : '#555' }]}>
                  {group.changes} {group.changes === 1 ? 'change' : 'changes'}
                </Text>
                {group.routes.map((route) => (
                  <RouteCard key={`g${group.changes}-${route.id}`} route={route} hideTitle />
                ))}
              </View>
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
  headerNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  navIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  warningsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginVertical: 4,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 5,
    height: 52,
  },
  editButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  filtersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  filtersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  filtersButtonText: {
    fontSize: 13,
    fontWeight: '700',
  },
  statusChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  routesList: {
    gap: 16,
    marginTop: 10,
  },
  group: {
    gap: 12,
  },
  groupHeading: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.1,
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
