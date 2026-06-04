import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { GRADIENTS } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

/**
 * The fixed Wero page field — pink→yellow in light, a muted charcoal/plum sweep
 * in the calm dark theme. Each screen mounts its own and renders over it with a
 * transparent background. Static (no animation) — deliberately, to avoid
 * motion/over-stimulation for the app's users.
 */
export function GradientBackground() {
  const isDark = useColorScheme() === 'dark';
  const gradient = isDark ? GRADIENTS.backgroundDark : GRADIENTS.background;

  return (
    <LinearGradient
      colors={gradient.colors}
      locations={gradient.locations}
      start={gradient.start}
      end={gradient.end}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    />
  );
}
