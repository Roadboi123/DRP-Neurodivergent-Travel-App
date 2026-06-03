import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { PreferenceRow } from '@/components/preferences/preference-row';
import { getPalette } from '@/constants/theme';
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
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={palette.background}
      />

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: palette.textPrimary }]}>Your preferences</Text>

          <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
            Tell us what things affect you the most
          </Text>

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

        {/* Card */}
        <View style={[styles.card, { backgroundColor: palette.surface }]}>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },

  container: {
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 40,
  },

  // Header
  header: {
    marginBottom: 20,
  },

  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 6,
  },

  subtitle: {
    fontSize: 15,
    lineHeight: 21,
  },

  // Input
  inputContainer: {
    marginTop: 18,
  },

  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },

  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
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
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },

    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },

  rowDivider: {
    height: 1,
  },
});
