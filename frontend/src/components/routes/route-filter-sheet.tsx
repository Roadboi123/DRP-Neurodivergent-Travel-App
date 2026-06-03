import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';

import { SegmentedControl, type SegmentOption } from '@/components/routes/segmented-control';
import { getPalette } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { AcFilter, RouteFilters, SortMode } from '@/components/routes/route-filtering';

const ACCENT = '#E91E63';

const SORT_OPTIONS: SegmentOption<SortMode>[] = [
  { value: 'preference', label: 'Preference', icon: 'heart-outline' },
  { value: 'speed', label: 'Speed', icon: 'flash-outline' },
];

const AC_OPTIONS: SegmentOption<AcFilter>[] = [
  { value: 'any', label: "Don't care" },
  { value: 'preferred', label: 'Preferred' },
  { value: 'every', label: 'Throughout' },
];

/** Heading with a leading icon, used for each section of the sheet. */
function SectionHeading({ icon, label, color }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; color: string }) {
  return (
    <View style={styles.sectionHeading}>
      <Ionicons name={icon} size={16} color={color} />
      <Text style={[styles.sectionHeadingText, { color }]}>{label}</Text>
    </View>
  );
}

export function RouteFilterSheet({
  visible,
  filters,
  onChange,
  onClose,
}: {
  visible: boolean;
  filters: RouteFilters;
  onChange: (filters: RouteFilters) => void;
  onClose: () => void;
}) {
  const isDark = useColorScheme() === 'dark';
  const palette = getPalette(isDark);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Stop backdrop taps from closing when they land on the sheet itself */}
        <Pressable
          style={[styles.sheet, { backgroundColor: palette.surface }]}
          onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={[styles.title, { color: palette.textPrimary }]}>Route options</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityLabel="Close options">
              <Ionicons name="close" size={24} color={palette.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Sort by — stays in sync with the on-screen tab */}
          <SectionHeading icon="swap-vertical-outline" label="Sort by" color={palette.textPrimary} />
          <SegmentedControl
            options={SORT_OPTIONS}
            value={filters.sort}
            onChange={(sort) => onChange({ ...filters, sort })}
          />

          {/* Air conditioning */}
          <SectionHeading icon="snow-outline" label="Air conditioning" color={palette.textPrimary} />
          <SegmentedControl
            options={AC_OPTIONS}
            value={filters.ac}
            onChange={(ac) => onChange({ ...filters, ac })}
          />

          {/* Group by changes */}
          <View style={[styles.switchRow, { borderTopColor: palette.divider }]}>
            <View style={styles.switchLabelGroup}>
              <Ionicons name="git-branch-outline" size={16} color={palette.textPrimary} />
              <Text style={[styles.switchLabel, { color: palette.textPrimary }]}>
                Group by changes
              </Text>
            </View>
            <Switch
              value={filters.groupByChanges}
              onValueChange={(groupByChanges) => onChange({ ...filters, groupByChanges })}
              trackColor={{ false: isDark ? '#3A4150' : '#D1D5DB', true: ACCENT }}
              thumbColor="#FFF"
              ios_backgroundColor={isDark ? '#3A4150' : '#D1D5DB'}
            />
          </View>
          {filters.groupByChanges && (
            <Text style={[styles.helperNote, { color: palette.textSecondary }]}>
              Routes are grouped by number of changes, ranked by your sort.
            </Text>
          )}

          <TouchableOpacity
            onPress={onClose}
            activeOpacity={0.85}
            style={[styles.doneButton, { backgroundColor: ACCENT }]}>
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 32,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#9993',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 20,
    marginBottom: 10,
  },
  sectionHeadingText: {
    fontSize: 15,
    fontWeight: '700',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 22,
    paddingTop: 18,
    borderTopWidth: 1,
  },
  switchLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  switchLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  helperNote: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
  },
  doneButton: {
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  doneButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
