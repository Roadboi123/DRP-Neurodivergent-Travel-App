import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { PRESET_NAMES } from '@/constants/presets';
import { Fonts, getAccents, getPalette, hardShadow } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { usePresets } from '@/context/presets-context';

export function PresetSwitcher() {
  const isDark = useColorScheme() === 'dark';
  const palette = getPalette(isDark);
  const accents = getAccents(isDark);
  const { presets, activeId, selectPreset } = usePresets();

  return (
    <View style={styles.row}>
      {presets.map((preset) => {
        const selected = preset.id === activeId;

        return (
          <Pressable
            key={preset.id}
            onPress={() => selectPreset(preset.id)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`${PRESET_NAMES[preset.id]} preset`}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: selected ? accents.pink : palette.surface,
                borderColor: palette.border,
              },
              hardShadow(pressed ? 2 : 4),
              pressed ? styles.chipPressed : null,
            ]}>
            <Text
              style={[
                styles.chipLabel,
                { color: selected ? '#ffffff' : palette.textPrimary },
              ]}
              numberOfLines={1}>
              {PRESET_NAMES[preset.id]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
  } as ViewStyle,
  chip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderRadius: 14,
    borderWidth: 2,
  } as ViewStyle,
  chipPressed: {
    transform: [{ translateY: 2 }],
  } as ViewStyle,
  chipLabel: {
    fontSize: 12,
    fontFamily: Fonts?.display,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
});
