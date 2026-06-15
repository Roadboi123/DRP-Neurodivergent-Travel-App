import React, { useEffect, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { PreferencesNudge } from '@/components/home/preferences-nudge';
import { PresetSwitcher } from '@/components/preferences/preset-switcher';
import { PresetGlimpse } from '@/components/preferences/preset-glimpse';
import { GradientBackground } from '@/components/ui/gradient-background';
import { Glass } from '@/components/ui/glass';
import { CLEARWAY, Fonts, getPalette, Radii, softShadow } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuth } from '@/context/auth-context';

const LOGO = require('../../../assets/images/clearway-logo.png');

export default function HomeScreen() {
  const isDark = useColorScheme() === 'dark';
  const palette = getPalette(isDark);
  const router = useRouter();
  const { isLoggedIn, setProfileModalVisible } = useAuth();

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
        {/* Header — Clearway brand lockup + profile */}
        <View style={styles.headerRow}>
          <View style={styles.brand}>
            <Image source={LOGO} style={styles.logo} contentFit="contain" />
            <Text style={[styles.wordmark, { color: palette.textPrimary }]}>Clearway</Text>
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

        {/* Primary action — an inviting, search-bar-style rectangular CTA. */}
        <Pressable
          onPress={() => router.push('/routes')}
          accessibilityRole="button"
          accessibilityLabel="Get me somewhere — plan a calm route"
          style={({ pressed }) => [styles.planCard, pressed && styles.ctaPressed]}>
          <Glass radius={Radii.input} shadow={2}>
            <View style={styles.searchRow}>
              <View style={styles.searchIconTile}>
                <Ionicons name="search" size={22} color={CLEARWAY.blueStrong} />
              </View>
              <Text style={[styles.searchText, { color: palette.textPrimary }]}>Get me somewhere</Text>
            </View>
          </Glass>
        </Pressable>

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
    marginBottom: 24,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logo: {
    width: 46,
    height: 46,
  },
  wordmark: {
    fontSize: 30,
    fontFamily: Fonts?.display,
    fontWeight: '800',
    letterSpacing: -1.2,
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  searchIconTile: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: CLEARWAY.bluePillFrom,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchText: {
    fontSize: 20,
    fontFamily: Fonts?.display,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  ctaPressed: {
    transform: [{ scale: 0.99 }],
    opacity: 0.92,
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
