import { Ionicons } from '@expo/vector-icons';
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

function matchBadgeColors(matchPercentage: number | undefined, isDark: boolean) {
  if (matchPercentage === undefined) {
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

export function RouteCard({ route }: { route: RouteOption }) {
  const isDark = useColorScheme() === 'dark';
  const palette = getPalette(isDark);
  const group = getGroupStyling(route.type, isDark);
  const subName = route.subName ?? '';
  const matchColors = matchBadgeColors(route.match_percentage, isDark);

  return (
    <View style={styles.routeGroupWrapper}>
      <Text
        style={[
          styles.groupHeaderLabel,
          { color: isDark ? '#AAA' : '#555', fontFamily: Fonts?.rounded },
        ]}>
        {group.title}
        {route.sensory_score !== undefined && (
          <Text style={{ fontSize: 11, fontWeight: '400', color: '#999' }}>
            {' '}
            (Sensory Score: {route.sensory_score})
          </Text>
        )}
      </Text>

      <View
        style={[
          styles.routeCard,
          { backgroundColor: palette.surface, borderColor: palette.border },
        ]}>
        {/* Header: Mode Icon + Name */}
        <View style={styles.cardHeader}>
          <View style={styles.transitBadgeRow}>
            <View style={[styles.transitBadge, { backgroundColor: group.badgeColor }]}>
              <Ionicons name="bus" size={16} color={group.badgeTextColor} />
              <Text style={[styles.badgeText, { color: group.badgeTextColor }]}>{route.name}</Text>
            </View>

            {route.subName && (
              <>
                <Ionicons
                  name="arrow-forward"
                  size={14}
                  color={isDark ? '#666' : '#999'}
                  style={styles.arrowSpacing}
                />
                {subName.toLowerCase().includes('district') ? (
                  <View style={[styles.transitBadge, { backgroundColor: '#1B5E20' }]}>
                    <Ionicons name="subway" size={14} color="#FFF" />
                    <Text style={[styles.badgeText, { color: '#FFF' }]}>District Line</Text>
                  </View>
                ) : subName.toLowerCase().includes('central') ? (
                  <View style={[styles.transitBadge, { backgroundColor: '#B71C1C' }]}>
                    <Ionicons name="subway" size={14} color="#FFF" />
                    <Text style={[styles.badgeText, { color: '#FFF' }]}>Central Line</Text>
                  </View>
                ) : null}

                {subName.toLowerCase().includes('walk') && (
                  <View
                    style={[
                      styles.transitBadge,
                      { backgroundColor: isDark ? '#2E3543' : '#ECEFF1' },
                    ]}>
                    <Ionicons name="walk" size={14} color={isDark ? '#CCC' : '#455A64'} />
                  </View>
                )}
              </>
            )}

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

        {/* Explanation */}
        <Text
          style={[styles.routeDescription, { color: isDark ? '#9BA1A6' : '#666', marginTop: 6 }]}>
          💡 {route.description}
        </Text>
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
  arrowSpacing: {
    marginHorizontal: 2,
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
  routeDescription: {
    fontSize: 11.5,
    lineHeight: 16,
    fontStyle: 'italic',
  },
});
