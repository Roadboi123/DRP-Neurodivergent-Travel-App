import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { Fonts, getAccents, getPalette, hardShadow } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

/**
 * Friendly speech-bubble that points first-time / logged-out travellers toward
 * setting their sensory preferences — the thing that makes route scoring
 * personal. Wero styling (ink border, hard shadow, bright fill); a gentle pulse
 * on the leading icon draws the eye without being noisy.
 */
export function PreferencesNudge({
  title = 'Make it yours',
  message = 'Set your sensory preferences so we can find your calmest routes.',
  onPress,
}: {
  title?: string;
  message?: string;
  onPress: () => void;
}) {
  const isDark = useColorScheme() === 'dark';
  const palette = getPalette(isDark);
  const accents = getAccents(isDark);

  // Subtle attention pulse on the icon (transform/opacity only — RN-web safe).
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${message}`}
      style={({ pressed }) => [styles.wrap, pressed ? styles.wrapPressed : null]}
    >
      {/* Little downward tail (drawn first so the bubble body covers its top). */}
      <View style={[styles.tail, { backgroundColor: accents.yellow, borderColor: palette.border }]} />
      <View
        style={[
          styles.bubble,
          { backgroundColor: accents.yellow, borderColor: palette.border },
          hardShadow(4),
        ]}
      >
        <Animated.View
          style={[
            styles.iconCircle,
            { backgroundColor: palette.surface, borderColor: palette.border, transform: [{ scale }] },
          ]}
        >
          <Ionicons name="sparkles" size={16} color={palette.textPrimary} />
        </Animated.View>
        <View style={styles.textCol}>
          <Text style={[styles.title, { color: palette.textPrimary }]}>{title}</Text>
          <Text style={[styles.message, { color: palette.textPrimary }]}>{message}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={palette.textPrimary} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 24,
  },
  wrapPressed: {
    transform: [{ translateY: 2 }],
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 2,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
  },
  title: {
    fontSize: 13,
    fontFamily: Fonts?.display,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  message: {
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '600',
  },
  // A 2px-bordered square rotated 45° reads as a triangular tail; it sits just
  // under the bubble's left, with the top half hidden behind the bubble body.
  tail: {
    position: 'absolute',
    bottom: -7,
    left: 28,
    width: 14,
    height: 14,
    borderWidth: 2,
    transform: [{ rotate: '45deg' }],
  },
});
