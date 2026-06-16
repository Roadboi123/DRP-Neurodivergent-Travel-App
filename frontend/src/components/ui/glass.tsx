import { BlurView } from 'expo-blur';
import { type ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { GLASS, type GlassTone, Radii, softShadow } from '@/constants/theme';

export interface GlassProps {
  children?: ReactNode;
  /** 'light' = frosted white (default), 'dark' = frosted charcoal (white text). */
  tone?: GlassTone;
  /** Corner radius (defaults to the card radius). */
  radius?: number;
  /** Soft shadow level, or 0 for none. */
  shadow?: 0 | 1 | 2 | 3;
  /** Show the thin light hairline border (default true). */
  bordered?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * The Clearway frosted-glass surface — a real backdrop blur (expo-blur BlurView,
 * which maps to CSS `backdrop-filter` on web) under a translucent tinted fill,
 * with a thin light border and a soft shadow. The base building block for
 * GlassCard / GlassButton / Chip and any bespoke frosted surface.
 */
export function Glass({
  children,
  tone = 'light',
  radius = Radii.card,
  shadow = 2,
  bordered = true,
  style,
}: GlassProps) {
  const g = GLASS[tone];
  return (
    <View
      style={[
        { borderRadius: radius, overflow: 'hidden' },
        bordered && { borderWidth: 1, borderColor: g.border },
        shadow ? softShadow(shadow) : null,
        // overflow:hidden clips the iOS shadow; the wrapper below re-applies it.
        style,
      ]}>
      <BlurView
        intensity={g.blur}
        tint={tone === 'dark' ? 'dark' : 'light'}
        // Android needs the dimezis method for a real blur; web/iOS use the default.
        experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: g.fill }]} />
      {children}
    </View>
  );
}
