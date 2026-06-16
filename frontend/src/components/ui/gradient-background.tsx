import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { MESH } from '@/constants/theme';

// The soft blue-blur backdrop asset (a diffuse radial glow on white). Used in
// place of drawn blob shapes for a calmer, photo-quality blur.
const BLUR_BG = require('../../../assets/images/drp-blue-blur-bg.png');

/**
 * The Clearway page field — a pale base tinted by a large, soft blue blur image
 * (`drp-blue-blur-bg.png`), `cover`-scaled to fill the screen. Static (no
 * animation) — deliberately, to avoid motion/over-stimulation for the app's
 * neurodivergent users.
 *
 * Each screen mounts its OWN background and renders over it with a transparent
 * surface; the bottom-tab navigator does not detach inactive screens on web, so a
 * shared transparent background would let screens bleed through each other.
 */
export function GradientBackground() {
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: MESH.base }]} pointerEvents="none">
      <Image
        source={BLUR_BG}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={0}
      />
    </View>
  );
}
