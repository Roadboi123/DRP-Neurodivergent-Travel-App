import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View, type ViewStyle } from 'react-native';

import {
  PRESET_NAMES,
  PRESET_NAME_MAX_LENGTH,
  presetDisplayName,
} from '@/constants/presets';
import { Fonts, getPalette, hardShadow } from '@/constants/theme';
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
    <View
      style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
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
              { color: palette.textPrimary, backgroundColor: palette.background, borderColor: palette.border },
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
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 2,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
    ...hardShadow(6),
  } as ViewStyle,
  heading: {
    fontSize: 13,
    fontFamily: Fonts?.display,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '600',
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
    fontSize: 10,
    fontFamily: Fonts?.display,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.2,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: Fonts?.body,
    fontWeight: '600',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 2,
  },
});
