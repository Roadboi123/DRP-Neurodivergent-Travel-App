import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { getPreset, type PresetId } from '@/constants/presets';
import { Fonts, getAccents, getPalette, hardShadow } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { usePresets } from '@/context/presets-context';

/** Active-chip fill per preset — reuses the calm→alert accent ramp. */
const ACCENT_FOR: Record<PresetId, 'green' | 'yellow' | 'orange'> = {
  good: 'green',
  medium: 'yellow',
  bad: 'orange',
};

export function PresetSwitcher({ showDescription = false }: { showDescription?: boolean }) {
  const isDark = useColorScheme() === 'dark';
  const palette = getPalette(isDark);
  const accents = getAccents(isDark);
  const { presets, activeId, applyPreset } = usePresets();

  return (
    <View>
      <View style={styles.row}>
        {presets.map((preset) => {
          const selected = preset.id === activeId;
          const fill = accents[ACCENT_FOR[preset.id]];

          return (
            <Pressable
              key={preset.id}
              onPress={() => applyPreset(preset.id)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${preset.name} preset`}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: selected ? fill : palette.surface,
                  borderColor: palette.border,
                },
                hardShadow(pressed ? 2 : 4),
                pressed ? styles.chipPressed : null,
              ]}>
              <Text style={styles.chipEmoji}>{preset.emoji}</Text>
              <Text
                style={[
                  styles.chipLabel,
                  { color: selected ? '#1d1c1c' : palette.textPrimary },
                ]}
                numberOfLines={1}>
                {preset.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {showDescription && activeId && (
        <Text style={[styles.description, { color: palette.textMuted }]}>
          {getPreset(activeId).description}
        </Text>
      )}
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
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 14,
    borderWidth: 2,
    gap: 4,
  } as ViewStyle,
  chipPressed: {
    transform: [{ translateY: 2 }],
  } as ViewStyle,
  chipEmoji: {
    fontSize: 22,
    lineHeight: 26,
  },
  chipLabel: {
    fontSize: 11,
    fontFamily: Fonts?.display,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  description: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 10,
  },
});
