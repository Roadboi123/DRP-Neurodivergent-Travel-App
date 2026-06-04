import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { BRAND, Fonts, getPalette, hardShadow } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const ACCENT = BRAND.pink;

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

  return (
    <View style={isTab ? styles.tabTrack : styles.chipRow}>
      {options.map((option) => {
        const active = option.value === value;
        const fg = active ? BRAND.white : palette.textPrimary;
        return (
          <TouchableOpacity
            key={option.value}
            onPress={() => onChange(option.value)}
            activeOpacity={0.85}
            style={[
              isTab ? styles.tabSegment : styles.chip,
              active && styles.segmentActive,
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
    borderRadius: 30,
    padding: 4,
    backgroundColor: BRAND.white,
    borderWidth: 2,
    borderColor: BRAND.ink,
    ...hardShadow(4),
  },
  tabSegment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 24,
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
    borderRadius: 30,
    backgroundColor: BRAND.white,
    borderWidth: 2,
    borderColor: BRAND.ink,
    ...hardShadow(3),
  },
  segmentActive: {
    backgroundColor: ACCENT,
  },
  label: {
    fontSize: 13,
    fontFamily: Fonts?.display,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
});
