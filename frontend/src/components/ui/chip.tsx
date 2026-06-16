import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Glass } from '@/components/ui/glass';
import { CLEARWAY, ClearwayFonts, Radii, softShadow } from '@/constants/theme';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** Override the selected fill (e.g. a sensory-level colour). Defaults to the blue gradient. */
  selectedColor?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * A selectable pill. Selected = blue gradient (or `selectedColor` solid) with
 * white text; unselected = frosted glass with a hairline border. Pressed state
 * dims + nudges scale.
 */
export function Chip({ label, selected, onPress, selectedColor, style }: ChipProps) {
  const text = (
    <Text
      style={[styles.label, { color: selected ? CLEARWAY.white : CLEARWAY.ink }]}
      numberOfLines={1}>
      {label}
    </Text>
  );

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => [pressed && styles.pressed, style]}>
      {selected ? (
        selectedColor ? (
          <View style={[styles.pad, { backgroundColor: selectedColor }, softShadow(1)]}>{text}</View>
        ) : (
          <LinearGradient
            colors={[CLEARWAY.bluePillTo, CLEARWAY.blue]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.pad, softShadow(1)]}>
            {text}
          </LinearGradient>
        )
      ) : (
        <Glass radius={Radii.pill} shadow={0}>
          <View style={styles.pad}>{text}</View>
        </Glass>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { transform: [{ scale: 0.96 }], opacity: 0.85 },
  pad: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontFamily: ClearwayFonts.semibold, fontSize: 13.5, letterSpacing: 0.2 },
});
