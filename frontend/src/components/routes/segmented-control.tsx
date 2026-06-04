import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { getPalette } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const ACCENT = '#E91E63';

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
  const trackBg = isDark ? '#2E3543' : '#EAEAEA';

  return (
    <View style={[isTab ? styles.tabTrack : styles.chipRow, isTab && { backgroundColor: trackBg }]}>
      {options.map((option) => {
        const active = option.value === value;
        const bg = active ? ACCENT : isTab ? 'transparent' : trackBg;
        const fg = active ? '#FFF' : palette.textPrimary;
        return (
          <TouchableOpacity
            key={option.value}
            onPress={() => onChange(option.value)}
            activeOpacity={0.85}
            style={[
              isTab ? styles.tabSegment : styles.chip,
              { backgroundColor: bg },
            ]}>
            {option.icon && <Ionicons name={option.icon} size={15} color={fg} />}
            <Text style={[styles.label, { color: fg }]}>{option.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabTrack: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 3,
  },
  tabSegment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 10,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
  },
});
