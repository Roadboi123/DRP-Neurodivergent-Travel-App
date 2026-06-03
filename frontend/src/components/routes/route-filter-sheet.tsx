import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { getPalette } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { AcFilter, RouteFilters } from '@/components/routes/route-filtering';

const ACCENT = '#E91E63';

/** One option button in a segmented row. */
function Segment({
  label,
  active,
  onPress,
  isDark,
  textColor,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  isDark: boolean;
  textColor: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={[
        styles.segment,
        { backgroundColor: active ? ACCENT : isDark ? '#2E3543' : '#EAEAEA' },
      ]}>
      <Text style={[styles.segmentText, { color: active ? '#FFF' : textColor }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const AC_OPTIONS: { value: AcFilter; label: string }[] = [
  { value: 'any', label: "Don't care" },
  { value: 'preferred', label: 'Preferred' },
  { value: 'every', label: 'Present at every point' },
];

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

  // Keep at least one best-by card on: ignore a tap that would clear the last one.
  const toggleBestBy = (key: 'preference' | 'speed') => {
    const next = { ...filters.bestBy, [key]: !filters.bestBy[key] };
    if (!next.preference && !next.speed) {
      return;
    }
    onChange({ ...filters, bestBy: next });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Stop backdrop taps from closing when they land on the sheet itself */}
        <Pressable
          style={[styles.sheet, { backgroundColor: palette.surface }]}
          onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={[styles.title, { color: palette.textPrimary }]}>Filters</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityLabel="Close filters">
              <Ionicons name="close" size={24} color={palette.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Number of changes */}
          <Text style={[styles.sectionHeading, { color: palette.textPrimary }]}>
            Number of changes
          </Text>
          <View style={styles.segmentRow}>
            <Segment
              label="Disable"
              active={!filters.groupByChanges}
              onPress={() => onChange({ ...filters, groupByChanges: false })}
              isDark={isDark}
              textColor={palette.textPrimary}
            />
            <Segment
              label="Enable"
              active={filters.groupByChanges}
              onPress={() => onChange({ ...filters, groupByChanges: true })}
              isDark={isDark}
              textColor={palette.textPrimary}
            />
          </View>

          {/* A/C */}
          <Text style={[styles.sectionHeading, { color: palette.textPrimary }]}>A/C</Text>
          <View style={styles.segmentRow}>
            {AC_OPTIONS.map(({ value, label }) => (
              <Segment
                key={value}
                label={label}
                active={filters.ac === value}
                onPress={() => onChange({ ...filters, ac: value })}
                isDark={isDark}
                textColor={palette.textPrimary}
              />
            ))}
          </View>

          {/* Best by — both independently toggleable, default both on */}
          <Text style={[styles.sectionHeading, { color: palette.textPrimary }]}>Best by</Text>
          <View style={styles.segmentRow}>
            <Segment
              label="Preference"
              active={filters.bestBy.preference}
              onPress={() => toggleBestBy('preference')}
              isDark={isDark}
              textColor={palette.textPrimary}
            />
            <Segment
              label="Speed"
              active={filters.bestBy.speed}
              onPress={() => toggleBestBy('speed')}
              isDark={isDark}
              textColor={palette.textPrimary}
            />
          </View>
          <Text style={[styles.gloss, { color: palette.textSecondary }]}>
            <Text style={styles.glossLabel}>Preference</Text> — sensory needs take priority in the
            suggested journey.
          </Text>
          <Text style={[styles.gloss, { color: palette.textSecondary }]}>
            <Text style={styles.glossLabel}>Speed</Text> — quickest journey; the stimuli to expect
            are still shown.
          </Text>

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
    fontSize: 15,
    fontWeight: '700',
    marginTop: 18,
    marginBottom: 10,
  },
  segmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  segment: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '700',
  },
  gloss: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
  },
  glossLabel: {
    fontWeight: '700',
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
