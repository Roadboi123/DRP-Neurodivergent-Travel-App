import { StyleSheet, Text, View } from 'react-native';

import { getPalette } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { SensoryLevel } from '@/types/route';

// 1 = Low (Green), 2 = Moderate (Amber), 3 = High (Orange), 4 = Extreme (Red).
const LEVEL_COLORS: Record<SensoryLevel, string> = {
  1: '#4CAF50',
  2: '#FFC107',
  3: '#FF9800',
  4: '#F44336',
};

const THRESHOLDS: SensoryLevel[] = [1, 2, 3, 4];

export function SensoryMeter({ level, label }: { level: SensoryLevel; label: string }) {
  const isDark = useColorScheme() === 'dark';
  const palette = getPalette(isDark);
  const emptyColor = isDark ? '#333' : '#E5E7EB';

  return (
    <View style={styles.meterContainer}>
      <Text style={[styles.meterLabel, { color: palette.textSecondary }]}>{label}</Text>
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
    fontSize: 10.5,
    fontWeight: '700',
    marginBottom: 4,
  },
  meterBlocks: {
    flexDirection: 'row',
    gap: 2,
  },
  meterBlock: {
    width: 12,
    height: 6,
    borderRadius: 2,
  },
});
