import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View, type ViewStyle } from 'react-native';

import {
  PRESET_NAMES,
  PRESET_NAME_MAX_LENGTH,
  presetDisplayName,
} from '@/constants/presets';
import { Glass } from '@/components/ui/glass';
import { Fonts, getPalette, Radii } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { usePresets } from '@/context/presets-context';

/**
 * Inline editor for the three preset NAMES (e.g. rename "Preset 1" → "Good Day").
 * Shown only when the user turns on rename mode on the preferences screen. Edits
 * are kept in a local draft and committed (persisted) when a field loses focus or
 * is submitted, so we don't save on every keystroke.
 */
export function PresetNameEditor() {
  const isDark = useColorScheme() === 'dark';
  const palette = getPalette(isDark);
  const { presets, setPresetName } = usePresets();

  // Local drafts keyed by preset id; seeded from the saved names.
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(presets.map((p) => [p.id, presetDisplayName(p)]))
  );

  // Keep drafts in sync if the presets reload (e.g. user switch).
  useEffect(() => {
    setDrafts(Object.fromEntries(presets.map((p) => [p.id, presetDisplayName(p)])));
  }, [presets]);

  const commit = (id: string) => {
    const next = (drafts[id] ?? '').trim();
    const preset = presets.find((p) => p.id === id);
    // Fall back to the slot default when cleared, and skip a no-op save.
    const finalName = next || PRESET_NAMES[id as keyof typeof PRESET_NAMES];
    if (preset && finalName !== presetDisplayName(preset)) {
      setPresetName(preset.id, finalName);
    }
    if (next !== drafts[id]) {
      setDrafts((d) => ({ ...d, [id]: finalName }));
    }
  };

  return (
    <Glass radius={Radii.card} shadow={2} style={styles.card}>
      <View style={styles.inner}>
      <Text style={[styles.heading, { color: palette.textPrimary }]}>Rename presets</Text>
      <Text style={[styles.subtitle, { color: palette.textMuted }]}>
        Give each preset a name that means something to you.
      </Text>

      {presets.map((preset, i) => (
        <View
          key={preset.id}
          style={[
            styles.row,
            i < presets.length - 1 && { borderBottomColor: palette.divider, borderBottomWidth: 1 },
          ]}>
          <Text style={[styles.slotLabel, { color: palette.textMuted }]}>
            {PRESET_NAMES[preset.id]}
          </Text>
          <TextInput
            style={[
              styles.input,
              { color: palette.textPrimary, backgroundColor: 'rgba(255,255,255,0.5)', borderColor: palette.border },
            ]}
            value={drafts[preset.id] ?? ''}
            onChangeText={(text) => setDrafts((d) => ({ ...d, [preset.id]: text }))}
            onBlur={() => commit(preset.id)}
            onSubmitEditing={() => commit(preset.id)}
            placeholder={PRESET_NAMES[preset.id]}
            placeholderTextColor={palette.textMuted}
            maxLength={PRESET_NAME_MAX_LENGTH}
            returnKeyType="done"
            accessibilityLabel={`Rename ${PRESET_NAMES[preset.id]}`}
          />
        </View>
      ))}
      </View>
    </Glass>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 20,
  } as ViewStyle,
  inner: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  heading: {
    fontSize: 15,
    fontFamily: Fonts?.display,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12.5,
    fontFamily: Fonts?.body,
    fontWeight: '500',
    marginTop: 2,
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  } as ViewStyle,
  slotLabel: {
    width: 64,
    fontSize: 11,
    fontFamily: Fonts?.semibold,
    fontWeight: '700',
    letterSpacing: 0,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: Fonts?.body,
    fontWeight: '600',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: Radii.input,
    borderWidth: 1,
  },
});
