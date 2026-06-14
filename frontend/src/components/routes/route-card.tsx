import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { SensoryMeter } from '@/components/routes/sensory-meter';
import { leaveIndicator, type JourneyTime } from '@/components/routes/journey-time';
import {
  BRAND,
  Fonts,
  getAccents,
  getPalette,
  hardShadow,
  resolveLineColor,
  TFL_LINE_FALLBACK,
  type Accents,
} from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { RouteOption } from '@/types/route';

/** Group heading derived from a route's classification. */
function getGroupTitle(type: RouteOption['type']): string {
  if (type === 'best') {
    return 'Best by preference';
  }
  if (type === 'quickest') {
    return 'Quickest';
  }
  return 'Suggested';
}

/** Title-case a raw mode string for display ("national-rail" → "National Rail"). */
function prettifyMode(mode: string): string {
  return mode
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function getLegUIProps(
  mode: string,
  line: string,
  instruction: string,
  accents: Accents
) {
  const modeLower = mode.toLowerCase();

  // Walking is the only mode that should ever read as "Walk". Every other mode
  // is transit and must keep its line/mode name — mirrors the backend route
  // naming in services/routes.py (line || mode.capitalize()). Falling through
  // to "Walk" was why Overground/DLR legs (e.g. the Mildmay line) showed as a
  // walk on the route card while the details screen read correctly.
  if (modeLower === 'walking' || modeLower === 'walk') {
    return { iconName: 'walk' as any, bgColor: accents.cyan, textColor: BRAND.ink, displayName: 'Walk' };
  }

  const isBusLike =
    modeLower === 'bus' ||
    modeLower === 'coach' ||
    modeLower === 'national-coach' ||
    modeLower === 'replacement-bus';

  if (isBusLike) {
    const displayName = line
      ? `Bus ${line}`
      : instruction
      ? instruction.split(' towards ')[0].replace('Take the ', '').replace('Board the ', '')
      : 'Bus';
    return { iconName: 'bus' as any, bgColor: accents.orange, textColor: BRAND.ink, displayName };
  }

  // Resolve the official transport livery from the line name first, then the
  // mode (so a mode-only "overground"/"dlr" leg still gets the right colour).
  const livery = resolveLineColor(line) ?? resolveLineColor(modeLower) ?? TFL_LINE_FALLBACK;

  const isUnderground =
    modeLower === 'tube' || modeLower === 'subway' || modeLower === 'underground';
  const isElizabeth = modeLower.includes('elizabeth');
  const isOverground = modeLower === 'overground';
  const isDlr = modeLower === 'dlr';
  const isTram = modeLower === 'tram';
  const isTrain = modeLower === 'train' || modeLower === 'national-rail';

  let iconName: any = 'train';
  let displayName: string;

  if (isUnderground || isElizabeth) {
    iconName = 'subway';
    displayName = line || (isElizabeth ? 'Elizabeth line' : 'Underground');
  } else if (isOverground) {
    iconName = 'train';
    displayName = line || 'Overground';
  } else if (isDlr) {
    iconName = 'subway';
    displayName = line || 'DLR';
  } else if (isTram) {
    iconName = 'train';
    displayName = line || 'Tram';
  } else if (isTrain) {
    iconName = 'train';
    displayName = line || 'Train';
  } else {
    // Unknown transit mode: keep it labelled as transit, never as a walk.
    iconName = 'train';
    displayName = line || prettifyMode(mode) || 'Transit';
  }

  return { iconName, bgColor: livery.bg, textColor: livery.text, displayName };
}

function RouteCardBase({
  route,
  customTitle,
  hideTitle,
  journeyTime,
  onPress,
}: {
  route: RouteOption;
  customTitle?: string;
  hideTitle?: boolean;
  journeyTime?: JourneyTime;
  onPress?: () => void;
}) {
  const isDark = useColorScheme() === 'dark';
  const palette = getPalette(isDark);
  const accents = getAccents(isDark);
  const groupTitle = getGroupTitle(route.type);
  const leave = journeyTime ? leaveIndicator(route, journeyTime) : null;

  return (
    <View style={styles.routeGroupWrapper}>
      {!hideTitle && (
        <Text style={[styles.groupHeaderLabel, { color: palette.textPrimary }]}>
          {customTitle || groupTitle}
          {route.sensory_score != null && (
            <Text style={{ fontSize: 11, fontWeight: '400', color: palette.textMuted }}>
              {' '}
              (Sensory Score: {route.sensory_score})
            </Text>
          )}
        </Text>
      )}

      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPress}
        style={[
          styles.routeCard,
          { backgroundColor: palette.surface, borderColor: palette.border },
        ]}>

        {/* Left column: leave-time indicator + journey timeline + sensory dashboard */}
        <View style={styles.leftContent}>
          {leave && (
            <View style={styles.leaveIndicator}>
              <Ionicons name="time-outline" size={11} color={palette.textMuted} />
              <Text
                style={[styles.leaveIndicatorText, { color: palette.textMuted }]}
                numberOfLines={1}>
                {leave.label} {leave.time}
              </Text>
            </View>
          )}
          <View style={styles.timelineWrapper}>
            {route.legs && route.legs.length > 0 && (
              <View style={styles.timelineRow}>
                {route.legs.map((leg, lIdx) => {
                  const { iconName, bgColor: legBadgeColor, textColor: legTextColor, displayName } = getLegUIProps(
                    leg.mode,
                    leg.line,
                    leg.instruction,
                    accents
                  );

                  return (
                    <View key={lIdx} style={styles.timelineItem}>
                      {lIdx > 0 && (
                        <Ionicons
                          name="chevron-forward"
                          size={12}
                          color={palette.textMuted}
                          style={styles.timelineArrow}
                        />
                      )}
                      <View
                        style={[
                          styles.timelineBadge,
                          { backgroundColor: legBadgeColor, borderColor: palette.border },
                        ]}>
                        <Ionicons name={iconName} size={13} color={legTextColor} />
                        <View>
                          <Text style={[styles.timelineBadgeText, { color: legTextColor }]}>
                            {displayName}
                          </Text>
                          {leg.duration_mins > 0 && (
                            <Text style={[styles.timelineDurText, { color: legTextColor }]}>
                              {leg.duration_mins} min
                            </Text>
                          )}
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* Sensory Dashboard - Wrapping Grid layout for 5 distinct meters */}
          <View style={[styles.sensoryRow, { borderTopColor: palette.divider }]}>
            <SensoryMeter level={route.noise} label="Sound" />
            <SensoryMeter level={route.crowds} label="Crowds" />
            <SensoryMeter level={route.heat} label="Heat" />
            <SensoryMeter level={route.light} label="Light" />
            <SensoryMeter level={route.smell} label="Smell" />
          </View>
        </View>

        {/* Right: big duration over tiny cost, full-height boxed widget */}
        <View
          style={[
            styles.statsWidget,
            { backgroundColor: accents.green, borderColor: palette.border },
          ]}>
          <Text style={[styles.statsTime, { color: palette.textPrimary }]}>{route.duration}</Text>
          <Text style={[styles.statsUnit, { color: palette.textPrimary }]}>min</Text>
          <Text style={[styles.statsCost, { color: palette.textPrimary }]}>
            £{route.price.toFixed(2)}
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

// Memoized so re-ranking the list (e.g. Speed↔Preference) reorders already-painted
// cards instead of re-rendering each one (route object refs are stable across a
// re-sort). The legs timeline is a plain wrapping row rather than a horizontal
// ScrollView — that scroll container was repainting a blank white frame on
// react-native-web whenever the list updated.
export const RouteCard = React.memo(RouteCardBase);

const styles = StyleSheet.create({
  routeGroupWrapper: {
    marginBottom: 4,
  },
  groupHeaderLabel: {
    fontSize: 13,
    fontFamily: Fonts?.display,
    fontWeight: '800',
    marginBottom: 8,
    marginLeft: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  leaveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    // Sits inside the card, top-right of the left column — i.e. next to the
    // green stats box. leftContent's marginRight is the trailing gap that keeps
    // the text clear of the box while staying within the card.
    alignSelf: 'flex-end',
  },
  leaveIndicatorText: {
    fontSize: 11,
    fontFamily: Fonts?.display,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  routeCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 14,
    borderWidth: 2,
    padding: 11,
    ...hardShadow(6),
  },
  leftContent: {
    flex: 1,
    marginRight: 12,
    gap: 8,
  },
  timelineWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  transitBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    flexWrap: 'wrap',
    gap: 4,
  },
  transitBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    gap: 5,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  statsWidget: {
    alignSelf: 'stretch',
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 68,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 2,
  },
  statsTime: {
    fontSize: 24,
    fontFamily: Fonts?.display,
    fontWeight: '800',
    lineHeight: 26,
  },
  statsUnit: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: -1,
  },
  statsCost: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 6,
  },
  sensoryRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    borderTopWidth: 1,
    paddingTop: 8,
    columnGap: 3,
    justifyContent: 'space-between',
  },
  sensoryExplanationText: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
    marginBottom: 4,
  },
  timelineContainer: {
    borderTopWidth: 1,
    paddingTop: 10,
    marginTop: 6,
    marginBottom: 10,
  },
  timelineTitle: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  timelineRow: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timelineArrow: {
    marginHorizontal: 1,
  },
  timelineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderRadius: 8,
    gap: 6,
    borderWidth: 1.5,
    ...hardShadow(2),
  },
  timelineBadgeText: {
    fontSize: 10,
    fontFamily: Fonts?.display,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  timelineDurText: {
    fontSize: 8,
    fontFamily: Fonts?.display,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
    marginTop: 1,
  },
  toggleDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
    marginVertical: 4,
  },
  toggleDetailsText: {
    fontSize: 12,
    fontWeight: '700',
  },
  detailsPanel: {
    borderTopWidth: 1,
    paddingTop: 14,
    marginTop: 8,
    marginBottom: 8,
    gap: 12,
  },
  detailStepContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  stepIndicatorCol: {
    alignItems: 'center',
    width: 24,
  },
  stepNode: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  stepLine: {
    width: 2.5,
    flex: 1,
    marginTop: -2,
    marginBottom: -10,
    zIndex: 1,
  },
  stepContentCol: {
    flex: 1,
    gap: 2,
    paddingBottom: 10,
  },
  stationText: {
    fontSize: 13,
    fontWeight: '700',
  },
  instructionText: {
    fontSize: 12,
    fontWeight: '500',
  },
  stopsDropdown: {
    marginTop: 4,
    paddingLeft: 8,
    borderLeftWidth: 1.5,
    borderLeftColor: '#4A90E2',
    gap: 3,
  },
  stopsDropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
  },
  stopsHeader: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  stopsList: {
    gap: 2,
    marginTop: 2,
  },
  stopItemText: {
    fontSize: 11,
    fontWeight: '500',
  },
  waitWarningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
  },
  waitWarningText: {
    fontSize: 11,
    fontWeight: '700',
    flex: 1,
  },
  featuresBadgeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  featureBadgeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  featureBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
});
