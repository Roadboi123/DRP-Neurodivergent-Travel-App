import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { BRAND, getPalette, hardShadow } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

/** Back + Home circular icon buttons shown at the top of a screen. */
export function HeaderNav() {
  const isDark = useColorScheme() === 'dark';
  const palette = getPalette(isDark);

  return (
    <View style={styles.row}>
      <TouchableOpacity
        onPress={() => router.back()}
        accessibilityLabel="Go back"
        style={styles.iconBtn}>
        <Ionicons name="arrow-back" size={20} color={palette.textPrimary} />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => router.replace('/')}
        accessibilityLabel="Go home"
        style={styles.iconBtn}>
        <Ionicons name="home-outline" size={20} color={palette.textPrimary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BRAND.white,
    borderWidth: 2,
    borderColor: BRAND.ink,
    ...hardShadow(4),
  },
});
