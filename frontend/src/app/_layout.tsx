import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { ServicesProvider } from '@/services/services-context';
import { Palette } from '@/constants/theme';
import { AuthProvider } from '@/context/auth-context';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const customTheme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      background: isDark ? Palette.dark.background : Palette.light.background,
      card: isDark ? Palette.dark.surface : Palette.light.surface,
      border: isDark ? Palette.dark.border : Palette.light.border,
    },
  };

  return (
    <ServicesProvider>
      <AuthProvider>
        <ThemeProvider value={customTheme}>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          </Stack>
          <StatusBar style="auto" />
        </ThemeProvider>
      </AuthProvider>
    </ServicesProvider>
  );
}

