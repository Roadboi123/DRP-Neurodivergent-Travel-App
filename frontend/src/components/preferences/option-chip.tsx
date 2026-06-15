import { StyleSheet, Text, TouchableOpacity } from 'react-native';

import { getOptionColors } from '@/components/preferences/options';
import { Fonts, getPalette, Radii, softShadow } from '@/constants/theme';
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
  const palette = getPalette(isDark);
  const colors = getOptionColors(option.value, isDark);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        styles.chip,
        selected
          ? { backgroundColor: colors.bg, borderColor: colors.border, ...softShadow(1) }
          : { backgroundColor: palette.surface, borderColor: palette.border },
      ]}>
      <Text
        style={[styles.chipLabel, { color: selected ? colors.text : palette.textPrimary }]}
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
    paddingVertical: 11,
    paddingHorizontal: 2,
    borderRadius: Radii.pill,
    borderWidth: 1,
  },
  chipLabel: {
    fontSize: 12,
    fontFamily: Fonts?.body,
    fontWeight: '700',
    letterSpacing: 0.1,
    textAlign: 'center',
  },
});
