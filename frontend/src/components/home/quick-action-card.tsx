import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { getPalette } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface QuickActionCardProps {
  iconName: React.ComponentProps<typeof Ionicons>['name'];
  iconColor: string;
  iconBackground: string;
  title: string;
  description: string;
  onPress: () => void;
}

export function QuickActionCard({
  iconName,
  iconColor,
  iconBackground,
  title,
  description,
  onPress,
}: QuickActionCardProps) {
  const isDark = useColorScheme() === 'dark';
  const palette = getPalette(isDark);

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.gridCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <View style={[styles.iconContainer, { backgroundColor: iconBackground }]}>
        <Ionicons name={iconName} size={24} color={iconColor} />
      </View>
      <Text style={[styles.cardTitleText, { color: palette.textPrimary }]}>{title}</Text>
      <Text style={[styles.cardDescText, { color: palette.textMuted }]}>{description}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  gridCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 16,
    alignItems: 'flex-start',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 2,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  cardTitleText: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  cardDescText: {
    fontSize: 11,
    lineHeight: 14,
  },
});
