import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { getAccents, getPalette, hardShadow } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { useAuth } from '@/context/auth-context';

export interface HeaderNavProps {
  onProfilePress?: () => void;
}

/** Top bar: Back + Home circular buttons on the left, theme toggle + profile on the right. */
export function HeaderNav({ onProfilePress }: HeaderNavProps) {
  const isDark = useColorScheme() === 'dark';
  const palette = getPalette(isDark);
  const accents = getAccents(isDark);
  const { isLoggedIn } = useAuth();
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
      <View style={styles.right}>
        <ThemeToggle />
        {onProfilePress && (
          <TouchableOpacity
            onPress={onProfilePress}
            accessibilityLabel="Open profile modal"
            style={btnStyle}>
            <Ionicons
              name={isLoggedIn ? "person" : "person-outline"}
              size={18}
              color={isLoggedIn ? accents.pink : palette.textPrimary}
            />
            {isLoggedIn && <View style={[styles.profileActiveDot, { backgroundColor: accents.green, borderColor: palette.surface }]} />}
          </TouchableOpacity>
        )}
      </View>
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
  right: {
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
    position: 'relative',
  },
  profileActiveDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1.5,
  },
});
