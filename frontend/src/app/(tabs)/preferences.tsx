import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { PreferenceRow } from '@/components/preferences/preference-row';
import { PreferencesGuideSheet } from '@/components/preferences/preferences-guide-sheet';
import { GradientBackground } from '@/components/ui/gradient-background';
import { HeaderNav } from '@/components/ui/header-nav';
import { BRAND, Fonts, getPalette, hardShadow } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { usePreferencesService } from '@/services/services-context';
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
  const [preferences, setPreferences] = useState<Preference[]>(INITIAL_PREFERENCES);
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [guideVisible, setGuideVisible] = useState(false);

  const isDark = useColorScheme() === 'dark';
  const palette = getPalette(isDark);

  useEffect(() => {
    const loadPreferences = async () => {
      if (!username.trim()) {
        setPreferences(INITIAL_PREFERENCES);
        return;
      }

      try {
        setLoading(true);
        const data = await preferencesService.getPreferences(username);

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

    const timeout = setTimeout(loadPreferences, 500);
    return () => clearTimeout(timeout);
  }, [username, preferencesService]);

  // Persist immediately on input. The backend requires all five fields, so we
  // only save once every item is set and a username is present.
  const persist = async (prefs: Preference[]) => {
    if (!username.trim()) return;
    if (!prefs.every((p) => p.value !== null)) return;

    try {
      setSaveStatus('saving');
      await preferencesService.savePreferences({
        username: username.trim(),
        noise: valueFor(prefs, 'noise'),
        crowds: valueFor(prefs, 'crowds'),
        temperature: valueFor(prefs, 'temperature'),
        smell: valueFor(prefs, 'smell'),
        lights: valueFor(prefs, 'lights'),
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

      <HeaderNav />

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: palette.textPrimary }]}>Your preferences</Text>

            <TouchableOpacity
              onPress={() => setGuideVisible(true)}
              hitSlop={10}
              accessibilityLabel="About your preferences">
              <Ionicons name="information-circle-outline" size={26} color={palette.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Username Input */}
          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: palette.textPrimary }]}>Username</Text>

            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder="Enter your username"
              placeholderTextColor={palette.textMuted}
              style={[
                styles.input,
                {
                  backgroundColor: palette.surface,
                  borderColor: palette.border,
                  color: palette.textPrimary,
                },
              ]}
              autoCapitalize="none"
              autoCorrect={false}
            />

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
        </View>

        {/* Scale prompt */}
        <Text style={[styles.sectionTitle, { color: palette.textPrimary }]}>
          How much does each of these affect you?
        </Text>

        {/* Card */}
        <View style={[styles.card, { backgroundColor: palette.surface, borderColor: BRAND.ink }]}>
          {preferences.map((pref, i) => (
            <View key={pref.id}>
              <PreferenceRow preference={pref} onSelect={handleSelect} />

              {i < preferences.length - 1 && (
                <View style={[styles.rowDivider, { backgroundColor: palette.divider }]} />
              )}
            </View>
          ))}
        </View>
      </ScrollView>

      <PreferencesGuideSheet visible={guideVisible} onClose={() => setGuideVisible(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },

  container: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 100,
  },

  // Header
  header: {
    marginBottom: 20,
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  title: {
    fontSize: 34,
    fontFamily: Fonts?.display,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: -1,
  },

  sectionTitle: {
    fontSize: 17,
    fontFamily: Fonts?.display,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
    marginBottom: 12,
  },

  // Input
  inputContainer: {
    marginTop: 18,
  },

  inputLabel: {
    fontSize: 12,
    fontFamily: Fonts?.display,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 8,
  },

  input: {
    borderWidth: 2,
    borderColor: BRAND.ink,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    ...hardShadow(3),
  },

  statusText: {
    marginTop: 8,
    fontSize: 13,
  },

  statusSaved: {
    color: '#1D9E75',
    fontWeight: '600',
  },

  statusError: {
    color: '#C0392B',
    fontWeight: '600',
  },

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
  },
});
