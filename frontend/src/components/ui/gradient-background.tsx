import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { GRADIENTS } from '@/constants/theme';

/**
 * The fixed Wero pink→yellow field. Mounted once behind the navigator (root
 * layout); screens render over it with a transparent background. Static (no
 * animation) — deliberately, to avoid motion/over-stimulation for the app's users.
 */
export function GradientBackground() {
  return (
    <LinearGradient
      colors={GRADIENTS.background.colors}
      start={GRADIENTS.background.start}
      end={GRADIENTS.background.end}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    />
  );
}
