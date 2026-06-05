import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { BRAND, Fonts, getAccents, getPalette, hardShadow, type Accents } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { WarningItem } from '@/types/route';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

/** Wero severity fills (ink icon sits on the bright accent, per the design system). */
function severityColor(severity: WarningItem['severity'], accents: Accents): string {
  if (severity === 'high') {
    return accents.pink;
  }
  if (severity === 'medium') {
    return accents.orange;
  }
  return accents.cyan;
}

export function WarningsPanel({ warnings = [] }: { warnings?: WarningItem[] }) {
  const isDark = useColorScheme() === 'dark';
  const palette = getPalette(isDark);
  const accents = getAccents(isDark);
  const [expanded, setExpanded] = useState(false);

  if (!warnings || warnings.length === 0) {
    return null;
  }

  return (
    <View style={styles.warningContainer}>
      <TouchableOpacity
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.85}
        style={[
          styles.warningHeader,
          { backgroundColor: accents.orange, borderColor: palette.border },
        ]}>
        <View style={styles.warningTitleGroup}>
          <Ionicons name="warning" size={22} color={palette.textPrimary} />
          <Text style={[styles.warningHeaderText, { color: palette.textPrimary }]}>
            Sensory Warnings [{warnings.length}]
          </Text>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={palette.textPrimary}
        />
      </TouchableOpacity>

      {expanded && (
        <View
          style={[
            styles.warningDropdown,
            { backgroundColor: palette.surface, borderColor: palette.border },
          ]}>
          {warnings.map((w, index) => (
            <View key={w.id}>
              <View style={styles.warningItemRow}>
                <View style={[styles.warningBullet, { backgroundColor: severityColor(w.severity, accents), borderColor: palette.border }]}>
                  <Ionicons name={w.icon as IoniconName} size={14} color={BRAND.ink} />
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
                    { backgroundColor: palette.divider },
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
    borderWidth: 1.5,
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
