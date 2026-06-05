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
import { PreferencesGuideSheet } from '@/components/preferences/preferences-guide-sheet';
import { PresetSwitcher } from '@/components/preferences/preset-switcher';
import { PresetNameEditor } from '@/components/preferences/preset-name-editor';
import { GradientBackground } from '@/components/ui/gradient-background';
import { HeaderNav } from '@/components/ui/header-nav';
import { Fonts, getPalette, hardShadow } from '@/constants/theme';
import { SENSORY_KEYS, SENSORY_META, type SensoryKey } from '@/constants/presets';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { usePresets } from '@/context/presets-context';
import { useAuth } from '@/context/auth-context';
import type { Preference, SensitivityLevel } from '@/types/preference';

export default function UserPreferencesScreen() {
  const { isLoggedIn, setProfileModalVisible } = useAuth();
  const { values, activeId, loading, saveStatus, setPresetValue } = usePresets();
  const [guideVisible, setGuideVisible] = useState(false);
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
            <Text style={[styles.title, { color: palette.textPrimary, fontFamily: Fonts?.rounded }]}>
              Your preferences
            </Text>

            <TouchableOpacity
              onPress={() => setGuideVisible(true)}
              hitSlop={10}
              style={styles.infoButton}
              accessibilityLabel="About your preferences">
              <Ionicons name="information-circle-outline" size={26} color={palette.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {!isLoggedIn ? (
          <View style={[styles.splashContainer, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <View style={[styles.iconCircle, { backgroundColor: isDark ? '#2E3543' : '#F0F0EE' }]}>
              <Ionicons name="options-outline" size={36} color="#E91E63" />
            </View>
            <Text style={[styles.splashTitle, { color: palette.textPrimary }]}>
              Sign in to customize
            </Text>
            <Text style={[styles.splashDesc, { color: palette.textSecondary }]}>
              Create an account or sign in to set your comfort levels for noise, crowds, temperature, and more. Your preferences will be saved to your profile and applied automatically to all planned routes.
            </Text>
            
            <TouchableOpacity
              style={[styles.loginBtn, { backgroundColor: '#E91E63' }]}
              onPress={() => setProfileModalVisible(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.loginBtnText}>Sign In / Register</Text>
            </TouchableOpacity>
          </View>
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
                  { backgroundColor: palette.surface, borderColor: palette.border },
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

            <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              {preferences.map((pref, i) => (
                <View key={pref.id}>
                  <PreferenceRow preference={pref} onSelect={handleSelect} />

                  {i < preferences.length - 1 && (
                    <View style={[styles.rowDivider, { backgroundColor: palette.divider }]} />
                  )}
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      <PreferencesGuideSheet visible={guideVisible} onClose={() => setGuideVisible(false)} />
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },

  title: {
    flex: 1,
    fontSize: 34,
    fontFamily: Fonts?.display,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: -1,
  },

  infoButton: {
    marginTop: 6,
  },

  sectionTitle: {
    fontSize: 17,
    fontFamily: Fonts?.display,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
    marginBottom: 12,
  },

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
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 2,
    ...hardShadow(3),
  } as ViewStyle,

  renameButtonLabel: {
    fontSize: 12,
    fontFamily: Fonts?.display,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
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
    borderRadius: 14,
    borderWidth: 2,
    paddingVertical: 8,
    paddingHorizontal: 16,
    ...hardShadow(6),
  },

  rowDivider: {
    height: 1,
  } as ViewStyle,

  // Splash styling
  splashContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
    borderRadius: 24,
    borderWidth: 1,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  } as ViewStyle,

  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  } as ViewStyle,

  splashTitle: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 12,
  } as TextStyle,

  splashDesc: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
  } as TextStyle,

  loginBtn: {
    width: '100%',
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#E91E63',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  } as ViewStyle,

  loginBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  } as TextStyle,

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

