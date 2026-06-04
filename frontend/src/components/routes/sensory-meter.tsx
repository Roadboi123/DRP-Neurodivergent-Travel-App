import { StyleSheet, Text, View } from 'react-native';

import { BRAND, Fonts, getPalette } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { SensoryLevel } from '@/types/route';

// Wero ramp: 1 = Low (green), 2 = Moderate (yellow), 3 = High (orange), 4 = Extreme (pink).
const LEVEL_COLORS: Record<SensoryLevel, string> = {
  1: BRAND.green,
  2: BRAND.yellow,
  3: BRAND.orange,
  4: BRAND.pink,
};

const THRESHOLDS: SensoryLevel[] = [1, 2, 3, 4];

export function SensoryMeter({ level, label }: { level: SensoryLevel; label: string }) {
  const isDark = useColorScheme() === 'dark';
  const palette = getPalette(isDark);
  const emptyColor = BRAND.white;

  return (
    <View style={styles.meterContainer}>
      <Text style={[styles.meterLabel, { color: palette.textPrimary }]}>{label}</Text>
      <View style={styles.meterBlocks}>
        {THRESHOLDS.map((threshold) => (
          <View
            key={threshold}
            style={[
              styles.meterBlock,
              { backgroundColor: level >= threshold ? LEVEL_COLORS[threshold] : emptyColor },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  meterContainer: {
    flex: 1,
    alignItems: 'center',
  },
  meterLabel: {
    fontSize: 10,
    fontFamily: Fonts?.display,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
    marginBottom: 5,
  },
  meterBlocks: {
    flexDirection: 'row',
    gap: 2,
  },
  meterBlock: {
    width: 12,
    height: 8,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: BRAND.ink,
  },
});
