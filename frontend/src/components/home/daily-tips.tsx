import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { getPalette } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function DailyTips() {
  const isDark = useColorScheme() === 'dark';
  const palette = getPalette(isDark);
  const tipColor = isDark ? '#FFF' : '#333';

  return (
    <View style={[styles.tipsContainer, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <View style={styles.tipRow}>
        <Ionicons name="sunny" size={20} color="#FF9800" />
        <Text style={[styles.tipText, { color: tipColor }]}>
          Central Line temperature is deep and elevated at 32°C. Taking the District Line is recommended.
        </Text>
      </View>
      <View style={[styles.tipDivider, { backgroundColor: palette.divider }]} />
      <View style={styles.tipRow}>
        <Ionicons name="volume-high" size={20} color="#4A90E2" />
        <Text style={[styles.tipText, { color: tipColor }]}>
          Active drilling near Gloucester Road entrance. Scent/sound isolation headphones advised.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tipsContainer: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 16,
    gap: 12,
  },
  tipRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  tipText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 17,
  },
  tipDivider: {
    height: 1,
  },
});
