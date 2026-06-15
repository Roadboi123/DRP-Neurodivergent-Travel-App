import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { Glass } from '@/components/ui/glass';
import { CLEARWAY, Fonts, getPalette, Radii } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

/**
 * Friendly card that points first-time / logged-out travellers toward setting
 * their sensory preferences — the thing that makes route scoring personal.
 * Clearway styling: a frosted-glass card with a blue→lilac gradient icon chip
 * and a gentle pulse to draw the eye without being noisy.
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
      style={({ pressed }) => [styles.wrap, pressed ? styles.wrapPressed : null]}>
      <Glass radius={Radii.card} shadow={2}>
        <View style={styles.bubble}>
          <Animated.View style={{ transform: [{ scale }] }}>
            <LinearGradient
              colors={[CLEARWAY.bluePillTo, CLEARWAY.lilac]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.iconCircle}>
              <Ionicons name="sparkles" size={17} color={CLEARWAY.white} />
            </LinearGradient>
          </Animated.View>
          <View style={styles.textCol}>
            <Text style={[styles.title, { color: palette.textPrimary }]}>{title}</Text>
            <Text style={[styles.message, { color: palette.textSecondary }]}>{message}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={palette.textMuted} />
        </View>
      </Glass>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 24,
  },
  wrapPressed: {
    transform: [{ scale: 0.99 }],
    opacity: 0.92,
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontFamily: Fonts?.display,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  message: {
    fontSize: 13,
    fontFamily: Fonts?.body,
    lineHeight: 18,
    fontWeight: '500',
  },
});
