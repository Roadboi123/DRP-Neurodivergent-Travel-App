import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { SensoryMeter } from '@/components/routes/sensory-meter';
import { Fonts, getPalette } from '@/constants/theme';
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

function matchBadgeColors(matchPercentage: number | null | undefined, isDark: boolean) {
  if (matchPercentage == null) {
    return {
      bg: isDark ? '#2E3543' : '#F0EEED',
      text: isDark ? '#CCC' : '#666',
    };
  }
  if (matchPercentage >= 80) {
    return {
      bg: isDark ? '#1C3224' : '#E8F5E9',
      text: isDark ? '#81C784' : '#2E7D32',
    };
  }
  if (matchPercentage >= 50) {
    return {
      bg: isDark ? '#3E2F1F' : '#FFF3E0',
      text: isDark ? '#FFB74D' : '#E65100',
    };
  }
  return {
    bg: isDark ? '#351C1C' : '#FFEBEE',
    text: isDark ? '#E57373' : '#C62828',
  };
}

export function RouteCard({
  route,
  customTitle,
  hideTitle,
}: {
  route: RouteOption;
  customTitle?: string;
  hideTitle?: boolean;
}) {
  const isDark = useColorScheme() === 'dark';
  const palette = getPalette(isDark);
  const group = getGroupStyling(route.type, isDark);
  const matchColors = matchBadgeColors(route.match_percentage, isDark);
  const isWalkOnly = route.legs?.every(leg => leg.mode === 'walking') ?? route.name.toLowerCase() === 'walk';

  return (
    <View style={styles.routeGroupWrapper}>
      {!hideTitle && (
        <Text
          style={[
            styles.groupHeaderLabel,
            { color: isDark ? '#AAA' : '#555', fontFamily: Fonts?.rounded },
          ]}>
          {customTitle || group.title}
          {route.sensory_score != null && (
            <Text style={{ fontSize: 11, fontWeight: '400', color: '#999' }}>
              {' '}
              (Sensory Score: {route.sensory_score})
            </Text>
          )}
        </Text>
      )}

      <View
        style={[
          styles.routeCard,
          { backgroundColor: palette.surface, borderColor: palette.border },
        ]}>
        {/* Header: Dynamic Icon + Name */}
        <View style={styles.cardHeader}>
          <View style={styles.transitBadgeRow}>
            <View style={[styles.transitBadge, { backgroundColor: group.badgeColor }]}>
              <Ionicons
                name={
                  isWalkOnly
                    ? 'walk'
                    : route.name.toLowerCase().includes('bus')
                    ? 'bus'
                    : 'subway'
                }
                size={16}
                color={group.badgeTextColor}
              />
              <Text style={[styles.badgeText, { color: group.badgeTextColor }]}>{route.name}</Text>
            </View>

            {/* Match Rating Pill */}
            <View style={[styles.matchBadge, { backgroundColor: matchColors.bg, marginLeft: 4 }]}>
              <Text style={[styles.matchBadgeText, { color: matchColors.text }]}>
                {route.match_percentage ?? 100}% Match
              </Text>
            </View>
          </View>

          {/* Travel Stats: Time + Cost */}
          <View style={styles.cardStats}>
            <Text style={[styles.cardTime, { color: palette.textPrimary }]}>
              {route.duration} min
            </Text>
            <Text style={[styles.cardCost, { color: palette.textSecondary }]}>
              £{route.price.toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Sensory Dashboard - Wrapping Grid layout for 5 distinct meters */}
        <View style={[styles.sensoryRow, { borderTopColor: palette.divider }]}>
          <SensoryMeter level={route.noise} label="Sound" />
          <SensoryMeter level={route.crowds} label="Crowds" />
          <SensoryMeter level={route.heat} label="Heat" />
          <SensoryMeter level={route.light} label="Light" />
          <SensoryMeter level={route.smell} label="Smell" />
        </View>

        {/* Sensory Compatibility Score Explanation */}
        {route.sensory_description && (
          <Text
            style={[
              styles.sensoryExplanationText,
              {
                color: route.sensory_description.includes('⚠️')
                  ? isDark
                    ? '#FF8A65'
                    : '#D84315'
                  : isDark
                    ? '#81C784'
                    : '#2E7D32',
              },
            ]}>
            {route.sensory_description}
          </Text>
        )}


      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  routeGroupWrapper: {
    marginBottom: 4,
  },
  groupHeaderLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'capitalize',
    letterSpacing: -0.1,
  },
  routeCard: {
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
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
  cardStats: {
    alignItems: 'flex-end',
  },
  cardTime: {
    fontSize: 15,
    fontWeight: '800',
  },
  cardCost: {
    fontSize: 11,
    marginTop: 2,
  },
  sensoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderTopWidth: 1,
    paddingTop: 10,
    rowGap: 10,
    columnGap: 4,
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  matchBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
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
  timelineScroll: {
    flexDirection: 'row',
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
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 6,
  },
  timelineBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  timelineDurText: {
    fontSize: 8,
    fontWeight: '600',
    opacity: 0.8,
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
