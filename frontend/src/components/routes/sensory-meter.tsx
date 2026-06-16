import { StyleSheet, Text, View } from 'react-native';

import { CLEARWAY, Fonts, getPalette } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { SensoryLevel } from '@/types/route';

// Clearway softened ramp: 1 = Low (green), 2 = Moderate (amber), 3 = High
// (orange), 4 = Extreme (coral). Functional green→red scale, calmer tones.
const levelColor = (level: SensoryLevel): string =>
  ({ 1: CLEARWAY.good, 2: '#d3a83c', 3: '#d9844e', 4: CLEARWAY.bad })[level];

export function SensoryMeter({ level, label }: { level: SensoryLevel; label: string }) {
  const isDark = useColorScheme() === 'dark';
  const palette = getPalette(isDark);

  // Collapse the old four-block ramp into a single rounded bar painted the
  // stimulus's own level colour — the "max" it reaches — so the row stays
  // legible at phone width.
  return (
    <View style={styles.meterContainer}>
      <Text style={[styles.meterLabel, { color: palette.textSecondary }]} numberOfLines={1}>
        {label}
      </Text>
      <View style={[styles.meterBlock, { backgroundColor: levelColor(level) }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  meterContainer: {
    flex: 1,
    alignItems: 'center',
  },
  meterLabel: {
    fontSize: 9.5,
    fontFamily: Fonts?.semibold,
    fontWeight: '700',
    letterSpacing: 0,
    marginBottom: 5,
  },
  meterBlock: {
    alignSelf: 'stretch',
    marginHorizontal: 2,
    height: 8,
    borderRadius: 999,
  },
});
