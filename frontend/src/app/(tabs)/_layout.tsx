import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { BRAND, Fonts, hardShadow } from '@/constants/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarActiveTintColor: BRAND.pink,
        tabBarInactiveTintColor: BRAND.ink,
        tabBarLabelStyle: {
          fontFamily: Fonts?.display,
          fontSize: 10,
          fontWeight: '800',
          textTransform: 'uppercase',
          letterSpacing: 0.3,
        },
        // Floating Wero pill: white, ink-outlined, hard offset shadow.
        tabBarStyle: {
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: 16,
          height: 66,
          borderRadius: 33,
          backgroundColor: BRAND.white,
          borderWidth: 2,
          borderTopWidth: 2,
          borderColor: BRAND.ink,
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
