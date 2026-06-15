import { StyleSheet, Text, View } from 'react-native';

import { getOptionColors, LEVEL_GLOSS, OPTIONS } from '@/components/preferences/options';
import { Glass } from '@/components/ui/glass';
import { Fonts, getPalette, Radii } from '@/constants/theme';
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
    <Glass radius={Radii.card} shadow={1} style={styles.card}>
      <View style={styles.inner}>
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
    </Glass>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
  },
  inner: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 8,
  },
  heading: {
    fontSize: 12,
    fontFamily: Fonts?.semibold,
    fontWeight: '700',
    letterSpacing: 0.2,
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
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontFamily: Fonts?.body,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  gloss: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 17,
  },
});
