import { LinearGradient } from 'expo-linear-gradient';
import { type StyleProp, type ViewStyle } from 'react-native';

import { CLEARWAY } from '@/constants/theme';

export interface GradientDotProps {
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/** The small blue→lilac accent dot from the deck (card corners, the "Clearway." dot). */
export function GradientDot({ size = 14, style }: GradientDotProps) {
  return (
    <LinearGradient
      colors={[CLEARWAY.bluePillTo, CLEARWAY.lilac]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[{ width: size, height: size, borderRadius: size / 2 }, style]}
    />
  );
}
