import React, { useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  Animated,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { SegmentedControl, type SegmentOption } from '@/components/routes/segmented-control';
import { formatClock, type JourneyTime, type JourneyTimeMode } from '@/components/routes/journey-time';
import { BRAND, Fonts, getAccents, getPalette, hardShadow } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const MODE_OPTIONS: SegmentOption<JourneyTimeMode>[] = [
  { value: 'now', label: 'Leave now', icon: 'flash-outline' },
  { value: 'leave', label: 'Leave at', icon: 'time-outline' },
  { value: 'arrive', label: 'Arrive by', icon: 'flag-outline' },
];

const DAY_MS = 24 * 60 * 60 * 1000;

// Wheel geometry: an odd number of visible rows centres the selected value.
const ITEM_H = 44;
const VISIBLE = 5;
const CENTER = (VISIBLE - 1) / 2;
const BAND_TOP = CENTER * ITEM_H;
// react-native-web has no native animation driver — JS-drive transforms there.
const USE_NATIVE = Platform.OS !== 'web';

/** translateY that centres item `index` in the viewport. */
const baseTranslate = (index: number) => ITEM_H * (CENTER - index);

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

/**
 * A single draggable number column (Google-Maps-style). Drag (mouse or touch)
 * or tap a value to select; the column snaps the choice to the centre row and
 * reports it via `onSettle`. Built on PanResponder + Animated (transform only)
 * so it responds to drag on web too, where a ScrollView only takes wheel/touch.
 * Uncontrolled after mount — the parent remounts it (via `key`) to re-seed.
 */
function WheelColumn({
  values,
  initialIndex,
  onSettle,
  accent,
  palette,
}: {
  values: string[];
  initialIndex: number;
  onSettle: (index: number) => void;
  accent: string;
  palette: ReturnType<typeof getPalette>;
}) {
  const translate = useRef(new Animated.Value(baseTranslate(initialIndex))).current;
  // Resting translate at drag start (set from the live value so mid-fling grabs work).
  const startValue = useRef(baseTranslate(initialIndex));
  const activeRef = useRef(initialIndex);
  const [active, setActive] = useState(initialIndex);
  // Keep the latest onSettle so the once-created PanResponder never calls a stale one.
  const onSettleRef = useRef(onSettle);
  onSettleRef.current = onSettle;

  const clamp = (i: number) => Math.max(0, Math.min(values.length - 1, i));
  const indexFor = (t: number) => clamp(Math.round(CENTER - t / ITEM_H));

  const setActiveIndex = (i: number) => {
    if (i !== activeRef.current) {
      activeRef.current = i;
      setActive(i);
    }
  };

  const snapTo = (rawIndex: number, notify = true) => {
    const i = clamp(rawIndex);
    startValue.current = baseTranslate(i);
    setActiveIndex(i);
    Animated.spring(translate, {
      toValue: baseTranslate(i),
      useNativeDriver: USE_NATIVE,
      bounciness: 3,
      speed: 18,
    }).start();
    if (notify) onSettleRef.current(i);
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 2,
      onPanResponderGrant: () => {
        translate.stopAnimation((v: number) => {
          startValue.current = v;
        });
      },
      onPanResponderMove: (_e, g) => {
        const t = startValue.current + g.dy;
        translate.setValue(t);
        setActiveIndex(indexFor(t));
      },
      onPanResponderRelease: (_e, g) => snapTo(indexFor(startValue.current + g.dy)),
      onPanResponderTerminate: (_e, g) => snapTo(indexFor(startValue.current + g.dy)),
    }),
  ).current;

  return (
    <View style={styles.wheelColumn} {...pan.panHandlers}>
      <Animated.View style={{ transform: [{ translateY: translate }] }}>
        {values.map((v, i) => {
          const isActive = i === active;
          return (
            <TouchableOpacity
              key={v}
              activeOpacity={0.7}
              style={styles.wheelItem}
              onPress={() => snapTo(i)}>
              <Text
                style={[
                  styles.wheelText,
                  {
                    color: isActive ? accent : palette.textSecondary,
                    opacity: isActive ? 1 : 0.35,
                    fontSize: isActive ? 30 : 22,
                  },
                ]}>
                {v}
              </Text>
            </TouchableOpacity>
          );
        })}
      </Animated.View>
    </View>
  );
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

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
  // Bumped whenever the sheet (re-)opens or the mode flips, to remount the
  // wheels at a fresh starting position.
  const [seed, setSeed] = useState(0);
  useEffect(() => {
    if (visible) {
      setDraft(value);
      setSeed((s) => s + 1);
    }
  }, [visible, value]);

  const picked = new Date(draft.at);
  const hours = picked.getHours();
  const minutes = picked.getMinutes();

  const setMode = (mode: JourneyTimeMode) => {
    if (mode === 'now') {
      setDraft({ mode, at: Date.now() });
      return;
    }
    // Seed a sensible default the first time a specific mode is chosen: 30
    // minutes from now, rounded to the minute.
    const base = draft.mode === 'now' ? Date.now() + 30 * 60_000 : draft.at;
    const d = new Date(base);
    d.setSeconds(0, 0);
    setDraft({ mode, at: d.getTime() });
    setSeed((s) => s + 1);
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
              <View style={styles.wheels}>
                {/* Centre selection band */}
                <View
                  pointerEvents="none"
                  style={[styles.selectionBand, { borderColor: palette.border, top: BAND_TOP }]}
                />
                <WheelColumn
                  key={`h-${seed}`}
                  values={HOURS}
                  initialIndex={hours}
                  onSettle={(i) => setDraft((d) => ({ ...d, at: instantFor(i, minutes) }))}
                  accent={palette.textPrimary}
                  palette={palette}
                />
                <Text style={[styles.colon, { color: palette.textPrimary }]}>:</Text>
                <WheelColumn
                  key={`m-${seed}`}
                  values={MINUTES}
                  initialIndex={minutes}
                  onSettle={(i) => setDraft((d) => ({ ...d, at: instantFor(hours, i) }))}
                  accent={palette.textPrimary}
                  palette={palette}
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
  wheels: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 18,
    height: ITEM_H * VISIBLE,
  },
  selectionBand: {
    position: 'absolute',
    left: 40,
    right: 40,
    height: ITEM_H,
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderRadius: 2,
    opacity: 0.5,
  },
  wheelColumn: {
    width: 78,
    height: ITEM_H * VISIBLE,
    overflow: 'hidden',
  },
  wheelItem: {
    height: ITEM_H,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelText: {
    fontFamily: Fonts?.display,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  colon: {
    fontSize: 30,
    fontFamily: Fonts?.display,
    fontWeight: '800',
    marginBottom: 2,
  },
  dayNote: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 16,
  },
  doneButton: {
    marginTop: 24,
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
