import { StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { getOptionColors } from '@/components/preferences/options';
import { SENSORY_KEYS, SENSORY_META, presetValues } from '@/constants/presets';
import { Fonts, getPalette } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { usePresets } from '@/context/presets-context';
import type { SensitivityLevel } from '@/types/preference';

// Compact level labels so five chips fit on one phone-width row.
const SHORT_LEVEL: Record<SensitivityLevel, string> = {
  little: 'Little',
  medium: 'Some',
  high: 'A lot',
  veryhigh: 'Too much',
};

/**
 * Read-only preview of the active preset's sensory levels — one mini-column per
 * sense (emoji + label + colored level chip), so the home screen shows at a
 * glance what the selected preset means.
 */
export function PresetGlimpse() {
  const isDark = useColorScheme() === 'dark';
  const palette = getPalette(isDark);
  const { presets, activeId } = usePresets();

  const active = presets.find((p) => p.id === activeId) ?? presets[0];
  const values = presetValues(active);

  return (
    <View style={styles.row}>
      {SENSORY_KEYS.map((key) => {
        const level = values[key];
        const colors = getOptionColors(level, isDark);

        return (
          <View key={key} style={styles.cell}>
            <Text style={styles.emoji}>{SENSORY_META[key].emoji}</Text>
            <Text
              style={[styles.senseLabel, { color: palette.textMuted }]}
              numberOfLines={1}>
              {SENSORY_META[key].short}
            </Text>
            <View
              style={[
                styles.chip,
                { backgroundColor: colors.bg, borderColor: colors.border },
              ]}>
              <Text style={[styles.chipLabel, { color: colors.text }]} numberOfLines={1}>
                {SHORT_LEVEL[level]}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 14,
  } as ViewStyle,
  cell: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
  } as ViewStyle,
  emoji: {
    fontSize: 16,
    lineHeight: 20,
  },
  senseLabel: {
    fontSize: 10,
    fontFamily: Fonts?.semibold,
    fontWeight: '700',
    letterSpacing: 0,
  },
  chip: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 2,
    borderRadius: 999,
    borderWidth: 1,
  } as ViewStyle,
  chipLabel: {
    fontSize: 10,
    fontFamily: Fonts?.body,
    fontWeight: '700',
    letterSpacing: 0,
    textAlign: 'center',
  },
});
