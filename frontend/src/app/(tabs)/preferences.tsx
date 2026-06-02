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

import { OPTIONS } from '@/components/preferences/options';
import { PreferenceRow } from '@/components/preferences/preference-row';
import { getPreferences, savePreferences } from '@/services/preferences';
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

export default function UserPreferencesScreen() {
  const [preferences, setPreferences] = useState<Preference[]>(INITIAL_PREFERENCES);
  const [saved, setSaved] = useState(false);
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadPreferences = async () => {
      if (!username.trim()) {
        setPreferences(INITIAL_PREFERENCES);
        return;
      }

      try {
        setLoading(true);
        const data = await getPreferences(username);

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
  }, [username]);

  const handleSelect = (id: string, value: SensitivityLevel) => {
    setSaved(false);
    setPreferences((prev) => prev.map((p) => (p.id === id ? { ...p, value } : p)));
  };

  const allSet = preferences.every((p) => p.value !== null) && username.trim().length > 0;

  const handleSave = async () => {
    if (!allSet) return;

    try {
      await savePreferences({
        username: username.trim(),
        noise: valueFor(preferences, 'noise'),
        crowds: valueFor(preferences, 'crowds'),
        temperature: valueFor(preferences, 'temperature'),
        smell: valueFor(preferences, 'smell'),
        lights: valueFor(preferences, 'lights'),
      });
      setSaved(true);
    } catch (e) {
      console.error(e);
    }
  };

  const completedCount = preferences.filter((p) => p.value !== null).length;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAFAF8" />

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Your preferences</Text>

          <Text style={styles.subtitle}>
            Tell us what affects you most — we will find calmer routes for you.
          </Text>

          {/* Username Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Username</Text>

            <TextInput
              value={username}
              onChangeText={(text) => {
                setSaved(false);
                setUsername(text);
              }}
              placeholder="Enter your username"
              placeholderTextColor="#999"
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
            />

            {loading && <Text style={styles.loadingText}>Loading preferences...</Text>}
          </View>
        </View>

        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${(completedCount / preferences.length) * 100}%` },
            ]}
          />
        </View>

        <Text style={styles.progressLabel}>
          {completedCount} of {preferences.length} set
        </Text>

        {/* Card */}
        <View style={styles.card}>
          {/* Column headers */}
          <View style={styles.columnHeaders}>
            <View style={styles.labelSpacer} />

            {OPTIONS.map((o) => (
              <Text key={o.value} style={styles.columnHeader}>
                {o.value === 'dontcare' ? 'Do not\ncare' : o.label}
              </Text>
            ))}
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Rows */}
          {preferences.map((pref, i) => (
            <View key={pref.id}>
              <PreferenceRow preference={pref} onSelect={handleSelect} />

              {i < preferences.length - 1 && <View style={styles.rowDivider} />}
            </View>
          ))}
        </View>

        {/* Info note */}
        <View style={styles.note}>
          <Text style={styles.noteText}>
            💬 These preferences shape your route suggestions. You can update them anytime.
          </Text>
        </View>

        {/* Save button */}
        <TouchableOpacity
          onPress={handleSave}
          activeOpacity={0.85}
          style={[
            styles.saveBtn,
            !allSet && styles.saveBtnDisabled,
            saved && styles.saveBtnSaved,
          ]}
          disabled={!allSet}>
          <Text style={[styles.saveBtnText, saved && styles.saveBtnTextSaved]}>
            {saved ? '✓ Preferences saved' : 'Save preferences'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FAFAF8',
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
    color: '#1A1A1A',
    letterSpacing: -0.5,
    marginBottom: 6,
  },

  subtitle: {
    fontSize: 15,
    color: '#666666',
    lineHeight: 21,
  },

  // Input
  inputContainer: {
    marginTop: 18,
  },

  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },

  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    color: '#1A1A1A',
  },

  loadingText: {
    marginTop: 8,
    fontSize: 13,
    color: '#888888',
  },

  // Progress
  progressTrack: {
    height: 4,
    backgroundColor: '#EAEAEA',
    borderRadius: 2,
    marginBottom: 6,
    overflow: 'hidden',
  },

  progressFill: {
    height: 4,
    backgroundColor: '#1D9E75',
    borderRadius: 2,
  },

  progressLabel: {
    fontSize: 12,
    color: '#999999',
    marginBottom: 20,
  },

  // Card
  card: {
    backgroundColor: '#FFFFFF',
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

    marginBottom: 16,
  },

  // Column headers
  columnHeaders: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },

  labelSpacer: {
    width: 88,
  },

  columnHeader: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: '#AAAAAA',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  divider: {
    height: 1,
    backgroundColor: '#F0F0EE',
    marginBottom: 4,
  },

  rowDivider: {
    height: 1,
    backgroundColor: '#F5F5F3',
  },

  // Note
  note: {
    backgroundColor: '#F0F7FF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
  },

  noteText: {
    fontSize: 13,
    color: '#4A7BAB',
    lineHeight: 19,
  },

  // Save button
  saveBtn: {
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },

  saveBtnDisabled: {
    backgroundColor: '#CCCCCC',
  },

  saveBtnSaved: {
    backgroundColor: '#1D9E75',
  },

  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },

  saveBtnTextSaved: {
    color: '#FFFFFF',
  },
});
