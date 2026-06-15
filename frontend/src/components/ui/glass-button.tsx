import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Glass } from '@/components/ui/glass';
import { CLEARWAY, ClearwayFonts, Radii, softShadow } from '@/constants/theme';

type Variant = 'primary' | 'secondary' | 'ghost';

export interface GlassButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

/**
 * The signature Clearway CTA. `primary` is a soft blue→light-blue gradient pill
 * with white text; `secondary` is a frosted-glass pill with a hairline border;
 * `ghost` is borderless/transparent. All have a pressed (scale + dim) state.
 */
export function GlassButton({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  fullWidth,
  style,
  accessibilityLabel,
}: GlassButtonProps) {
  const tint = variant === 'primary' ? CLEARWAY.white : CLEARWAY.ink;

  const content = (
    <View style={styles.row}>
      {icon ? <Ionicons name={icon} size={18} color={tint} style={styles.icon} /> : null}
      <Text style={[styles.label, { color: tint }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={disabled}
      style={({ pressed }) => [
        fullWidth && styles.fullWidth,
        { borderRadius: Radii.pill, opacity: disabled ? 0.5 : 1 },
        pressed && styles.pressed,
        style,
      ]}>
      {variant === 'primary' ? (
        <LinearGradient
          colors={[CLEARWAY.bluePillFrom, CLEARWAY.bluePillTo, CLEARWAY.blue]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.pad, { borderRadius: Radii.pill }, softShadow(1)]}>
          {content}
        </LinearGradient>
      ) : variant === 'secondary' ? (
        <Glass radius={Radii.pill} shadow={1} style={fullWidth && styles.fullWidth}>
          <View style={styles.pad}>{content}</View>
        </Glass>
      ) : (
        <View style={[styles.pad, { borderRadius: Radii.pill }]}>{content}</View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fullWidth: { alignSelf: 'stretch' },
  pressed: { transform: [{ scale: 0.97 }], opacity: 0.85 },
  pad: { paddingVertical: 15, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  icon: { marginRight: 2 },
  label: { fontFamily: ClearwayFonts.semibold, fontSize: 16, letterSpacing: 0.2 },
});
