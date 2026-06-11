import { StyleSheet, Text, View } from 'react-native';

import { getOptionColors, LEVEL_GLOSS, OPTIONS } from '@/components/preferences/options';
import { Fonts, getPalette } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

/**
 * Always-visible key explaining what each sensitivity level actually does to a
 * route. Surfacing the concrete behaviour inline (it used to live only in the
 * info sheet) means the scale reads clearly without opening a guide — direct
 * user feedback. Shares `LEVEL_GLOSS`/`OPTIONS` with the guide sheet.
 */
export function PreferenceScaleLegend() {
  const isDark = useColorScheme() === 'dark';
  const palette = getPalette(isDark);

  return (
    <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <Text style={[styles.heading, { color: palette.textMuted }]}>What each level means</Text>
      {OPTIONS.map((option) => {
        const colors = getOptionColors(option.value, isDark);
        return (
          <View key={option.value} style={styles.row}>
            <View style={[styles.chip, { backgroundColor: colors.bg, borderColor: colors.border }]}>
              <Text style={[styles.chipText, { color: colors.text }]}>{option.label}</Text>
            </View>
            <Text style={[styles.gloss, { color: palette.textSecondary }]}>
              {LEVEL_GLOSS[option.value]}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    borderWidth: 2,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 8,
    marginBottom: 16,
  },
  heading: {
    fontSize: 11,
    fontFamily: Fonts?.display,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  chip: {
    width: 92,
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 30,
    borderWidth: 2,
  },
  chipText: {
    fontSize: 11,
    fontFamily: Fonts?.display,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  gloss: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 17,
  },
});
