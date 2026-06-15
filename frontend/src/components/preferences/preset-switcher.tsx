import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { presetDisplayName } from '@/constants/presets';
import { CLEARWAY, Fonts, getPalette, Radii, softShadow } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { usePresets } from '@/context/presets-context';

export function PresetSwitcher() {
  const isDark = useColorScheme() === 'dark';
  const palette = getPalette(isDark);
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
            accessibilityLabel={`${presetDisplayName(preset)} preset`}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: selected ? CLEARWAY.blue : palette.surface,
                borderColor: selected ? CLEARWAY.blue : palette.border,
              },
              softShadow(1),
              pressed ? styles.chipPressed : null,
            ]}>
            <Text
              style={[
                styles.chipLabel,
                { color: selected ? '#ffffff' : palette.textPrimary },
              ]}
              numberOfLines={1}>
              {presetDisplayName(preset)}
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
    borderRadius: Radii.pill,
    borderWidth: 1,
  } as ViewStyle,
  chipPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  } as ViewStyle,
  chipLabel: {
    fontSize: 13,
    fontFamily: Fonts?.semibold,
    fontWeight: '700',
    letterSpacing: 0.1,
    textAlign: 'center',
  },
});
