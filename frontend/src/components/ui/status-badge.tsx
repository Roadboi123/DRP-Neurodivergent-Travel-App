import { StyleSheet, Text, View } from 'react-native';

import { CLEARWAY, Fonts, getPalette, Radii, softShadow } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export type BackendStatus = 'Online' | 'Offline' | 'Checking';

export function StatusBadge({ status }: { status: BackendStatus }) {
  const isDark = useColorScheme() === 'dark';
  const palette = getPalette(isDark);
  const online = status === 'Online';

  return (
    <View
      style={[
        styles.statusBadge,
        { backgroundColor: palette.surface, borderColor: palette.border },
      ]}>
      <View style={[styles.statusDot, { backgroundColor: online ? CLEARWAY.good : CLEARWAY.bad }]} />
      <Text style={[styles.statusText, { color: palette.textPrimary }]}>API: {status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: Radii.pill,
    gap: 6,
    borderWidth: 1,
    ...softShadow(1),
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11.5,
    fontFamily: Fonts?.semibold,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
});
