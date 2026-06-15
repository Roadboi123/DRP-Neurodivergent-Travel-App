import { DefaultTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import {
  HankenGrotesk_400Regular,
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
  HankenGrotesk_700Bold,
  HankenGrotesk_800ExtraBold,
  HankenGrotesk_900Black,
  useFonts,
} from '@expo-google-fonts/hanken-grotesk';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import 'react-native-reanimated';
import * as Notifications from 'expo-notifications';

import { CLEARWAY } from '@/constants/theme';
import { ThemeProvider } from '@/contexts/theme-context';
import { NavBarProvider } from '@/contexts/navbar-context';
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

// Each screen paints its own mesh background (see GradientBackground), so the
// navigator base is just a solid fallback — NOT transparent, which let inactive
// screens bleed through on react-native-web. Use the Clearway field colour.
const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: CLEARWAY.bgBase },
};

// Inner tree (kept so it can mount the profile modal over the nav stack).
function ThemedApp() {
  const { isProfileModalVisible, setProfileModalVisible } = useAuth();

  return (
    <NavThemeProvider value={navTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="journey" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="dark" />
      <ProfileModal
        visible={isProfileModalVisible}
        onClose={() => setProfileModalVisible(false)}
      />
    </NavThemeProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    HankenGrotesk_400Regular,
    HankenGrotesk_500Medium,
    HankenGrotesk_600SemiBold,
    HankenGrotesk_700Bold,
    HankenGrotesk_800ExtraBold,
    HankenGrotesk_900Black,
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
