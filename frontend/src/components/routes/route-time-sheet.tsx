import React, { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { SegmentedControl, type SegmentOption } from '@/components/routes/segmented-control';
import { formatClock, type JourneyTime, type JourneyTimeMode } from '@/components/routes/journey-time';
import { BRAND, Fonts, getAccents, getPalette, hardShadow } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const MODE_OPTIONS: SegmentOption<JourneyTimeMode>[] = [
  { value: 'now', label: 'Leave now', icon: 'flash-outline' },
  { value: 'leave', label: 'Leave at', icon: 'time-outline' },
  { value: 'arrive', label: 'Arrive by', icon: 'flag-outline' },
];

const MINUTE_STEP = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Day suffix relative to now: "Today", "Tomorrow", else a short date. */
function dayLabel(at: number): string {
  const now = new Date();
  const target = new Date(at);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayDelta = Math.round(
    (new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime() - startOfToday) / DAY_MS,
  );
  if (dayDelta <= 0) return 'Today';
  if (dayDelta === 1) return 'Tomorrow';
  return target.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Short label for the trigger button outside the sheet. */
export function journeyTimeLabel(t: JourneyTime): string {
  if (t.mode === 'now') return 'Leave now';
  const verb = t.mode === 'arrive' ? 'Arrive by' : 'Leave at';
  const day = dayLabel(t.at);
  const dayPart = day === 'Today' ? '' : `, ${day}`;
  return `${verb} ${formatClock(new Date(t.at))}${dayPart}`;
}

/**
 * Build an epoch-ms instant for the given hour/minute. If that clock time has
 * already passed today, roll forward to tomorrow so a picked time is never in
 * the past (sensible for both leave-at and arrive-by).
 */
function instantFor(hours: number, minutes: number): number {
  const now = new Date();
  const candidate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);
  if (candidate.getTime() < now.getTime()) candidate.setDate(candidate.getDate() + 1);
  return candidate.getTime();
}

function Stepper({
  label,
  value,
  onDec,
  onInc,
  palette,
  accent,
}: {
  label: string;
  value: string;
  onDec: () => void;
  onInc: () => void;
  palette: ReturnType<typeof getPalette>;
  accent: string;
}) {
  return (
    <View style={styles.stepperCol}>
      <Text style={[styles.stepperLabel, { color: palette.textSecondary }]}>{label}</Text>
      <View style={styles.stepperRow}>
        <TouchableOpacity
          onPress={onDec}
          activeOpacity={0.8}
          accessibilityLabel={`Decrease ${label}`}
          style={[styles.stepBtn, { backgroundColor: accent, borderColor: palette.border }]}>
          <Ionicons name="remove" size={20} color={BRAND.ink} />
        </TouchableOpacity>
        <Text style={[styles.stepperValue, { color: palette.textPrimary }]}>{value}</Text>
        <TouchableOpacity
          onPress={onInc}
          activeOpacity={0.8}
          accessibilityLabel={`Increase ${label}`}
          style={[styles.stepBtn, { backgroundColor: accent, borderColor: palette.border }]}>
          <Ionicons name="add" size={20} color={BRAND.ink} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export function RouteTimeSheet({
  visible,
  value,
  onChange,
  onClose,
}: {
  visible: boolean;
  value: JourneyTime;
  onChange: (value: JourneyTime) => void;
  onClose: () => void;
}) {
  const isDark = useColorScheme() === 'dark';
  const palette = getPalette(isDark);
  const accents = getAccents(isDark);

  // Working copy so edits only commit on "Done".
  const [draft, setDraft] = useState<JourneyTime>(value);
  useEffect(() => {
    if (visible) setDraft(value);
  }, [visible, value]);

  const picked = new Date(draft.at);
  const hours = picked.getHours();
  const minutes = picked.getMinutes();

  const setMode = (mode: JourneyTimeMode) => {
    if (mode === 'now') {
      setDraft({ mode, at: Date.now() });
      return;
    }
    // Seed a sensible default time the first time a specific mode is chosen:
    // 30 minutes from now, rounded to the minute step.
    const base = draft.mode === 'now' ? Date.now() + 30 * 60_000 : draft.at;
    const d = new Date(base);
    d.setMinutes(Math.round(d.getMinutes() / MINUTE_STEP) * MINUTE_STEP, 0, 0);
    setDraft({ mode, at: d.getTime() });
  };

  const bumpHour = (delta: number) => {
    setDraft((d) => ({ ...d, at: instantFor((hours + delta + 24) % 24, minutes) }));
  };
  const bumpMinute = (delta: number) => {
    const total = hours * 60 + minutes + delta * MINUTE_STEP;
    const wrapped = (total + 24 * 60) % (24 * 60);
    setDraft((d) => ({ ...d, at: instantFor(Math.floor(wrapped / 60), wrapped % 60) }));
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <TouchableOpacity
          activeOpacity={1}
          style={[styles.sheet, { backgroundColor: palette.surface, borderColor: palette.border }]}
          onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={[styles.title, { color: palette.textPrimary }]}>When?</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityLabel="Close time picker">
              <Ionicons name="close" size={24} color={palette.textSecondary} />
            </TouchableOpacity>
          </View>

          <SegmentedControl options={MODE_OPTIONS} value={draft.mode} onChange={setMode} />

          {draft.mode !== 'now' && (
            <>
              <View style={styles.steppers}>
                <Stepper
                  label="Hour"
                  value={String(hours).padStart(2, '0')}
                  onDec={() => bumpHour(-1)}
                  onInc={() => bumpHour(1)}
                  palette={palette}
                  accent={accents.cyan}
                />
                <Text style={[styles.colon, { color: palette.textPrimary }]}>:</Text>
                <Stepper
                  label="Min"
                  value={String(minutes).padStart(2, '0')}
                  onDec={() => bumpMinute(-1)}
                  onInc={() => bumpMinute(1)}
                  palette={palette}
                  accent={accents.cyan}
                />
              </View>
              <Text style={[styles.dayNote, { color: palette.textSecondary }]}>
                {draft.mode === 'arrive' ? 'Arrive by' : 'Leave at'} {formatClock(picked)} · {dayLabel(draft.at)}
              </Text>
            </>
          )}

          <TouchableOpacity
            onPress={() => {
              onChange(draft);
              onClose();
            }}
            activeOpacity={0.85}
            style={[styles.doneButton, { backgroundColor: accents.pink, borderColor: palette.border }]}>
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 32,
    borderWidth: 2,
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
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontFamily: Fonts?.display,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: -0.3,
  },
  steppers: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 14,
    marginTop: 24,
  },
  colon: {
    fontSize: 34,
    fontFamily: Fonts?.display,
    fontWeight: '800',
    marginBottom: 10,
  },
  stepperCol: {
    alignItems: 'center',
    gap: 8,
  },
  stepperLabel: {
    fontSize: 11,
    fontFamily: Fonts?.display,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    ...hardShadow(3),
  },
  stepperValue: {
    fontSize: 40,
    fontFamily: Fonts?.display,
    fontWeight: '800',
    minWidth: 62,
    textAlign: 'center',
    letterSpacing: -1,
  },
  dayNote: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 16,
  },
  doneButton: {
    marginTop: 28,
    paddingVertical: 15,
    borderRadius: 30,
    alignItems: 'center',
    borderWidth: 2,
    ...hardShadow(5),
  },
  doneButtonText: {
    color: BRAND.white,
    fontFamily: Fonts?.display,
    fontSize: 15,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
