import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { Fonts, getAccents, getPalette, hardShadow } from '@/constants/theme';
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
        tabBarActiveTintColor: accents.pink,
        tabBarInactiveTintColor: palette.textMuted,
        tabBarLabelStyle: {
          fontFamily: Fonts?.display,
          fontSize: 10,
          fontWeight: '800',
          textTransform: 'uppercase',
          letterSpacing: 0.3,
        },
        // Floating Wero pill: outlined surface with a hard offset shadow,
        // letting users move between Home, Routes and Preferences. Hidden
        // entirely while a screen opts out (e.g. the route-details modal).
        tabBarStyle: hidden
          ? { display: 'none' }
          : {
              position: 'absolute',
              left: 16,
              right: 16,
              bottom: 16,
              height: 66,
              borderRadius: 33,
              backgroundColor: palette.surface,
              borderWidth: 2,
              borderTopWidth: 2,
              borderColor: palette.border,
              paddingTop: 8,
              paddingBottom: 8,
              ...hardShadow(6),
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
