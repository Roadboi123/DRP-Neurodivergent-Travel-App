import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { PreferenceRow } from '@/components/preferences/preference-row';
import { PreferencesGuideSheet } from '@/components/preferences/preferences-guide-sheet';
import { GradientBackground } from '@/components/ui/gradient-background';
import { HeaderNav } from '@/components/ui/header-nav';
import { Fonts, getPalette, hardShadow } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { usePreferencesService } from '@/services/services-context';
import { useAuth } from '@/context/auth-context';
import { ProfileModal } from '@/components/profile/profile-modal';
import type { Preference, SensitivityLevel } from '@/types/preference';

const INITIAL_PREFERENCES: Preference[] = [
  { id: 'noise', label: 'Noise', emoji: '🔊', value: null },
  { id: 'crowds', label: 'Crowds', emoji: '👥', value: null },
  { id: 'temperature', label: 'Temperature', emoji: '🌡️', value: null },
  { id: 'smell', label: 'Smell', emoji: '👃', value: null },
  { id: 'lights', label: 'Lights', emoji: '💡', value: null },
];

const valueFor = (prefs: Preference[], id: string): SensitivityLevel | null =>
  prefs.find((p) => p.id === id)?.value ?? null;

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export default function UserPreferencesScreen() {
  const preferencesService = usePreferencesService();
  const { username: authUsername, isLoggedIn } = useAuth();
  const [preferences, setPreferences] = useState<Preference[]>(INITIAL_PREFERENCES);
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [guideVisible, setGuideVisible] = useState(false);
  const [profileVisible, setProfileVisible] = useState(false);

  const isDark = useColorScheme() === 'dark';
  const palette = getPalette(isDark);

  useEffect(() => {
    const loadPreferences = async () => {
      if (!isLoggedIn) {
        setPreferences(INITIAL_PREFERENCES);
        return;
      }

      try {
        setLoading(true);
        const data = await preferencesService.getPreferences('me');

        if (!data) {
          setPreferences(INITIAL_PREFERENCES);
          return;
        }

        setPreferences([
          { id: 'noise', label: 'Noise', emoji: '🔊', value: data.noise ?? null },
          { id: 'crowds', label: 'Crowds', emoji: '👥', value: data.crowds ?? null },
          { id: 'temperature', label: 'Temperature', emoji: '🌡️', value: data.temperature ?? null },
          { id: 'smell', label: 'Smell', emoji: '👃', value: data.smell ?? null },
          { id: 'lights', label: 'Lights', emoji: '💡', value: data.lights ?? null },
        ]);
      } catch (e) {
        console.error('Failed to load preferences', e);
      } finally {
        setLoading(false);
      }
    };

    loadPreferences();
  }, [isLoggedIn, authUsername, preferencesService]);

  // Persist immediately on input. The backend requires all five fields, so we
  // only save once every item is set and a username is present.
  const persist = async (prefs: Preference[]) => {
    if (!isLoggedIn || !authUsername) return;
    if (!prefs.every((p) => p.value !== null)) return;

    try {
      setSaveStatus('saving');
      await preferencesService.savePreferences({
        username: authUsername,
        noise: valueFor(prefs, 'noise')!,
        crowds: valueFor(prefs, 'crowds')!,
        temperature: valueFor(prefs, 'temperature')!,
        smell: valueFor(prefs, 'smell')!,
        lights: valueFor(prefs, 'lights')!,
      });
      setSaveStatus('saved');
    } catch (e) {
      console.error(e);
      setSaveStatus('error');
    }
  };

  const handleSelect = (id: string, value: SensitivityLevel) => {
    const next = preferences.map((p) => (p.id === id ? { ...p, value } : p));
    setPreferences(next);
    void persist(next);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>
      <GradientBackground />
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={palette.background}
      />

      <HeaderNav onProfilePress={() => setProfileVisible(true)} />

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: palette.textPrimary, fontFamily: Fonts?.rounded }]}>
              Your preferences
            </Text>

            <TouchableOpacity
              onPress={() => setGuideVisible(true)}
              hitSlop={10}
              style={styles.infoButton}
              accessibilityLabel="About your preferences">
              <Ionicons name="information-circle-outline" size={26} color={palette.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {!isLoggedIn ? (
          <View style={[styles.splashContainer, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <View style={[styles.iconCircle, { backgroundColor: isDark ? '#2E3543' : '#F0F0EE' }]}>
              <Ionicons name="options-outline" size={36} color="#E91E63" />
            </View>
            <Text style={[styles.splashTitle, { color: palette.textPrimary }]}>
              Sign in to customize
            </Text>
            <Text style={[styles.splashDesc, { color: palette.textSecondary }]}>
              Create an account or sign in to set your comfort levels for noise, crowds, temperature, and more. Your preferences will be saved to your profile and applied automatically to all planned routes.
            </Text>
            
            <TouchableOpacity
              style={[styles.loginBtn, { backgroundColor: '#E91E63' }]}
              onPress={() => setProfileVisible(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.loginBtnText}>Sign In / Register</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.loggedInHeaderRow}>
              <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>
                How much does each of these affect you?
              </Text>
              
              {loading && (
                <Text style={[styles.statusText, { color: palette.textMuted }]}>
                  Loading preferences…
                </Text>
              )}
              {!loading && saveStatus === 'saving' && (
                <Text style={[styles.statusText, { color: palette.textMuted }]}>Saving…</Text>
              )}
              {!loading && saveStatus === 'saved' && (
                <Text style={[styles.statusText, styles.statusSaved]}>✓ Saved</Text>
              )}
              {!loading && saveStatus === 'error' && (
                <Text style={[styles.statusText, styles.statusError]}>Couldn’t save — try again</Text>
              )}
            </View>

            <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              {preferences.map((pref, i) => (
                <View key={pref.id}>
                  <PreferenceRow preference={pref} onSelect={handleSelect} />

                  {i < preferences.length - 1 && (
                    <View style={[styles.rowDivider, { backgroundColor: palette.divider }]} />
                  )}
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      <PreferencesGuideSheet visible={guideVisible} onClose={() => setGuideVisible(false)} />
      <ProfileModal visible={profileVisible} onClose={() => setProfileVisible(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  } as ViewStyle,

  container: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 100,
  },

  // Header
  header: {
    marginBottom: 20,
  } as ViewStyle,

  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },

  title: {
    flex: 1,
    fontSize: 34,
    fontFamily: Fonts?.display,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: -1,
  },

  infoButton: {
    marginTop: 6,
  },

  sectionTitle: {
    fontSize: 17,
    fontFamily: Fonts?.display,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
    marginBottom: 12,
  },

  statusText: {
    fontSize: 13,
  } as TextStyle,

  statusSaved: {
    color: '#1D9E75',
    fontWeight: '600',
  } as TextStyle,

  statusError: {
    color: '#C0392B',
    fontWeight: '600',
  } as TextStyle,

  // Card
  card: {
    borderRadius: 14,
    borderWidth: 2,
    paddingVertical: 8,
    paddingHorizontal: 16,
    ...hardShadow(6),
  },

  rowDivider: {
    height: 1,
  } as ViewStyle,

  // Splash styling
  splashContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
    borderRadius: 24,
    borderWidth: 1,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  } as ViewStyle,

  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  } as ViewStyle,

  splashTitle: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
  } as TextStyle,

  splashDesc: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
  } as TextStyle,

  loginBtn: {
    width: '100%',
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#E91E63',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  } as ViewStyle,

  loginBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  } as TextStyle,

  loggedInHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 8,
  } as ViewStyle,
});

