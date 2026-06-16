import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { CLEARWAY, Fonts, getAccents, getPalette, Radii, type Accents } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { WarningItem } from '@/types/route';

// For aggregated user reports, severity encodes how many (and how trusted the)
// travellers flagged the spot — we surface that as a plain-language confidence.
const CONFIDENCE_LABEL: Record<WarningItem['severity'], string> = {
  high: 'High',
  medium: 'Medium',
  info: 'Low',
};

/** Severity → solid fill (white-text readable), shared so warning surfaces agree. */
export function confidenceColor(severity: WarningItem['severity'], _accents?: Accents): string {
  if (severity === 'high') {
    return CLEARWAY.bad;
  }
  if (severity === 'medium') {
    return '#c98a2a';
  }
  return CLEARWAY.blue;
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
            { backgroundColor: confidenceColor(warning.severity, accents) },
          ]}
        >
          <Text style={[styles.pillTextCompact, { color: CLEARWAY.white }]}>{label}</Text>
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
          { backgroundColor: confidenceColor(warning.severity, accents) },
        ]}
      >
        <Text style={[styles.pillText, { color: CLEARWAY.white }]}>{label} confidence</Text>
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
    paddingVertical: 5,
    borderRadius: Radii.pill,
  },
  pillText: {
    fontSize: 11,
    fontFamily: Fonts?.semibold,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  count: {
    fontSize: 12,
    fontFamily: Fonts?.body,
    fontWeight: '600',
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  pillCompact: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: Radii.pill,
  },
  pillTextCompact: {
    fontSize: 9.5,
    fontFamily: Fonts?.semibold,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  countCompact: {
    fontSize: 11,
    fontFamily: Fonts?.body,
    fontWeight: '600',
  },
});
