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
      <Text
        style={[
          styles.chipLabel,
          selected
            ? {
                color: colors.text,
                fontWeight: '700',
              }
            : styles.chipLabelUnselected,
        ]}
        numberOfLines={1}>
        {option.label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  chipUnselected: {
    backgroundColor: '#F7F7F5',
    borderColor: '#E8E8E6',
  },
  chipLabel: {
    fontSize: 12,
    color: '#888888',
    fontWeight: '600',
    textAlign: 'center',
  },
  chipLabelUnselected: {
    color: '#999999',
  },
});
