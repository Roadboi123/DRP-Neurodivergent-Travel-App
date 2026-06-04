import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { Fonts, getPalette, hardShadow } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface QuickActionCardProps {
  iconName: React.ComponentProps<typeof Ionicons>['name'];
  iconColor: string;
  iconBackground: string;
  title: string;
  description: string;
  onPress: () => void;
  style?: any;
}

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
    <TouchableOpacity
      onPress={onPress}
      style={[styles.gridCard, { backgroundColor: palette.surface, borderColor: palette.border }, style]}>
      <View
        style={[
          styles.iconContainer,
          { backgroundColor: iconBackground, borderColor: palette.border },
        ]}>
        <Ionicons name={iconName} size={24} color={iconColor} />
      </View>
      <Text style={[styles.cardTitleText, { color: palette.textPrimary }]}>{title}</Text>
      <Text style={[styles.cardDescText, { color: palette.textMuted }]}>{description}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  gridCard: {
    flex: 0.5,
    borderRadius: 14,
    borderWidth: 2,
    padding: 16,
    alignItems: 'flex-start',
    ...hardShadow(6),
  },
  iconContainer: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    borderWidth: 2,
  },
  cardTitleText: {
    fontSize: 15,
    fontFamily: Fonts?.display,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
    marginBottom: 4,
  },
  cardDescText: {
    fontSize: 11,
    lineHeight: 14,
  },
});
