import { StyleSheet, Text, View } from 'react-native';

import { OptionChip } from '@/components/preferences/option-chip';
import { OPTIONS } from '@/components/preferences/options';
import type { Preference, SensitivityLevel } from '@/types/preference';

export function PreferenceRow({
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

const styles = StyleSheet.create({
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
});
