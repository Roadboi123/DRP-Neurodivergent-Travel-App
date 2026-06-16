import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { PreferenceRow } from '@/components/preferences/preference-row';
import { PreferenceScaleLegend } from '@/components/preferences/preference-scale-legend';
import { PresetSwitcher } from '@/components/preferences/preset-switcher';
import { PresetNameEditor } from '@/components/preferences/preset-name-editor';
import { GradientBackground } from '@/components/ui/gradient-background';
import { Glass } from '@/components/ui/glass';
import { GlassButton } from '@/components/ui/glass-button';
import { GradientDot } from '@/components/ui/gradient-dot';
import { HeaderNav } from '@/components/ui/header-nav';
import { CLEARWAY, Fonts, getPalette, Radii, softShadow } from '@/constants/theme';
import { SENSORY_KEYS, SENSORY_META, type SensoryKey } from '@/constants/presets';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { usePresets } from '@/context/presets-context';
import { useAuth } from '@/context/auth-context';
import type { Preference, SensitivityLevel } from '@/types/preference';

export default function UserPreferencesScreen() {
  const { isLoggedIn, setProfileModalVisible } = useAuth();
  const { values, activeId, loading, saveStatus, setPresetValue } = usePresets();
  const [renaming, setRenaming] = useState(false);

  const isDark = useColorScheme() === 'dark';
  const palette = getPalette(isDark);

  // Rows reflect the currently-selected preset's values; editing one writes
  // back to that preset.
  const preferences = useMemo<Preference[]>(
    () =>
      SENSORY_KEYS.map((key) => ({
        id: key,
        label: SENSORY_META[key].label,
        emoji: SENSORY_META[key].emoji,
        value: values[key],
      })),
    [values]
  );

  const handleSelect = (id: string, value: SensitivityLevel) => {
    setPresetValue(activeId, id as SensoryKey, value);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: palette.background }]}>
      <GradientBackground />
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={palette.background}
      />

      <HeaderNav onProfilePress={() => setProfileModalVisible(true)} />

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: palette.textPrimary }]}>
              Your preferences
            </Text>
            <GradientDot size={16} style={styles.titleDot} />
          </View>
        </View>

        {!isLoggedIn ? (
          <Glass radius={Radii.cardLg} shadow={2} style={styles.splashWrap}>
            <View style={styles.splashContainer}>
              <View style={[styles.iconCircle, { backgroundColor: palette.surface, borderColor: palette.border }]}>
                <Ionicons name="options-outline" size={34} color={CLEARWAY.blueStrong} />
              </View>
              <Text style={[styles.splashTitle, { color: palette.textPrimary }]}>
                Sign in to customize
              </Text>
              <Text style={[styles.splashDesc, { color: palette.textSecondary }]}>
                Create an account or sign in to set your comfort levels for noise, crowds, temperature, and more. Your preferences will be saved to your profile and applied automatically to all planned routes.
              </Text>

              <GlassButton
                label="Sign In / Register"
                variant="primary"
                fullWidth
                onPress={() => setProfileModalVisible(true)}
                style={styles.loginBtn}
              />
            </View>
          </Glass>
        ) : (
          <>
            <View style={styles.presetHeaderRow}>
              <Text style={[styles.sectionTitle, { color: palette.textPrimary, marginBottom: 0 }]}>
                Select preset profile
              </Text>
              <TouchableOpacity
                onPress={() => setRenaming((r) => !r)}
                accessibilityRole="button"
                accessibilityLabel={renaming ? 'Finish renaming presets' : 'Rename presets'}
                style={[
                  styles.renameButton,
                  { backgroundColor: palette.surface, borderColor: palette.borderStrong },
                ]}>
                <Ionicons
                  name={renaming ? 'checkmark' : 'pencil'}
                  size={13}
                  color={palette.textPrimary}
                />
                <Text style={[styles.renameButtonLabel, { color: palette.textPrimary }]}>
                  {renaming ? 'Done' : 'Edit names'}
                </Text>
              </TouchableOpacity>
            </View>
            <PresetSwitcher />

            {renaming && <PresetNameEditor />}

            <View style={[styles.loggedInHeaderRow, styles.rowsHeader]}>
              <Text style={[styles.sectionTitle, { color: palette.textPrimary, marginBottom: 0 }]}>
                How much do these affect you?
              </Text>
              
              {loading && (
                <Text style={[styles.statusText, { color: palette.textMuted }]}>
                  Loading preferences…
                </Text>
              )}
              {!loading && saveStatus === 'saving' && (
                <Text style={[styles.statusText, { color: palette.textMuted }]}>Saving…</Text>
              )}
              {!loading && saveStatus === 'saved' && (
                <Text style={[styles.statusText, styles.statusSaved]}>✓ Saved</Text>
              )}
              {!loading && saveStatus === 'error' && (
                <Text style={[styles.statusText, styles.statusError]}>Couldn’t save — try again</Text>
              )}
            </View>

            <Text style={[styles.sectionHelper, { color: palette.textSecondary }]}>
              Higher means we work harder to route you around it. Tap a level for each below.
            </Text>

            <PreferenceScaleLegend />

            <Glass radius={Radii.card} shadow={2}>
              <View style={styles.card}>
                {preferences.map((pref, i) => (
                  <View key={pref.id}>
                    <PreferenceRow preference={pref} onSelect={handleSelect} />

                    {i < preferences.length - 1 && (
                      <View style={[styles.rowDivider, { backgroundColor: palette.divider }]} />
                    )}
                  </View>
                ))}
              </View>
            </Glass>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  } as ViewStyle,

  container: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 100,
  },

  // Header
  header: {
    marginBottom: 20,
  } as ViewStyle,

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  title: {
    fontSize: 38,
    fontFamily: Fonts?.display,
    fontWeight: '800',
    letterSpacing: -1.3,
  },

  titleDot: {
    marginTop: 14,
  },

  sectionTitle: {
    fontSize: 19,
    fontFamily: Fonts?.display,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginBottom: 12,
  },

  sectionHelper: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    marginTop: -4,
    marginBottom: 12,
  } as TextStyle,

  presetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  } as ViewStyle,

  renameButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    ...softShadow(1),
  } as ViewStyle,

  renameButtonLabel: {
    fontSize: 13,
    fontFamily: Fonts?.body,
    fontWeight: '700',
    letterSpacing: 0.1,
  } as TextStyle,

  statusText: {
    fontSize: 13,
  } as TextStyle,

  statusSaved: {
    color: '#1D9E75',
    fontWeight: '600',
  } as TextStyle,

  statusError: {
    color: '#C0392B',
    fontWeight: '600',
  } as TextStyle,

  // Card
  card: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },

  rowDivider: {
    height: 1,
  } as ViewStyle,

  // Splash styling
  splashWrap: {
    marginTop: 20,
  } as ViewStyle,

  splashContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  } as ViewStyle,

  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
  } as ViewStyle,

  splashTitle: {
    fontSize: 22,
    fontFamily: Fonts?.display,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center',
    marginBottom: 12,
  } as TextStyle,

  splashDesc: {
    fontSize: 14,
    fontFamily: Fonts?.body,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
  } as TextStyle,

  loginBtn: {
    width: '100%',
  } as ViewStyle,

  loggedInHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 8,
  } as ViewStyle,

  rowsHeader: {
    marginTop: 28,
  } as ViewStyle,
});

