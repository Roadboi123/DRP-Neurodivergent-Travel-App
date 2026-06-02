import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { RouteCard } from '@/components/routes/route-card';
import { RouteSearchInputs } from '@/components/routes/route-search-inputs';
import { SortToggle, type SortMode } from '@/components/routes/sort-toggle';
import { TransportModes } from '@/components/routes/transport-modes';
import { WarningsPanel } from '@/components/routes/warnings-panel';
import { Fonts, getPalette } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getRoutes } from '@/services/routes';
import type { RouteOption } from '@/types/route';

function sensoryScoreOf(route: RouteOption): number {
  return route.sensory_score ?? route.noise + route.crowds + route.heat + route.light + route.smell;
}

export default function RoutesScreen() {
  const isDark = useColorScheme() === 'dark';
  const palette = getPalette(isDark);

  // Input states
  const [startLoc, setStartLoc] = useState('Current Location');
  const [endLoc, setEndLoc] = useState('Imperial College London');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);

  // Sorting and filtering states
  const [sortBy, setSortBy] = useState<SortMode>('speed');
  const [walkSelected, setWalkSelected] = useState(false);

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
        const data = await getRoutes(startLoc, endLoc, username);
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

    const timer = setTimeout(fetchRoutes, 400);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [startLoc, endLoc, username]);

  // Apply filtering and sorting
  const getSortedRoutes = (): RouteOption[] => {
    let list = [...routes];

    if (walkSelected) {
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes('walk') ||
          (r.subName && r.subName.toLowerCase().includes('walk'))
      );
    }

    if (sortBy === 'speed') {
      return list.sort((a, b) => a.duration - b.duration);
    }
    // Sort by backend-calculated sensory discomfort score (lowest first).
    return list.sort((a, b) => sensoryScoreOf(a) - sensoryScoreOf(b));
  };

  if (!mounted) {
    return null;
  }

  const sortedRoutes = getSortedRoutes();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <RouteSearchInputs
        startLoc={startLoc}
        endLoc={endLoc}
        username={username}
        loading={loading}
        onStartChange={setStartLoc}
        onEndChange={setEndLoc}
        onUsernameChange={setUsername}
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <TransportModes
          walkSelected={walkSelected}
          onToggleWalk={() => setWalkSelected((prev) => !prev)}
        />

        <WarningsPanel />

        {/* Routing Options List */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: palette.textPrimary, fontFamily: Fonts?.rounded }]}>
            Available Routes
          </Text>
          <SortToggle sortBy={sortBy} onChange={setSortBy} />
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
            {sortedRoutes.map((route) => (
              <RouteCard key={route.id} route={route} />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  routesList: {
    gap: 16,
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
