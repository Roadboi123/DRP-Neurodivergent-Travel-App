import React, { useEffect, useState } from 'react';
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
import { RouteSearchInputs } from '@/components/routes/route-search-inputs';
import { WarningsPanel } from '@/components/routes/warnings-panel';
import { getPalette } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useRoutesService } from '@/services/services-context';
import type { RouteOption } from '@/types/route';

type SortMode = 'classic' | 'speed' | 'cost' | 'noise' | 'crowds' | 'heat' | 'changes';

const FILTER_OPTIONS: { value: SortMode; label: string }[] = [
  { value: 'classic', label: 'Classic' },
  { value: 'speed', label: 'SPEED' },
  { value: 'cost', label: 'COST' },
  { value: 'noise', label: 'NOISE' },
  { value: 'crowds', label: 'CROWD' },
  { value: 'heat', label: 'HEAT' },
  { value: 'changes', label: 'NO OF CHANGES' },
];

function sensoryScoreOf(route: RouteOption): number {
  return route.sensory_score ?? route.noise + route.crowds + route.heat + route.light + route.smell;
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

  // Sorting states
  const [sortBy, setSortBy] = useState<SortMode>('classic');

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

  // Apply filtering and sorting
  const getSortedRoutes = (): RouteOption[] => {
    let list = [...routes];

    if (sortBy === 'speed') {
      return list.sort((a, b) => a.duration - b.duration);
    }
    if (sortBy === 'cost') {
      return list.sort((a, b) => a.price - b.price);
    }
    if (sortBy === 'noise') {
      return list.sort((a, b) => a.noise - b.noise);
    }
    if (sortBy === 'crowds') {
      return list.sort((a, b) => a.crowds - b.crowds);
    }
    if (sortBy === 'heat') {
      return list.sort((a, b) => a.heat - b.heat);
    }
    if (sortBy === 'changes') {
      return list.sort((a, b) => {
        const changesA = a.legs ? a.legs.filter(leg => leg.mode !== 'walking').length - 1 : 0;
        const changesB = b.legs ? b.legs.filter(leg => leg.mode !== 'walking').length - 1 : 0;
        return Math.max(0, changesA) - Math.max(0, changesB);
      });
    }
    // 'classic': Sort by balanced sensory score.
    return list.sort((a, b) => sensoryScoreOf(a) - sensoryScoreOf(b));
  };

  if (!mounted) {
    return null;
  }

  const sortedRoutes = getSortedRoutes();

  let classicBest: RouteOption | undefined;
  let classicQuickest: RouteOption | undefined;
  let classicAc: RouteOption | undefined;
  let classicOthers: RouteOption[] = [];

  if (sortBy === 'classic' && sortedRoutes.length > 0) {
    classicBest = sortedRoutes.find((r) => r.type === 'best') || sortedRoutes[0];
    let remaining = sortedRoutes.filter((r) => r.id !== classicBest?.id);

    if (remaining.length > 0) {
      classicQuickest = remaining.reduce((min, r) => r.duration < min.duration ? r : min, remaining[0]);
      remaining = remaining.filter((r) => r.id !== classicQuickest?.id);
    }

    classicAc = remaining.find((r) =>
      r.features?.some(
        (f) => f.type === 'aircon' && (f.label === 'Air Conditioned' || f.label === 'Fresh Air')
      )
    );
    if (classicAc) {
      remaining = remaining.filter((r) => r.id !== classicAc?.id);
    }

    classicOthers = remaining;
  }

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

        {loading ? (
          <View style={styles.loadingSpinner}>
            <ActivityIndicator size="large" color="#4A90E2" />
            <Text style={[styles.loadingText, { color: palette.textSecondary }]}>
              Calculating calmest routes...
            </Text>
          </View>
        ) : sortedRoutes.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="map" size={48} color={isDark ? '#333' : '#CCC'} />
            <Text style={[styles.emptyText, { color: '#888' }]}>
              No routes found. Please check location inputs.
            </Text>
          </View>
        ) : (
          <View style={styles.routesList}>
            {sortBy === 'classic' ? (
              <>
                {classicBest && (
                  <RouteCard
                    key={classicBest.id}
                    route={classicBest}
                    customTitle="Best by preference"
                  />
                )}
                {classicQuickest && (
                  <RouteCard
                    key={classicQuickest.id}
                    route={classicQuickest}
                    customTitle="Quickest"
                  />
                )}
                {classicAc && (
                  <RouteCard
                    key={classicAc.id}
                    route={classicAc}
                    customTitle="A/C only ❄️"
                  />
                )}
                {classicOthers.map((route, idx) => (
                  <RouteCard
                    key={route.id}
                    route={route}
                    customTitle={idx === 0 ? "Others" : undefined}
                    hideTitle={idx > 0}
                  />
                ))}
              </>
            ) : (
              sortedRoutes.map((route) => (
                <RouteCard
                  key={route.id}
                  route={route}
                  hideTitle={true}
                />
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* Bottom Filter Selector Bar */}
      <View style={[styles.bottomBar, { borderTopColor: palette.divider, backgroundColor: palette.background }]}>
        <ScrollView style={{ backgroundColor: palette.background }} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bottomBarScroll}>
          {FILTER_OPTIONS.map(({ value, label }) => {
            const active = sortBy === value;
            return (
              <TouchableOpacity
                key={value}
                onPress={() => setSortBy(value)}
                style={[
                  styles.filterPill,
                  active && styles.filterPillActive,
                  !active && { backgroundColor: isDark ? '#2E3543' : '#E5E7EB' }
                ]}
              >
                <Text style={[styles.filterPillText, { color: active ? '#FFF' : palette.textPrimary }]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
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
  routesList: {
    gap: 16,
    marginTop: 10,
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
  bottomBar: {
    borderTopWidth: 1.5,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  bottomBarScroll: {
    gap: 8,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  filterPill: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterPillActive: {
    backgroundColor: '#E91E63',
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
