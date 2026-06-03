import { StyleSheet, Text, View } from 'react-native';

import { getPalette } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function WelcomeBanner() {
  const isDark = useColorScheme() === 'dark';
  const palette = getPalette(isDark);

  return (
    <View style={[styles.bannerCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <Text style={[styles.bannerTitle, { color: palette.textPrimary }]}>
        Your Sensory Safe Space
      </Text>
      <Text style={[styles.bannerDesc, { color: palette.textSecondary }]}>
        {"Let's find quieter, cooler, and less crowded routes tailored precisely to your sensory profile."}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bannerCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 3,
  },
  bannerTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
  },
  bannerDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
});
