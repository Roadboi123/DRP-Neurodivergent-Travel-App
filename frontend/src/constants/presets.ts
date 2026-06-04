import type { SensitivityLevel } from '@/types/preference';

/**
 * Sensory dimensions a user can be sensitive to. These keys line up 1:1 with the
 * backend's `SensitivityPreferences` request body (see `services/preferences.ts`),
 * so a `PresetValues` object can be spread straight into a save payload.
 */
export type SensoryKey = 'noise' | 'crowds' | 'temperature' | 'smell' | 'lights';

export const SENSORY_KEYS: SensoryKey[] = [
  'noise',
  'crowds',
  'temperature',
  'smell',
  'lights',
];

/** The three switchable tolerance presets, ordered calmest-need last. */
export type PresetId = 'good' | 'medium' | 'bad';

/** A complete set of sensitivities (every dimension set) backing one preset. */
export type PresetValues = Record<SensoryKey, SensitivityLevel>;

/**
 * Current working sensitivities. Mirrors `PresetValues` but allows `null` so a
 * user can still part-fill the preferences screen (matching the pre-presets
 * behaviour where the backend save only fires once all five are set).
 */
export type ActiveValues = Record<SensoryKey, SensitivityLevel | null>;

export const EMPTY_VALUES: ActiveValues = {
  noise: null,
  crowds: null,
  temperature: null,
  smell: null,
  lights: null,
};

export interface Preset {
  id: PresetId;
  /** Short label shown on the switcher chip. */
  name: string;
  emoji: string;
  /** One-line hint about what the preset does to routes. */
  description: string;
  values: PresetValues;
}

/**
 * Built-in presets, mapping "how is your day going" to a tolerance profile.
 * Sensitivity labels read as "how much does this affect you" — so a *good* day
 * (high tolerance) sets everything low, a *bad* day (low tolerance) sets it high,
 * which pushes route scoring toward calmer options. Users fine-tune per-row from
 * here; tweaks become a "Custom" state without rewriting the preset.
 */
const allOf = (level: SensitivityLevel): PresetValues => ({
  noise: level,
  crowds: level,
  temperature: level,
  smell: level,
  lights: level,
});

export const PRESETS: Preset[] = [
  {
    id: 'good',
    name: 'Good day',
    emoji: '☀️',
    description: 'Higher tolerance — fewer routes filtered out',
    values: allOf('little'),
  },
  {
    id: 'medium',
    name: 'Medium day',
    emoji: '⛅',
    description: 'A balanced sensory profile',
    values: allOf('medium'),
  },
  {
    id: 'bad',
    name: 'Bad day',
    emoji: '🌧️',
    description: 'Low tolerance — favours the calmest routes',
    values: allOf('high'),
  },
];

export const getPreset = (id: PresetId): Preset =>
  PRESETS.find((p) => p.id === id) ?? PRESETS[1];

/**
 * Return the preset whose values exactly equal `values`, or `null` when the set
 * is incomplete or doesn't match any preset (i.e. a custom profile). Used to
 * re-highlight the active chip after a user edits an individual row.
 */
export function matchPresetId(values: ActiveValues): PresetId | null {
  if (SENSORY_KEYS.some((k) => values[k] === null)) {
    return null;
  }
  const match = PRESETS.find((preset) =>
    SENSORY_KEYS.every((k) => preset.values[k] === values[k])
  );
  return match?.id ?? null;
}
