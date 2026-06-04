import { DefaultTheme, ThemeProvider } from '@react-navigation/native';
import {
  Archivo_500Medium,
  Archivo_700Bold,
  Archivo_800ExtraBold,
  Archivo_900Black,
  useFonts,
} from '@expo-google-fonts/archivo';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { BRAND } from '@/constants/theme';
import { ServicesProvider } from '@/services/services-context';

export const unstable_settings = {
  anchor: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

// Light-only Wero theme. Each screen paints its own opaque gradient (see
// GradientBackground), so the navigator base is just a solid on-brand fallback
// — NOT transparent, which let inactive screens bleed through on react-native-web.
const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: BRAND.yellow },
};

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Archivo_500Medium,
    Archivo_700Bold,
    Archivo_800ExtraBold,
    Archivo_900Black,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ServicesProvider>
      <ThemeProvider value={navTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
        <StatusBar style="dark" />
      </ThemeProvider>
    </ServicesProvider>
  );
}
