import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { StyleSheet } from 'react-native';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { CLEARWAY, ClearwayFonts, GLASS, getAccents, getPalette, softShadow } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useNavBar } from '@/contexts/navbar-context';

export default function TabLayout() {
  const isDark = useColorScheme() === 'dark';
  const palette = getPalette(isDark);
  const accents = getAccents(isDark);
  // The route-details modal (rendered inside the routes tab) hides the pill so
  // it doesn't bleed over that full-screen view on web.
  const { hidden } = useNavBar();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarActiveTintColor: CLEARWAY.blueStrong,
        tabBarInactiveTintColor: palette.textMuted,
        tabBarLabelStyle: {
          fontFamily: ClearwayFonts.semibold,
          fontSize: 11,
          letterSpacing: 0.2,
        },
        // Floating frosted-glass pill, letting users move between Home, Routes
        // and Preferences. The blur sits behind a translucent fill (set on the
        // tabBarStyle). Hidden entirely while a screen opts out (e.g. the
        // route-details modal).
        tabBarBackground: hidden
          ? undefined
          : () => (
              <BlurView
                intensity={GLASS.light.blur}
                tint="light"
                style={[StyleSheet.absoluteFill, { borderRadius: 33, overflow: 'hidden' }]}
              />
            ),
        tabBarStyle: hidden
          ? { display: 'none' }
          : {
              position: 'absolute',
              left: 16,
              right: 16,
              bottom: 16,
              height: 66,
              borderRadius: 33,
              backgroundColor: GLASS.light.fill,
              borderWidth: 1,
              borderTopWidth: 1,
              borderColor: GLASS.light.border,
              paddingTop: 8,
              paddingBottom: 8,
              ...softShadow(3),
            },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Ionicons name="home" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="routes"
        options={{
          title: 'Routes',
          tabBarIcon: ({ color }) => <Ionicons name="navigate" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="preferences"
        options={{
          title: 'Preferences',
          tabBarIcon: ({ color }) => <Ionicons name="settings-sharp" size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}
