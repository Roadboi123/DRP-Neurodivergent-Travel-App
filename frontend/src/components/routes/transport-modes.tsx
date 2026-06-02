import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { getPalette } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function TransportModes({
  walkSelected,
  onToggleWalk,
}: {
  walkSelected: boolean;
  onToggleWalk: () => void;
}) {
  const isDark = useColorScheme() === 'dark';
  const palette = getPalette(isDark);

  return (
    <View style={styles.modeSummaryRow}>
      <TouchableOpacity
        onPress={onToggleWalk}
        style={[
          styles.modeCard,
          {
            backgroundColor: palette.surface,
            borderColor: walkSelected ? '#4A90E2' : palette.border,
          },
        ]}>
        <View style={styles.modeIconRow}>
          <Ionicons name="walk" size={20} color="#4CAF50" />
          <Text style={[styles.modeLabel, { color: isDark ? '#FFF' : '#333' }]}>Walk</Text>
        </View>
        <Text style={[styles.modeValue, { color: palette.textSecondary }]}>41 min</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.modeCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <View style={styles.modeIconRow}>
          <Ionicons name="bicycle" size={20} color="#2196F3" />
          <Text style={[styles.modeLabel, { color: isDark ? '#FFF' : '#333' }]}>Cycle</Text>
        </View>
        <Text style={[styles.modeValue, { color: palette.textSecondary }]}>16 min</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.modeCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <View style={styles.modeIconRow}>
          <Ionicons name="flash" size={18} color="#FFEB3B" />
          <Text style={[styles.modeLabel, { color: isDark ? '#FFF' : '#333' }]}>Scooter</Text>
        </View>
        <Text style={[styles.modeValue, { color: palette.textSecondary }]}>31 min</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.modeCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        <View style={styles.modeIconRow}>
          <Ionicons name="car-sport" size={18} color="#E04F5F" />
          <Text style={[styles.modeLabel, { color: isDark ? '#FFF' : '#333' }]}>Taxi</Text>
        </View>
        <Text style={[styles.modeValue, { color: palette.textSecondary }]}>23 min</Text>
        <Text style={styles.taxiPrice}>~£14</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  modeSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 12,
    gap: 8,
  },
  modeCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 10,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  modeIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  modeLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  modeValue: {
    fontSize: 12,
    fontWeight: '700',
  },
  taxiPrice: {
    fontSize: 10,
    color: '#E04F5F',
    fontWeight: '800',
    marginTop: 2,
  },
});
