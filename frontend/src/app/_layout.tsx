import { DefaultTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
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
import { Platform } from 'react-native';
import 'react-native-reanimated';
import * as Notifications from 'expo-notifications';

import { BRAND } from '@/constants/theme';
import { ThemeProvider } from '@/contexts/theme-context';
import { NavBarProvider } from '@/contexts/navbar-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ServicesProvider } from '@/services/services-context';
import { AuthProvider, useAuth } from '@/context/auth-context';
import { PresetsProvider } from '@/context/presets-context';
import { ProfileModal } from '@/components/profile/profile-modal';
import { requestNotificationPermissions } from '@/services/notifications';
import { analytics } from '@/services/analytics';

export const unstable_settings = {
  anchor: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

// Each screen paints its own gradient (see GradientBackground), so the
// navigator base is just a solid fallback — NOT transparent, which let inactive
// screens bleed through on react-native-web. Pick an on-brand fallback per scheme.
const navThemeLight = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: BRAND.yellow },
};
const navThemeDark = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: '#0d1426' },
};

// Inner tree so it can read the in-app theme context for the nav base + status bar.
function ThemedApp() {
  const isDark = useColorScheme() === 'dark';
  const { isProfileModalVisible, setProfileModalVisible } = useAuth();
  
  return (
    <NavThemeProvider value={isDark ? navThemeDark : navThemeLight}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="journey" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ProfileModal
        visible={isProfileModalVisible}
        onClose={() => setProfileModalVisible(false)}
      />
    </NavThemeProvider>
  );
}

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
      requestNotificationPermissions().catch((e) => {
        console.warn('Failed to request notification permissions:', e);
      });
    }
  }, [fontsLoaded]);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('[Notifications] Notification response received (tap):', response);
      analytics.trackWarningInteraction();
    });

    return () => {
      subscription.remove();
    };
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ServicesProvider>
      <AuthProvider>
        <PresetsProvider>
          <ThemeProvider>
            <NavBarProvider>
              <ThemedApp />
            </NavBarProvider>
          </ThemeProvider>
        </PresetsProvider>
      </AuthProvider>
    </ServicesProvider>
  );
}
