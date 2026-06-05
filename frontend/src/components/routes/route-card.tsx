import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { SensoryMeter } from '@/components/routes/sensory-meter';
import {
  BRAND,
  Fonts,
  getAccents,
  getPalette,
  hardShadow,
  type Accents,
  type ThemePalette,
} from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { RouteOption } from '@/types/route';

/** Group heading + accent colors derived from a route's classification. */
function getGroupStyling(type: RouteOption['type'], isDark: boolean) {
  if (type === 'best') {
    return {
      title: 'Best by preference',
      badgeColor: isDark ? '#1C3224' : '#E8F5E9',
      badgeTextColor: isDark ? '#66BB6A' : '#2E7D32',
    };
  }
  if (type === 'quickest') {
    return {
      title: 'Quickest',
      badgeColor: isDark ? '#351C1C' : '#FFEBEE',
      badgeTextColor: isDark ? '#EF5350' : '#C62828',
    };
  }
  return {
    title: 'Suggested',
    badgeColor: isDark ? '#2E3543' : '#F0F0EE',
    badgeTextColor: isDark ? '#CCC' : '#666',
  };
}

// Wero "word-bg" highlight: scheme-aware fill with on-surface text + a palette border.
function matchBadgeColors(
  matchPercentage: number | null | undefined,
  accents: Accents,
  palette: ThemePalette
) {
  const text = palette.textPrimary;
  if (matchPercentage == null) {
    return { bg: palette.surface, text };
  }
  if (matchPercentage >= 80) {
    return { bg: accents.green, text };
  }
  if (matchPercentage >= 50) {
    return { bg: accents.yellow, text };
  }
  return { bg: accents.pinkSoft, text };
}

export function getLegUIProps(
  mode: string,
  line: string,
  instruction: string,
  accents: Accents
) {
  const modeLower = mode.toLowerCase();
  const lineLower = line ? line.toLowerCase() : '';
  
  let iconName: any = 'walk';
  let bgColor: string = accents.cyan;
  let textColor: string = BRAND.ink;
  let displayName = 'Walk';

  const isBusLike =
    modeLower === 'bus' ||
    modeLower === 'coach' ||
    modeLower === 'national-coach' ||
    modeLower === 'replacement-bus';

  if (isBusLike) {
    iconName = 'bus';
    bgColor = accents.orange;
    textColor = BRAND.ink;
    displayName = line
      ? `Bus ${line}`
      : instruction
      ? instruction.split(' towards ')[0].replace('Take the ', '').replace('Board the ', '')
      : 'Bus';
  } else if (
    modeLower === 'tube' ||
    modeLower === 'subway' ||
    modeLower === 'underground' ||
    modeLower.includes('elizabeth')
  ) {
    iconName = 'subway';
    displayName = line || 'Elizabeth line';
    
    if (lineLower.includes('central')) {
      bgColor = '#E32017';
      textColor = '#FFF';
    } else if (lineLower.includes('district')) {
      bgColor = '#00782A';
      textColor = '#FFF';
    } else if (lineLower.includes('northern')) {
      bgColor = '#000000';
      textColor = '#FFF';
    } else if (lineLower.includes('victoria')) {
      bgColor = '#00A0E2';
      textColor = '#FFF';
    } else if (lineLower.includes('jubilee')) {
      bgColor = '#868F98';
      textColor = '#FFF';
    } else if (lineLower.includes('piccadilly')) {
      bgColor = '#003688';
      textColor = '#FFF';
    } else if (lineLower.includes('bakerloo')) {
      bgColor = '#894E24';
      textColor = '#FFF';
    } else if (lineLower.includes('circle')) {
      bgColor = '#FFD300';
      textColor = '#000';
    } else if (lineLower.includes('hammersmith') || lineLower.includes('city')) {
      bgColor = '#F3A9C8';
      textColor = '#000';
    } else if (lineLower.includes('metropolitan')) {
      bgColor = '#9B005A';
      textColor = '#FFF';
    } else if (lineLower.includes('elizabeth')) {
      bgColor = '#7156A5';
      textColor = '#FFF';
    } else if (lineLower.includes('overground')) {
      bgColor = '#E86300';
      textColor = '#FFF';
    } else if (lineLower.includes('dlr')) {
      bgColor = '#00AFAD';
      textColor = '#FFF';
    } else {
      bgColor = '#0D47A1';
      textColor = '#FFF';
    }
  } else if (modeLower === 'train' || modeLower === 'national-rail') {
    iconName = 'train';
    displayName = line || 'Train';
    bgColor = accents.green;
    textColor = BRAND.ink;
  }

  return { iconName, bgColor, textColor, displayName };
}

function RouteCardBase({
  route,
  customTitle,
  hideTitle,
  onPress,
}: {
  route: RouteOption;
  customTitle?: string;
  hideTitle?: boolean;
  onPress?: () => void;
}) {
  const isDark = useColorScheme() === 'dark';
  const palette = getPalette(isDark);
  const accents = getAccents(isDark);
  const group = getGroupStyling(route.type, isDark);
  const matchColors = matchBadgeColors(route.match_percentage, accents, palette);

  return (
    <View style={styles.routeGroupWrapper}>
      {!hideTitle && (
        <Text style={[styles.groupHeaderLabel, { color: palette.textPrimary }]}>
          {customTitle || group.title}
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
        
        {/* Left column: journey timeline + sensory dashboard */}
        <View style={styles.leftContent}>
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
                          color={isDark ? '#555' : '#BBB'}
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

                {/* Match Rating Pill at the end of the timeline */}
                <View
                  style={[
                    styles.matchBadge,
                    { backgroundColor: matchColors.bg, borderColor: palette.border },
                  ]}>
                  <Text style={[styles.matchBadgeText, { color: matchColors.text }]}>
                    {route.match_percentage ?? 100}% Match
                  </Text>
                </View>
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
          
          {/* Action indicator at the bottom (Neo-brutalist hint) */}
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: -2 }}>
            <Text style={{ fontSize: 10.5, fontWeight: '800', fontFamily: Fonts?.display, textTransform: 'uppercase', color: palette.textMuted }}>
              Tap to view details & map
            </Text>
            <Ionicons
              name="arrow-forward"
              size={11}
              color={palette.textMuted}
              style={{ marginLeft: 4 }}
            />
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
  routeCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 14,
    borderWidth: 2,
    padding: 14,
    ...hardShadow(6),
  },
  leftContent: {
    flex: 1,
    marginRight: 12,
    gap: 10,
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
    paddingTop: 10,
    columnGap: 3,
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  matchBadge: {
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  matchBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
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
