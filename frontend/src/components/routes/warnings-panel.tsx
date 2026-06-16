import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { confidenceColor, isAggregatedReport, WarningConfidence } from '@/components/routes/warning-confidence';
import { CLEARWAY, Fonts, getAccents, getPalette, Radii, softShadow } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { WarningItem } from '@/types/route';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

// Auto heat/overheating disruption cards are unavoidable on non-A/C buses and
// deep tubes, so they're noise rather than actionable — drop them (the per-leg
// heat score and user-submitted heat reports are unaffected).
const HEAT_RE = /heat|overheat|temperatur|thermo|swelter/i;
// TfL line-delay disruptions, collapsed into a single "Line Delays" card.
const DELAY_RE = /\bdelays?\b/i;
const sevRank = (s: WarningItem['severity']): number =>
  s === 'high' ? 2 : s === 'medium' ? 1 : 0;

/**
 * Shape the raw warnings for the routes-list panel:
 *  - keep every live (TfL) disruption, but only *high-confidence* user reports;
 *  - drop auto heat/overheating cards (see `HEAT_RE`);
 *  - collapse every TfL line-delay card into one consolidated "Line Delays"
 *    warning (strongest severity wins) so a disruption reads as a single card.
 */
function consolidateWarnings(warnings: WarningItem[]): WarningItem[] {
  const kept = warnings.filter((w) => {
    if (isAggregatedReport(w)) return w.severity === 'high';
    return !HEAT_RE.test(`${w.title} ${w.desc} ${w.icon}`);
  });

  let delayCard: WarningItem | null = null;
  const out: WarningItem[] = [];
  for (const w of kept) {
    const isDelay = !isAggregatedReport(w) && DELAY_RE.test(w.title);
    if (isDelay) {
      if (!delayCard) {
        delayCard = { ...w };
        out.push(delayCard);
      } else {
        // A second+ delayed line: merge into one generic card, strongest severity.
        if (sevRank(w.severity) > sevRank(delayCard.severity)) {
          delayCard.severity = w.severity;
        }
        delayCard.title = 'Line Delays';
        delayCard.desc = 'Multiple lines are experiencing delays.';
      }
      continue;
    }
    out.push(w);
  }
  return out;
}

export function WarningsPanel({ warnings = [] }: { warnings?: WarningItem[] }) {
  const isDark = useColorScheme() === 'dark';
  const palette = getPalette(isDark);
  const accents = getAccents(isDark);

  // Expanded by default; the header chevron lets the user minimise the list.
  const [expanded, setExpanded] = useState(true);

  const filteredWarnings = consolidateWarnings(warnings);

  if (!filteredWarnings || filteredWarnings.length === 0) {
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
          Sensory Warnings [{filteredWarnings.length}]
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
        {filteredWarnings.map((w, index) => (
          <View key={w.id}>
            <View style={styles.itemRow}>
              <View
                style={[
                  styles.bullet,
                  { backgroundColor: confidenceColor(w.severity, accents), borderColor: palette.border },
                ]}
              >
                <Ionicons name={w.icon as IoniconName} size={14} color={CLEARWAY.white} />
              </View>
              <View style={styles.itemText}>
                <Text style={[styles.itemTitle, { color: palette.textPrimary }]}>
                  {w.title}
                </Text>
                <Text style={[styles.itemDesc, { color: palette.textSecondary }]}>
                  {w.desc}
                </Text>
                <WarningConfidence warning={w} compact />
              </View>
            </View>
            {index < filteredWarnings.length - 1 && (
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
    borderRadius: Radii.card,
    borderWidth: 1,
    overflow: 'hidden',
    ...softShadow(2),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  headerText: {
    fontSize: 15,
    fontFamily: Fonts?.display,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  headerChevron: {
    marginLeft: 'auto',
  },
  headerDivider: {
    height: 1,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemText: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 13.5,
    fontFamily: Fonts?.semibold,
    fontWeight: '700',
    marginBottom: 2,
  },
  itemDesc: {
    fontSize: 12.5,
    fontFamily: Fonts?.body,
    lineHeight: 17,
  },
  separator: {
    height: 1,
    marginVertical: 10,
  },
});
