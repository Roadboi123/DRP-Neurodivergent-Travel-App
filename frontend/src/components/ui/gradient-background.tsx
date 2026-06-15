import { Platform, StyleSheet, View } from 'react-native';

import { MESH } from '@/constants/theme';

/**
 * The Clearway page field — a pale blue-grey base with a few large, diffuse
 * pastel "mesh" blobs glowing from the corners (blue / lilac / peach), mirroring
 * the deck. Static (no animation) — deliberately, to avoid motion/over-stimulation
 * for the app's neurodivergent users.
 *
 * Each screen mounts its OWN background and renders over it with a transparent
 * surface; the bottom-tab navigator does not detach inactive screens on web, so a
 * shared transparent background would let screens bleed through each other.
 *
 * Blobs are big soft-edged circles. On web they get a real CSS `blur()` for the
 * frosted-mesh look (our screenshot/Vercel target); on native the large radius +
 * low opacity over the base reads as a soft tint without needing a blur layer.
 */
export function GradientBackground() {
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: MESH.base }]} pointerEvents="none">
      {MESH.blobs.map((blob, i) => (
        <View
          key={i}
          style={[
            styles.blob,
            {
              width: blob.size,
              height: blob.size,
              borderRadius: blob.size / 2,
              top: blob.top as any,
              left: blob.left as any,
              backgroundColor: blob.color,
              opacity: blob.opacity,
            },
            Platform.OS === 'web' ? ({ filter: 'blur(110px)' } as any) : null,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  blob: {
    position: 'absolute',
  },
});
