import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { BRAND, Fonts, getAccents, getPalette, hardShadow, type Accents } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { WarningItem } from '@/types/route';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

/** Maps severity to a background fill from the accent ramp. */
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

  // Expanded by default; the header chevron lets the user minimise the list.
  const [expanded, setExpanded] = useState(true);

  if (!warnings || warnings.length === 0) {
    return null;
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: accents.orange, borderColor: palette.border },
      ]}
    >
      {/* Header — tap to collapse/expand the list */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => setExpanded((prev) => !prev)}
        style={styles.header}
        accessibilityRole="button"
        accessibilityLabel={expanded ? 'Minimise sensory warnings' : 'Show sensory warnings'}
      >
        <Ionicons name="warning" size={22} color={palette.textPrimary} />
        <Text style={[styles.headerText, { color: palette.textPrimary }]}>
          Sensory Warnings [{warnings.length}]
        </Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={palette.textPrimary}
          style={styles.headerChevron}
        />
      </TouchableOpacity>

      {expanded && (
        <>
      {/* Divider between header and list */}
      <View style={[styles.headerDivider, { backgroundColor: palette.border }]} />

      {/* Warning items */}
      <View style={[styles.itemsBox, { backgroundColor: palette.surface, borderColor: palette.border }]}>
        {warnings.map((w, index) => (
          <View key={w.id}>
            <View style={styles.itemRow}>
              <View
                style={[
                  styles.bullet,
                  { backgroundColor: severityColor(w.severity, accents), borderColor: palette.border },
                ]}
              >
                <Ionicons name={w.icon as IoniconName} size={14} color={BRAND.ink} />
              </View>
              <View style={styles.itemText}>
                <Text style={[styles.itemTitle, { color: palette.textPrimary }]}>
                  {w.title}
                </Text>
                <Text style={[styles.itemDesc, { color: palette.textSecondary }]}>
                  {w.desc}
                </Text>
              </View>
            </View>
            {index < warnings.length - 1 && (
              <View style={[styles.separator, { backgroundColor: palette.divider }]} />
            )}
          </View>
        ))}
      </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 10,
    borderRadius: 14,
    borderWidth: 2,
    overflow: 'hidden',
    ...hardShadow(4),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  headerText: {
    fontSize: 14,
    fontFamily: Fonts?.display,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  headerChevron: {
    marginLeft: 'auto',
  },
  headerDivider: {
    height: 2,
  },
  itemsBox: {
    padding: 14,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bullet: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  itemDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
  separator: {
    height: 1,
    marginVertical: 10,
  },
});
