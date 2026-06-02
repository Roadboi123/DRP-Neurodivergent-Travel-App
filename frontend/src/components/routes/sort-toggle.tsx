import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { getPalette } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export type SortMode = 'speed' | 'sensory';

const OPTIONS: { value: SortMode; label: string }[] = [
  { value: 'speed', label: 'Speed' },
  { value: 'sensory', label: 'Sensory' },
];

export function SortToggle({
  sortBy,
  onChange,
}: {
  sortBy: SortMode;
  onChange: (mode: SortMode) => void;
}) {
  const isDark = useColorScheme() === 'dark';
  const palette = getPalette(isDark);

  return (
    <View style={[styles.sortContainer, { backgroundColor: isDark ? '#1E2229' : '#EAEAEA' }]}>
      {OPTIONS.map(({ value, label }) => {
        const active = sortBy === value;
        return (
          <TouchableOpacity
            key={value}
            onPress={() => onChange(value)}
            style={[styles.sortButton, active && { backgroundColor: isDark ? '#2E3543' : '#FFFFFF' }]}>
            <Text
              style={[
                styles.sortText,
                { color: palette.textPrimary, fontWeight: active ? '700' : '400' },
              ]}>
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  sortContainer: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 3,
  },
  sortButton: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  sortText: {
    fontSize: 12,
  },
});
