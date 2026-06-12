import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Fonts, getAccents, getPalette, type Accents } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { WarningItem } from '@/types/route';

// For aggregated user reports, severity encodes how many (and how trusted the)
// travellers flagged the spot — we surface that as a plain-language confidence.
const CONFIDENCE_LABEL: Record<WarningItem['severity'], string> = {
  high: 'High',
  medium: 'Medium',
  info: 'Low',
};

/** Severity → accent fill, shared so every warning surface agrees on colour. */
export function confidenceColor(severity: WarningItem['severity'], accents: Accents): string {
  if (severity === 'high') {
    return accents.pink;
  }
  if (severity === 'medium') {
    return accents.orange;
  }
  return accents.cyan;
}

/**
 * True only for aggregated user-reported warnings (they carry a reporter and a
 * report count). Live TfL/weather warnings have no confidence to show.
 */
export function isAggregatedReport(w: WarningItem): boolean {
  return w.username != null && w.report_count != null;
}

/**
 * Confidence indicator for a user-reported warning: a severity-coloured pill
 * ("High / Medium / Low confidence") plus how many travellers reported it.
 * Renders nothing for live (non-reported) warnings. `compact` is the inline
 * variant used in the warnings list; the default is the centred card variant.
 */
export function WarningConfidence({
  warning,
  compact = false,
}: {
  warning: WarningItem;
  compact?: boolean;
}) {
  const isDark = useColorScheme() === 'dark';
  const palette = getPalette(isDark);
  const accents = getAccents(isDark);

  if (!isAggregatedReport(warning)) {
    return null;
  }

  const label = CONFIDENCE_LABEL[warning.severity];
  const count = warning.report_count ?? 1;
  const countText = `${count} ${count === 1 ? 'traveller' : 'travellers'}`;

  if (compact) {
    return (
      <View style={styles.compactRow}>
        <View
          style={[
            styles.pillCompact,
            { backgroundColor: confidenceColor(warning.severity, accents), borderColor: palette.border },
          ]}
        >
          <Text style={[styles.pillTextCompact, { color: palette.textPrimary }]}>{label}</Text>
        </View>
        <Text style={[styles.countCompact, { color: palette.textMuted }]}>
          {countText}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.cardWrap}>
      <View
        style={[
          styles.pill,
          { backgroundColor: confidenceColor(warning.severity, accents), borderColor: palette.border },
        ]}
      >
        <Text style={[styles.pillText, { color: palette.textPrimary }]}>{label} confidence</Text>
      </View>
      <Text style={[styles.count, { color: palette.textMuted }]}>
        Reported by {countText}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cardWrap: {
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 30,
    borderWidth: 2,
  },
  pillText: {
    fontSize: 11,
    fontFamily: Fonts?.display,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  count: {
    fontSize: 12,
    fontWeight: '600',
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  pillCompact: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 30,
    borderWidth: 1.5,
  },
  pillTextCompact: {
    fontSize: 9,
    fontFamily: Fonts?.display,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  countCompact: {
    fontSize: 11,
    fontWeight: '600',
  },
});
