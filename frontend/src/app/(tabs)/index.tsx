import React, { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { DailyTips } from '@/components/home/daily-tips';
import { QuickActionCard } from '@/components/home/quick-action-card';
import { WelcomeBanner } from '@/components/home/welcome-banner';
import { StatusBadge, type BackendStatus } from '@/components/ui/status-badge';
import { BRAND, Fonts, getPalette } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useHealthService } from '@/services/services-context';

export default function HomeScreen() {
  const isDark = useColorScheme() === 'dark';
  const palette = getPalette(isDark);
  const router = useRouter();
  const health = useHealthService();

  const [backendState, setBackendState] = useState<BackendStatus>('Checking');

  // Hydration mismatch fix
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    async function checkBackend() {
      try {
        const ok = await health.checkBackendHealth();
        setBackendState(ok ? 'Online' : 'Offline');
      } catch (error) {
        console.warn('Backend checking failed, falling back to offline state:', error);
        setBackendState('Offline');
      }
    }
    checkBackend();
  }, [health]);

  if (!mounted) {
    return null;
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.greetingText, { color: palette.textSecondary }]}>
              Hello, Traveler 🥀
            </Text>
            <Text style={[styles.title, { color: palette.textPrimary }]}>My Planner</Text>
          </View>
          <StatusBadge status={backendState} />
        </View>

        {/* Welcome Banner Card */}
        <WelcomeBanner />

        {/* Quick Actions Grid */}
        <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>
          Quick Actions
        </Text>
        <View style={styles.gridRow}>
          <QuickActionCard
            iconName="navigate"
            iconColor={BRAND.ink}
            iconBackground={BRAND.cyan}
            title="Plan Calm Route"
            description="Find sensory friendly paths"
            onPress={() => router.push('/routes')}
          />
          <QuickActionCard
            iconName="settings-sharp"
            iconColor={BRAND.ink}
            iconBackground={BRAND.green}
            title="Sensory Sensitivities"
            description="Update comfort thresholds"
            onPress={() => router.push('/preferences')}
          />
        </View>

        {/* Daily Travel Tips */}
        <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>
          Daily Travel Tips
        </Text>
        <DailyTips />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  greetingText: {
    fontSize: 13,
    fontWeight: '600',
  },
  title: {
    fontSize: 36,
    fontFamily: Fonts?.display,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: -1,
    lineHeight: 36,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: Fonts?.display,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 12,
    letterSpacing: 0.2,
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 24,
  },
});
