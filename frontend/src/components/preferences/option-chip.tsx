import { StyleSheet, Text, TouchableOpacity } from 'react-native';

import { getOptionColors } from '@/components/preferences/options';
import { Fonts, getPalette, hardShadow } from '@/constants/theme';
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
          ? { backgroundColor: colors.bg, borderColor: colors.border }
          : { backgroundColor: palette.surface, borderColor: palette.border },
      ]}>
      <Text
        style={[
          styles.chipLabel,
          { color: selected ? colors.text : palette.textPrimary },
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
    ...hardShadow(3),
  },
  chipLabel: {
    fontSize: 9.5,
    fontFamily: Fonts?.display,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0,
    textAlign: 'center',
  },
});
