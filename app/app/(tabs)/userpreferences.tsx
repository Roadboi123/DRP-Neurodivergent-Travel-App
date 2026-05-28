import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from 'react-native';


type SensitivityLevel = 'little' | 'manageable' | 'dontcare';

interface Preference {
  id: string;
  label: string;
  emoji: string;
  value: SensitivityLevel | null;
}

const OPTIONS: { value: SensitivityLevel; label: string }[] = [
  { value: 'little',     label: 'A little' },
  { value: 'manageable', label: 'Manageable' },
  { value: 'dontcare',   label: "Do not care" },
];

const OPTION_COLORS: Record<SensitivityLevel, { bg: string; text: string; border: string }> = {
  little:     { bg: '#FFE8E8', text: '#C0392B', border: '#F5A9A9' },
  manageable: { bg: '#FFF3DC', text: '#B7770D', border: '#F5D08A' },
  dontcare:   { bg: '#EAEAEA', text: '#666666', border: '#CCCCCC' },
};

const INITIAL_PREFERENCES: Preference[] = [
  { id: 'noise',       label: 'Noise',       emoji: '🔊', value: null },
  { id: 'crowds',      label: 'Crowds',      emoji: '👥', value: null },
  { id: 'temperature', label: 'Temperature', emoji: '🌡️', value: null },
  { id: 'smell',       label: 'Smell',       emoji: '👃', value: null },
  { id: 'lights',      label: 'Lights',      emoji: '💡', value: null },
];

function OptionChip({
  option,
  selected,
  onPress,
}: {
  option: { value: SensitivityLevel; label: string };
  selected: boolean;
  onPress: () => void;
}) {
  const colors = OPTION_COLORS[option.value];

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        styles.chip,
        selected
          ? { backgroundColor: colors.bg, borderColor: colors.border }
          : styles.chipUnselected,
      ]}
    >
      {option.value === 'dontcare' && (
        <Text style={[styles.chipX, selected && { color: colors.text }]}>✕ </Text>
      )}
      <Text
        style={[
          styles.chipLabel,
          selected ? { color: colors.text, fontWeight: '600' } : styles.chipLabelUnselected,
        ]}
      >
        {option.value === 'dontcare' ? "Do not care" : option.label}
      </Text>
    </TouchableOpacity>
  );
}

function PreferenceRow({
  preference,
  onSelect,
}: {
  preference: Preference;
  onSelect: (id: string, value: SensitivityLevel) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowLabel}>
        <Text style={styles.rowEmoji}>{preference.emoji}</Text>
        <Text style={styles.rowText}>{preference.label}</Text>
      </View>
      <View style={styles.chipRow}>
        {OPTIONS.map((option) => (
          <OptionChip
            key={option.value}
            option={option}
            selected={preference.value === option.value}
            onPress={() => onSelect(preference.id, option.value)}
          />
        ))}
      </View>
    </View>
  );
}

export default function UserPreferencesScreen() {
  const [preferences, setPreferences] = useState<Preference[]>(INITIAL_PREFERENCES);
  const [saved, setSaved] = useState(false);

  const handleSelect = (id: string, value: SensitivityLevel) => {
    setSaved(false);
    setPreferences((prev) =>
      prev.map((p) => (p.id === id ? { ...p, value } : p))
    );
  };

  const allSet = preferences.every((p) => p.value !== null);

  const handleSave = async () => {
    if (!allSet) return;
    try {
      const res = await fetch('https://drp-neurodivergent-travel-app-production.up.railway.app/preferences/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          noise:       preferences.find(p => p.id === 'noise')?.value,
          crowds:      preferences.find(p => p.id === 'crowds')?.value,
          temperature: preferences.find(p => p.id === 'temperature')?.value,
          smell:       preferences.find(p => p.id === 'smell')?.value,
          lights:      preferences.find(p => p.id === 'lights')?.value,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      setSaved(true);
    } catch (e) {
      console.error(e);
    }
  };

  const completedCount = preferences.filter((p) => p.value !== null).length;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#FAFAF8" />
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Your preferences</Text>
          <Text style={styles.subtitle}>
            Tell us what affects you most — we will find calmer routes for you.
          </Text>
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
            <View style={styles.rowLabel} />
            {OPTIONS.map((o) => (
              <Text key={o.value} style={styles.columnHeader}>
                {o.value === 'dontcare' ? "Do not\ncare" : o.label}
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
          disabled={!allSet}
        >
          <Text style={[styles.saveBtnText, saved && styles.saveBtnTextSaved]}>
            {saved ? '✓  Preferences saved' : 'Save preferences'}
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
    shadowOffset: { width: 0, height: 2 },
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

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  rowLabel: {
    width: 88,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowEmoji: {
    fontSize: 18,
  },
  rowText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
    letterSpacing: -0.2,
  },
  chipRow: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'space-between',
  },
  rowDivider: {
    height: 1,
    backgroundColor: '#F5F5F3',
  },

  // Chips
  chip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  chipUnselected: {
    backgroundColor: '#F7F7F5',
    borderColor: '#E8E8E6',
  },
  chipX: {
    fontSize: 10,
    color: '#AAAAAA',
    fontWeight: '700',
  },
  chipLabel: {
    fontSize: 11,
    color: '#AAAAAA',
    fontWeight: '500',
    textAlign: 'center',
  },
  chipLabelUnselected: {
    color: '#BBBBBB',
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