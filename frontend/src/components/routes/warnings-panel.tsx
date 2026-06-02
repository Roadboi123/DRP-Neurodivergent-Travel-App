import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { getPalette } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { WarningItem } from '@/types/route';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const SEVERITY_COLORS: Record<WarningItem['severity'], string> = {
  high: '#FF4D4D',
  medium: '#FF944D',
  info: '#4DA6FF',
};

// Default mock warnings shown above the route list.
const DEFAULT_WARNINGS: WarningItem[] = [
  {
    id: 'w1',
    title: 'District Line Delays',
    desc: 'Moderate delays are causing platform crowding at South Kensington.',
    severity: 'medium',
    icon: 'alert-circle',
  },
  {
    id: 'w2',
    title: 'High Vehicle Heat Reports',
    desc: 'Bus 170 and Central Line are running 4°C above normal temperatures.',
    severity: 'high',
    icon: 'thermometer',
  },
  {
    id: 'w3',
    title: 'Entrance Drilling Noise',
    desc: 'Heavy street construction near Gloucester Road station (90dB+).',
    severity: 'info',
    icon: 'volume-high',
  },
];

export function WarningsPanel({ warnings = DEFAULT_WARNINGS }: { warnings?: WarningItem[] }) {
  const isDark = useColorScheme() === 'dark';
  const palette = getPalette(isDark);
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.warningContainer}>
      <TouchableOpacity
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.85}
        style={[
          styles.warningHeader,
          { backgroundColor: isDark ? '#2D221C' : '#FFF5F0', borderColor: '#FF7F50' },
        ]}>
        <View style={styles.warningTitleGroup}>
          <Ionicons name="warning" size={22} color="#FF7F50" />
          <Text style={[styles.warningHeaderText, { color: isDark ? '#FF9E79' : '#D04E1F' }]}>
            Sensory Warnings [{warnings.length}]
          </Text>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={isDark ? '#FF9E79' : '#D04E1F'}
        />
      </TouchableOpacity>

      {expanded && (
        <View
          style={[
            styles.warningDropdown,
            { backgroundColor: palette.surface, borderColor: isDark ? '#2E3543' : '#F0EEED' },
          ]}>
          {warnings.map((w, index) => (
            <View key={w.id}>
              <View style={styles.warningItemRow}>
                <View style={[styles.warningBullet, { backgroundColor: SEVERITY_COLORS[w.severity] }]}>
                  <Ionicons name={w.icon as IoniconName} size={14} color="#FFF" />
                </View>
                <View style={styles.warningItemText}>
                  <Text style={[styles.warningItemTitle, { color: palette.textPrimary }]}>
                    {w.title}
                  </Text>
                  <Text style={[styles.warningItemDesc, { color: palette.textSecondary }]}>
                    {w.desc}
                  </Text>
                </View>
              </View>
              {index < warnings.length - 1 && (
                <View
                  style={[
                    styles.warningSeparator,
                    { backgroundColor: isDark ? '#2E3543' : '#F0EEED' },
                  ]}
                />
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  warningContainer: {
    marginVertical: 10,
  },
  warningHeader: {
    borderRadius: 14,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  warningTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  warningHeaderText: {
    fontSize: 14,
    fontWeight: '700',
  },
  warningDropdown: {
    marginTop: 6,
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 14,
  },
  warningItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  warningBullet: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningItemText: {
    flex: 1,
  },
  warningItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  warningItemDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  warningSeparator: {
    height: 1,
    marginVertical: 10,
  },
});
