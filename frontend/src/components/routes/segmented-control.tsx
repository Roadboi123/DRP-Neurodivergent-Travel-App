import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { CLEARWAY, Fonts, getPalette, Radii, softShadow } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: IoniconName;
}

/**
 * Reusable single-select control. Two looks:
 * - `tab`: an iOS-style segmented control (one rounded track, equal-width
 *   segments) — used for the on-screen Preference|Speed sort tab.
 * - `chips`: separate rounded pills that wrap — used inside the Filters sheet.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  variant = 'chips',
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  variant?: 'tab' | 'chips';
}) {
  const isDark = useColorScheme() === 'dark';
  const palette = getPalette(isDark);
  const isTab = variant === 'tab';
  const surfaceStyle = { backgroundColor: palette.surface, borderColor: palette.border };

  return (
    <View style={isTab ? [styles.tabTrack, surfaceStyle] : styles.chipRow}>
      {options.map((option) => {
        const active = option.value === value;
        const fg = active ? CLEARWAY.white : palette.textPrimary;
        return (
          <TouchableOpacity
            key={option.value}
            onPress={() => onChange(option.value)}
            activeOpacity={0.85}
            style={[
              isTab ? styles.tabSegment : [styles.chip, surfaceStyle],
              active && { backgroundColor: CLEARWAY.blue, ...softShadow(1) },
            ]}>
            {option.icon && <Ionicons name={option.icon} size={isTab ? 13 : 15} color={fg} />}
            <Text
              numberOfLines={1}
              style={[styles.label, isTab && styles.tabLabel, { color: fg }]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabTrack: {
    flexDirection: 'row',
    borderRadius: Radii.pill,
    padding: 4,
    borderWidth: 1,
    ...softShadow(1),
  },
  tabSegment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: Radii.pill,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: Radii.pill,
    borderWidth: 1,
    ...softShadow(1),
  },
  label: {
    fontSize: 13,
    fontFamily: Fonts?.semibold,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  // Tabs share the row 50/50, so "Preference" + icon must stay compact.
  tabLabel: {
    fontSize: 11.5,
    letterSpacing: 0,
  },
});
