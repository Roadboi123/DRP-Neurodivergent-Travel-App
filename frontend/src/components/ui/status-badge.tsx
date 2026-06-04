import { StyleSheet, Text, View } from 'react-native';

import { BRAND, Fonts, hardShadow } from '@/constants/theme';

export type BackendStatus = 'Online' | 'Offline' | 'Checking';

export function StatusBadge({ status }: { status: BackendStatus }) {
  const online = status === 'Online';

  return (
    <View style={[styles.statusBadge, { backgroundColor: online ? BRAND.green : BRAND.pinkSoft }]}>
      <View style={styles.statusDot} />
      <Text style={styles.statusText}>API: {status}</Text>
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
    borderColor: BRAND.ink,
    ...hardShadow(3),
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: BRAND.ink,
  },
  statusText: {
    fontSize: 11,
    fontFamily: Fonts?.display,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    color: BRAND.ink,
  },
});
