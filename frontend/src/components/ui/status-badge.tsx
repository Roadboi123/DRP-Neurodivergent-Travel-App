import { StyleSheet, Text, View } from 'react-native';

import { Fonts, getAccents, getPalette, hardShadow } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export type BackendStatus = 'Online' | 'Offline' | 'Checking';

export function StatusBadge({ status }: { status: BackendStatus }) {
  const isDark = useColorScheme() === 'dark';
  const palette = getPalette(isDark);
  const accents = getAccents(isDark);
  const online = status === 'Online';

  return (
    <View
      style={[
        styles.statusBadge,
        { backgroundColor: online ? accents.green : accents.pinkSoft, borderColor: palette.border },
      ]}>
      <View style={[styles.statusDot, { backgroundColor: palette.textPrimary }]} />
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
    borderRadius: 30,
    gap: 6,
    borderWidth: 2,
    ...hardShadow(3),
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
    fontFamily: Fonts?.display,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
});
