import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Modal, Pressable, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';

import { SegmentedControl, type SegmentOption } from '@/components/routes/segmented-control';
import { CLEARWAY, Fonts, GLASS, getPalette, Radii, softShadow } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { AcFilter, RouteFilters, SortMode } from '@/components/routes/route-filtering';

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
        <TouchableOpacity
          activeOpacity={1}
          style={[styles.sheet, { backgroundColor: GLASS.light.fill, borderColor: GLASS.light.border }]}
          onPress={(e) => e.stopPropagation()}>
          <BlurView intensity={GLASS.light.blur} tint="light" style={StyleSheet.absoluteFill} />
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
                Group by number of changes
              </Text>
            </View>
            <Switch
              value={filters.groupByChanges}
              onValueChange={(groupByChanges) => onChange({ ...filters, groupByChanges })}
              trackColor={{ false: '#c9d0d8', true: CLEARWAY.blue }}
              thumbColor="#FFF"
              ios_backgroundColor="#c9d0d8"
            />
          </View>
          <Text style={[styles.helperNote, { color: palette.textSecondary }]}>
            Groups routes by how many changes (interchanges) each one takes — 0 changes, 1 change,
            and so on — with each group still ranked by your sort.
          </Text>

          <TouchableOpacity
            onPress={onClose}
            activeOpacity={0.85}
            style={[styles.doneButton, { backgroundColor: CLEARWAY.blue }]}>
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    // Dim the background screen so the sheet stands out and text is easy to read
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: Radii.cardLg,
    borderTopRightRadius: Radii.cardLg,
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 32,
    borderWidth: 1,
    overflow: 'hidden',
    ...softShadow(3),
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
    fontSize: 24,
    fontFamily: Fonts?.display,
    fontWeight: '800',
    letterSpacing: -0.6,
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
    fontFamily: Fonts?.display,
    fontWeight: '800',
    letterSpacing: -0.2,
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
    fontFamily: Fonts?.semibold,
    fontWeight: '700',
  },
  helperNote: {
    fontSize: 13,
    fontFamily: Fonts?.body,
    lineHeight: 18,
    marginTop: 8,
  },
  doneButton: {
    marginTop: 26,
    paddingVertical: 16,
    borderRadius: Radii.pill,
    alignItems: 'center',
    ...softShadow(1),
  },
  doneButtonText: {
    color: CLEARWAY.white,
    fontFamily: Fonts?.semibold,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
