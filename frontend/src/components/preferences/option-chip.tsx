import { StyleSheet, Text, TouchableOpacity } from 'react-native';

import { getOptionColors } from '@/components/preferences/options';
import { useColorScheme } from '@/hooks/use-color-scheme';
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
  const isDark = useColorScheme() === 'dark';
  const colors = getOptionColors(option.value, isDark);

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
          : (isDark ? styles.chipUnselectedDark : styles.chipUnselected),
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
            : (isDark ? styles.chipLabelUnselectedDark : styles.chipLabelUnselected),
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
  chipUnselectedDark: {
    backgroundColor: '#1C212A',
    borderColor: '#2A313E',
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
  chipLabelUnselectedDark: {
    color: '#555555',
  },
});
