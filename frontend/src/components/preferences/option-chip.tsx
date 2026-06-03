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
      <Text
        style={[
          styles.chipLabel,
          selected
            ? {
                color: colors.text,
                fontWeight: '700',
              }
            : (isDark ? styles.chipLabelUnselectedDark : styles.chipLabelUnselected),
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.85}>
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
    paddingHorizontal: 2,
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
    fontSize: 12,
    color: '#888888',
    fontWeight: '600',
    textAlign: 'center',
  },
  chipLabelUnselected: {
    color: '#999999',
  },
  chipLabelUnselectedDark: {
    color: '#555555',
  },
});
