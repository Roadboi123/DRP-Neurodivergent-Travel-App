import { StyleSheet, Text, View } from 'react-native';

export type BackendStatus = 'Online' | 'Offline' | 'Checking';

export function StatusBadge({ status }: { status: BackendStatus }) {
  const online = status === 'Online';

  return (
    <View style={[styles.statusBadge, { backgroundColor: online ? '#E8F5E9' : '#FFEBEE' }]}>
      <View style={[styles.statusDot, { backgroundColor: online ? '#4CAF50' : '#F44336' }]} />
      <Text style={[styles.statusText, { color: online ? '#2E7D32' : '#C62828' }]}>
        API: {status}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
