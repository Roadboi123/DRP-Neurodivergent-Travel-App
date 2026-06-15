import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Glass } from '@/components/ui/glass';
import { CLEARWAY, Fonts, getPalette, Radii } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface QuickActionCardProps {
  iconName: React.ComponentProps<typeof Ionicons>['name'];
  iconColor: string;
  iconBackground: string;
  title: string;
  description: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

/** A frosted-glass action card (Clearway). The icon sits in a soft tinted tile. */
export function QuickActionCard({
  iconName,
  iconColor,
  iconBackground,
  title,
  description,
  onPress,
  style,
}: QuickActionCardProps) {
  const isDark = useColorScheme() === 'dark';
  const palette = getPalette(isDark);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [pressed && styles.pressed, style]}>
      <Glass radius={Radii.card} shadow={2}>
        <View style={styles.inner}>
          <View style={[styles.iconContainer, { backgroundColor: iconBackground }]}>
            <Ionicons name={iconName} size={24} color={iconColor} />
          </View>
          <Text style={[styles.cardTitleText, { color: palette.textPrimary }]}>{title}</Text>
          <Text style={[styles.cardDescText, { color: palette.textMuted }]}>{description}</Text>
        </View>
      </Glass>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { transform: [{ scale: 0.985 }], opacity: 0.9 },
  inner: {
    padding: 18,
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  cardTitleText: {
    fontSize: 18,
    fontFamily: Fonts?.display,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginBottom: 4,
    color: CLEARWAY.heading,
  },
  cardDescText: {
    fontSize: 13,
    fontFamily: Fonts?.body,
    lineHeight: 17,
  },
});
