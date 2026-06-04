import { StyleSheet, Text, View } from 'react-native';

import { Fonts, getAccents, getPalette, type Accents } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { SensoryLevel } from '@/types/route';

// Wero ramp: 1 = Low (green), 2 = Moderate (yellow), 3 = High (orange), 4 = Extreme (pink).
// Read from the scheme-aware accents so the blocks mute in the calm dark theme.
const levelColor = (accents: Accents, level: SensoryLevel): string =>
  ({ 1: accents.green, 2: accents.yellow, 3: accents.orange, 4: accents.pink })[level];

export function SensoryMeter({ level, label }: { level: SensoryLevel; label: string }) {
  const isDark = useColorScheme() === 'dark';
  const palette = getPalette(isDark);
  const accents = getAccents(isDark);

  // Collapse the old four-block ramp into a single block painted the stimulus's
  // own level colour — the "max" it reaches — so the row stays legible at phone width.
  return (
    <View style={styles.meterContainer}>
      <Text style={[styles.meterLabel, { color: palette.textPrimary }]} numberOfLines={1}>
        {label}
      </Text>
      <View
        style={[
          styles.meterBlock,
          { backgroundColor: levelColor(accents, level), borderColor: palette.border },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  meterContainer: {
    flex: 1,
    alignItems: 'center',
  },
  meterLabel: {
    fontSize: 9,
    fontFamily: Fonts?.display,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0,
    marginBottom: 5,
  },
  meterBlock: {
    alignSelf: 'stretch',
    marginHorizontal: 2,
    height: 10,
    borderRadius: 3,
    borderWidth: 1,
  },
});
