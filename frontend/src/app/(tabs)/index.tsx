import React, { useEffect, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { PreferencesNudge } from '@/components/home/preferences-nudge';
import { QuickActionCard } from '@/components/home/quick-action-card';
import { PresetSwitcher } from '@/components/preferences/preset-switcher';
import { PresetGlimpse } from '@/components/preferences/preset-glimpse';
import { GradientBackground } from '@/components/ui/gradient-background';
import { BRAND, CLEARWAY, Fonts, getAccents, getPalette, softShadow } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/context/auth-context';

export default function HomeScreen() {
  const isDark = useColorScheme() === 'dark';
  const palette = getPalette(isDark);
  const accents = getAccents(isDark);
  const router = useRouter();
  const { username, isLoggedIn, setProfileModalVisible } = useAuth();

  // Hydration mismatch fix
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

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
              {isLoggedIn ? `Hello, ${username}!` : 'Hello!'}
            </Text>
            <Text style={[styles.title, { color: palette.textPrimary }]}>My Planner</Text>
          </View>
          <View style={styles.headerRightActions}>
            <TouchableOpacity
              onPress={() => setProfileModalVisible(true)}
              style={[
                styles.profileIconBtn,
                { backgroundColor: palette.surface, borderColor: palette.border, borderWidth: 1 },
                softShadow(1),
              ]}
              activeOpacity={0.8}
              accessibilityLabel="Open profile modal"
            >
              <Ionicons
                name={isLoggedIn ? "person" : "person-outline"}
                size={18}
                color={isLoggedIn ? CLEARWAY.blueStrong : palette.textPrimary}
              />
              {isLoggedIn && <View style={[styles.profileActiveDot, { borderColor: CLEARWAY.white }]} />}
            </TouchableOpacity>
          </View>
        </View>

        {/* Plan a route — the single primary action, full-width. */}
        <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>
          Plan a route
        </Text>
        <QuickActionCard
          iconName="navigate"
          iconColor={BRAND.ink}
          iconBackground={accents.cyan}
          title="Plan Calm Route"
          description="Find sensory friendly paths"
          onPress={() => router.push('/routes')}
          style={styles.planCard}
        />

        {/* Signpost for travellers who haven't personalised yet: preferences are
            account-bound, so for logged-out users this opens the login/profile
            modal. Logged-in users get the preset section below instead. */}
        {!isLoggedIn && (
          <PreferencesNudge
            message="Log in to set your sensory preferences for calmer, personalised routes."
            onPress={() => setProfileModalVisible(true)}
          />
        )}

        {/* Preset profiles — quick way to re-tune routes, with a glimpse of the
            active profile's sensory levels. An Edit button opens the full editor. */}
        {isLoggedIn && (
          <View style={styles.presetSection}>
            <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>
              Your sensory preferences
            </Text>
            <Pressable
              onPress={() => router.push('/preferences')}
              accessibilityRole="button"
              accessibilityLabel="Edit sensory preferences"
              style={({ pressed }) => [
                styles.editButton,
                {
                  backgroundColor: palette.surface,
                  borderColor: palette.borderStrong,
                },
                softShadow(1),
                pressed ? styles.editButtonPressed : null,
              ]}>
              <Ionicons name="build" size={14} color={palette.textPrimary} />
              <Text style={[styles.editButtonLabel, { color: palette.textPrimary }]}>
                Edit
              </Text>
            </Pressable>
            <PresetSwitcher />
            <PresetGlimpse />
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
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  profileActiveDot: {
    position: 'absolute',
    top: 3,
    right: 3,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: CLEARWAY.good,
    borderWidth: 1.5,
  },
  statusRow: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    marginBottom: 24,
  },
  greetingText: {
    fontSize: 14,
    fontFamily: Fonts?.body,
    fontWeight: '600',
  },
  title: {
    fontSize: 40,
    fontFamily: Fonts?.display,
    fontWeight: '800',
    letterSpacing: -1.4,
    lineHeight: 42,
  },
  sectionTitle: {
    fontSize: 19,
    fontFamily: Fonts?.display,
    fontWeight: '800',
    marginBottom: 12,
    letterSpacing: -0.4,
  },
  planCard: {
    width: '100%',
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
    marginBottom: 24,
  },
  presetSection: {
    marginBottom: 24,
  },
  editButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 12,
  },
  editButtonPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.85,
  },
  editButtonLabel: {
    fontSize: 13,
    fontFamily: Fonts?.body,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
});
