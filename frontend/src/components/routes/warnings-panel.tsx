import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { BRAND, Fonts, getPalette, hardShadow } from '@/constants/theme';
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
          { backgroundColor: BRAND.orange, borderColor: BRAND.ink },
        ]}>
        <View style={styles.warningTitleGroup}>
          <Ionicons name="warning" size={22} color={BRAND.ink} />
          <Text style={[styles.warningHeaderText, { color: BRAND.ink }]}>
            Sensory Warnings [{warnings.length}]
          </Text>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={BRAND.ink}
        />
      </TouchableOpacity>

      {expanded && (
        <View
          style={[
            styles.warningDropdown,
            { backgroundColor: palette.surface, borderColor: BRAND.ink },
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
    borderWidth: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    ...hardShadow(4),
  },
  warningTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  warningHeaderText: {
    fontSize: 14,
    fontFamily: Fonts?.display,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  warningDropdown: {
    marginTop: 8,
    borderRadius: 14,
    borderWidth: 2,
    padding: 14,
    ...hardShadow(4),
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
