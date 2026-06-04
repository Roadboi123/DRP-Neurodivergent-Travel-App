import React, { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { DailyTips } from '@/components/home/daily-tips';
import { QuickActionCard } from '@/components/home/quick-action-card';
import { GradientBackground } from '@/components/ui/gradient-background';
import { StatusBadge, type BackendStatus } from '@/components/ui/status-badge';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { BRAND, Fonts, getAccents, getPalette } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useHealthService, useRoutesService } from '@/services/services-context';
import { useAuth } from '@/context/auth-context';
import { ProfileModal } from '@/components/profile/profile-modal';
import type { WarningItem } from '@/types/route';
import { useIsFocused } from '@react-navigation/native';

export default function HomeScreen() {
  const isDark = useColorScheme() === 'dark';
  const palette = getPalette(isDark);
  const accents = getAccents(isDark);
  const router = useRouter();
  const health = useHealthService();
  const { username, isLoggedIn } = useAuth();

  const routesService = useRoutesService();
  const isFocused = useIsFocused();

  const [backendState, setBackendState] = useState<BackendStatus>('Checking');
  const [profileVisible, setProfileVisible] = useState(false);
  const [warnings, setWarnings] = useState<WarningItem[]>([]);

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

  useEffect(() => {
    let active = true;
    async function fetchWarnings() {
      if (!isFocused) return;
      try {
        const data = await routesService.getWarnings('', true);
        if (active) {
          setWarnings(data);
        }
      } catch (error) {
        console.warn('Failed to fetch warnings on home screen:', error);
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

  if (!mounted) {
    return null;
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>
      <GradientBackground />
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.greetingText, { color: palette.textSecondary }]}>
              {isLoggedIn ? `Hello, ${username} 🥀` : 'Hello, Traveler 🥀'}
            </Text>
            <Text style={[styles.title, { color: palette.textPrimary }]}>My Planner</Text>
          </View>
          <View style={styles.headerRightActions}>
            <ThemeToggle />
            <TouchableOpacity
              onPress={() => setProfileVisible(true)}
              style={[
                styles.profileIconBtn,
                { backgroundColor: isDark ? '#2E3543' : '#F0F0EE' }
              ]}
              activeOpacity={0.8}
              accessibilityLabel="Open profile modal"
            >
              <Ionicons
                name={isLoggedIn ? "person" : "person-outline"}
                size={18}
                color={isLoggedIn ? "#E91E63" : palette.textPrimary}
              />
              {isLoggedIn && <View style={[styles.profileActiveDot, { borderColor: palette.background }]} />}
            </TouchableOpacity>
          </View>
        </View>

        {/* Backend status (sits where the welcome banner used to) */}
        <View style={styles.statusRow}>
          <StatusBadge status={backendState} />
        </View>

        {/* Quick Actions Scroll List */}
        <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>
          Quick Actions
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.scrollContainer}
          contentContainerStyle={styles.scrollRow}
        >
          <QuickActionCard
            iconName="navigate"
            iconColor={BRAND.ink}
            iconBackground={accents.cyan}
            title="Plan Calm Route"
            description="Find sensory friendly paths"
            onPress={() => router.push('/routes')}
            style={styles.gridCard}
          />
          <QuickActionCard
            iconName="settings-sharp"
            iconColor={BRAND.ink}
            iconBackground={accents.green}
            title="Sensory Sensitivities"
            description="Update comfort thresholds"
            onPress={() => router.push('/preferences')}
            style={styles.gridCard}
          />
        </ScrollView>

        {/* Daily Travel Tips */}
        <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>
          Daily Travel Tips
        </Text>
        <DailyTips warnings={warnings} />
      </ScrollView>

      {/* Global Profile/Login Modal */}
      <ProfileModal visible={profileVisible} onClose={() => setProfileVisible(false)} />
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
    paddingBottom: 100,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  profileIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  profileActiveDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2E7D32',
    borderWidth: 1.5,
  },
  statusRow: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    marginBottom: 24,
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
  scrollContainer: {
    marginHorizontal: -20,
    marginBottom: 24,
  },
  scrollRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  gridCard: {
    width: 175,
    flex: undefined,
  },
});
