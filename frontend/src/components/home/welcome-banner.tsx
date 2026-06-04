import { StyleSheet, Text, View } from 'react-native';

import { BRAND, Fonts, getPalette, hardShadow } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function WelcomeBanner() {
  const isDark = useColorScheme() === 'dark';
  const palette = getPalette(isDark);

  return (
    <View style={[styles.bannerCard, { backgroundColor: BRAND.cyan, borderColor: palette.border }]}>
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
    borderRadius: 14,
    borderWidth: 2,
    padding: 20,
    marginBottom: 24,
    ...hardShadow(6),
  },
  bannerTitle: {
    fontSize: 20,
    fontFamily: Fonts?.display,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: -0.2,
    marginBottom: 6,
  },
  bannerDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
});
