import { Ionicons } from '@expo/vector-icons';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { getOptionColors, OPTIONS } from '@/components/preferences/options';
import { getPalette } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

// Spell out exactly what each level does to a route, keyed by the contract value
// so it stays aligned with OPTIONS even if the labels are reworded. Being concrete
// (rather than "affects you a bit") was direct user feedback.
const LEVEL_GLOSS: Record<string, string> = {
  little: 'we do not avoid this',
  medium: 'we avoid more than 30 mins of this on a route where possible',
  high: 'we avoid more than 15 mins of this on a route where possible',
  veryhigh: 'we avoid this entirely where possible',
};

export function PreferencesGuideSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const isDark = useColorScheme() === 'dark';
  const palette = getPalette(isDark);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Stop backdrop taps from closing when they land on the sheet itself */}
        <Pressable
          style={[styles.sheet, { backgroundColor: palette.surface }]}
          onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={[styles.title, { color: palette.textPrimary }]}>
              About your preferences
            </Text>

            <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityLabel="Close guide">
              <Ionicons name="close" size={24} color={palette.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={[styles.body, { color: palette.textSecondary }]}>
              Tell us how much everyday things affect you on a journey. We use this to suggest
              calmer routes.
            </Text>

            <Text style={[styles.sectionHeading, { color: palette.textPrimary }]}>
              What each level means
            </Text>

            {OPTIONS.map((option) => {
              const colors = getOptionColors(option.value, isDark);
              return (
                <View key={option.value} style={styles.levelRow}>
                  <View
                    style={[
                      styles.levelChip,
                      { backgroundColor: colors.bg, borderColor: colors.border },
                    ]}>
                    <Text style={[styles.levelChipText, { color: colors.text }]}>
                      {option.label}
                    </Text>
                  </View>

                  <Text style={[styles.levelGloss, { color: palette.textSecondary }]}>
                    {LEVEL_GLOSS[option.value]}
                  </Text>
                </View>
              );
            })}

            <Text style={[styles.sectionHeading, { color: palette.textPrimary }]}>
              How it shapes your routes
            </Text>
            <Text style={[styles.body, { color: palette.textSecondary }]}>
              The more something affects you, the more we steer you away from routes with that
              trigger. Lower ratings count for less.
            </Text>

            <Text style={[styles.sectionHeading, { color: palette.textPrimary }]}>Your privacy</Text>
            <Text style={[styles.body, { color: palette.textSecondary }]}>
              Your answers are saved against your username and you can change them anytime.
            </Text>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '80%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 32,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#9993',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '700',
    marginTop: 18,
    marginBottom: 8,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  levelChip: {
    minWidth: 84,
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  levelChipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  levelGloss: {
    flex: 1,
    fontSize: 14,
    lineHeight: 19,
  },
});
