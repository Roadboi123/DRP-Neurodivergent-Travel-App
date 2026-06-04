import { StyleSheet, Text, TouchableOpacity } from 'react-native';

import { getOptionColors } from '@/components/preferences/options';
import { BRAND, Fonts, hardShadow } from '@/constants/theme';
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
        selected ? { backgroundColor: colors.bg } : styles.chipUnselected,
      ]}>
      <Text
        style={[
          styles.chipLabel,
          selected ? { color: colors.text } : styles.chipLabelUnselected,
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
    paddingVertical: 11,
    paddingHorizontal: 2,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: BRAND.ink,
    ...hardShadow(3),
  },
  chipUnselected: {
    backgroundColor: BRAND.white,
  },
  chipLabel: {
    fontSize: 9.5,
    fontFamily: Fonts?.display,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0,
    textAlign: 'center',
  },
  chipLabelUnselected: {
    color: BRAND.ink,
  },
});
