import { StyleSheet, Text, View } from 'react-native';

import { OptionChip } from '@/components/preferences/option-chip';
import { OPTIONS } from '@/components/preferences/options';
import { Fonts, getPalette } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { Preference, SensitivityLevel } from '@/types/preference';

export function PreferenceRow({
  preference,
  onSelect,
}: {
  preference: Preference;
  onSelect: (id: string, value: SensitivityLevel) => void;
}) {
  const palette = getPalette(useColorScheme() === 'dark');

  return (
    <View style={styles.row}>
      <View style={styles.rowLabel}>
        <Text style={styles.rowEmoji}>{preference.emoji}</Text>
        <Text style={[styles.rowText, { color: palette.textPrimary }]}>{preference.label}</Text>
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

const styles = StyleSheet.create({
  row: {
    paddingVertical: 14,
  },
  rowLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  rowEmoji: {
    fontSize: 18,
  },
  rowText: {
    fontSize: 16,
    fontFamily: Fonts?.display,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
  },
});
