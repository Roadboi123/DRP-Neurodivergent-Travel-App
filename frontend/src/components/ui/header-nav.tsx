import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { getPalette, hardShadow } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemeToggle } from '@/components/ui/theme-toggle';

/** Top bar: Back + Home circular buttons on the left, theme toggle on the right. */
export function HeaderNav() {
  const isDark = useColorScheme() === 'dark';
  const palette = getPalette(isDark);
  const btnStyle = [
    styles.iconBtn,
    { backgroundColor: palette.surface, borderColor: palette.border },
    hardShadow(4),
  ];

  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityLabel="Go back"
          style={btnStyle}>
          <Ionicons name="arrow-back" size={20} color={palette.textPrimary} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.replace('/')}
          accessibilityLabel="Go home"
          style={btnStyle}>
          <Ionicons name="home-outline" size={20} color={palette.textPrimary} />
        </TouchableOpacity>
      </View>
      <ThemeToggle />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
});
