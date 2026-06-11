import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { presetDisplayName } from '@/constants/presets';
import { Fonts, getAccents, getPalette, hardShadow } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { usePresets } from '@/context/presets-context';

/**
 * Small badge on the routes screen showing which sensory preset the results are
 * scored against, with a one-tap shortcut to change it. Surfaces the active
 * profile so users don't have to open Preferences to check (which re-runs the
 * search).
 */
export function PresetIndicator() {
  const isDark = useColorScheme() === 'dark';
  const palette = getPalette(isDark);
  const accents = getAccents(isDark);
  const { presets, activeId } = usePresets();

  const active = presets.find((p) => p.id === activeId);
  if (!active) {
    return null;
  }

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => router.push('/preferences')}
      style={[styles.container, { backgroundColor: palette.surface, borderColor: palette.border }]}
      accessibilityRole="button"
      accessibilityLabel={`Routes use your ${presetDisplayName(active)} sensory profile. Tap to change.`}
    >
      <View style={[styles.dot, { backgroundColor: accents.pink, borderColor: palette.border }]} />
      <Text style={[styles.label, { color: palette.textSecondary }]} numberOfLines={1}>
        Sensory profile:{' '}
        <Text style={[styles.value, { color: palette.textPrimary }]}>{presetDisplayName(active)}</Text>
      </Text>
      <View style={styles.changeRow}>
        <Text style={[styles.change, { color: palette.textMuted }]}>Change</Text>
        <Ionicons name="chevron-forward" size={13} color={palette.textMuted} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 2,
    marginBottom: 10,
    ...hardShadow(3),
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
  },
  label: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
  },
  value: {
    fontFamily: Fonts?.display,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
  },
  change: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
});
