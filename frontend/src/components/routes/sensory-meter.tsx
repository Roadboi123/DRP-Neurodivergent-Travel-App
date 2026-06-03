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
    width: '30%',
    minWidth: 80,
    alignItems: 'flex-start',
  },
  meterLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  meterBlocks: {
    flexDirection: 'row',
    gap: 3,
  },
  meterBlock: {
    width: 14,
    height: 7,
    borderRadius: 2,
  },
});
