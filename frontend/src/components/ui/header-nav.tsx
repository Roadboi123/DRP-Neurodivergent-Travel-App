import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { getPalette } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

/** Back + Home circular icon buttons shown at the top of a screen. */
export function HeaderNav() {
  const isDark = useColorScheme() === 'dark';
  const palette = getPalette(isDark);
  const buttonBg = isDark ? '#2E3543' : '#F0F0EE';

  return (
    <View style={styles.row}>
      <TouchableOpacity
        onPress={() => router.back()}
        accessibilityLabel="Go back"
        style={[styles.iconBtn, { backgroundColor: buttonBg }]}>
        <Ionicons name="arrow-back" size={20} color={palette.textPrimary} />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => router.replace('/')}
        accessibilityLabel="Go home"
        style={[styles.iconBtn, { backgroundColor: buttonBg }]}>
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
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
