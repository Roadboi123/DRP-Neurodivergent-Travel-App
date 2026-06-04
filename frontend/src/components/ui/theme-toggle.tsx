import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/contexts/theme-context';
import { getPalette, hardShadow } from '@/constants/theme';

const TRACK_W = 64;
const TRACK_H = 32;
const PAD = 4;
const KNOB = TRACK_H - PAD * 2; // 24
const TRAVEL = TRACK_W - PAD * 2 - KNOB; // distance the knob slides

/**
 * Light/dark theme switch — a Wero-styled pill with a sliding sun/moon knob.
 * Native re-creation of the supplied web (shadcn) toggle. Uses RN's core
 * Animated (transform only, per DESIGN.md) rather than reanimated, which has no
 * worklets/babel plugin configured in this project.
 */
export function ThemeToggle() {
  const { scheme, toggleScheme } = useTheme();
  const isDark = scheme === 'dark';
  const palette = getPalette(isDark);

  // Knob sits left in dark, right in light (matches the reference).
  const anim = useRef(new Animated.Value(isDark ? 0 : 1)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: isDark ? 0 : 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [isDark, anim]);

  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [0, TRAVEL] });

  return (
    <Pressable
      onPress={toggleScheme}
      accessibilityRole="switch"
      accessibilityState={{ checked: isDark }}
      accessibilityLabel={`Switch to ${isDark ? 'light' : 'dark'} theme`}
      style={[
        styles.track,
        { backgroundColor: palette.surface, borderColor: palette.border },
        hardShadow(3),
      ]}>
      {/* Inactive-side hints, dimmed. */}
      <View style={styles.hints} pointerEvents="none">
        <Ionicons name="moon" size={14} color={palette.textMuted} />
        <Ionicons name="sunny" size={14} color={palette.textMuted} />
      </View>

      <Animated.View
        style={[
          styles.knob,
          { backgroundColor: palette.borderStrong, transform: [{ translateX }] },
        ]}
        pointerEvents="none">
        <Ionicons
          name={isDark ? 'moon' : 'sunny'}
          size={14}
          color={isDark ? '#ececf0' : '#fff48d'}
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: TRACK_H / 2,
    borderWidth: 2,
    padding: PAD,
    justifyContent: 'center',
  },
  hints: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 9,
  },
  knob: {
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
