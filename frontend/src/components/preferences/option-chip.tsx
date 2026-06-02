import { StyleSheet, Text, TouchableOpacity } from 'react-native';

import { OPTION_COLORS } from '@/components/preferences/options';
import type { SensitivityLevel } from '@/types/preference';

export function OptionChip({
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
          ? {
              backgroundColor: colors.bg,
              borderColor: colors.border,
            }
          : styles.chipUnselected,
      ]}>
      {option.value === 'dontcare' && (
        <Text style={[styles.chipX, selected && { color: colors.text }]}>✕ </Text>
      )}

      <Text
        style={[
          styles.chipLabel,
          selected
            ? {
                color: colors.text,
                fontWeight: '600',
              }
            : styles.chipLabelUnselected,
        ]}>
        {option.label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
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
});
