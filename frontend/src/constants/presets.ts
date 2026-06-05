import type { SensitivityLevel } from '@/types/preference';
import type { Preset, PresetId } from '@/types/preset';

/**
 * Sensory dimensions a user can be sensitive to. These keys line up 1:1 with the
 * backend `Preset` fields, so a `PresetValues` object can be spread straight into
 * a save payload.
 */
export type SensoryKey = 'noise' | 'crowds' | 'temperature' | 'smell' | 'lights';

export const SENSORY_KEYS: SensoryKey[] = [
  'noise',
  'crowds',
  'temperature',
  'smell',
  'lights',
];

/** Display metadata per sensory dimension, shared by the rows and the glimpse. */
export const SENSORY_META: Record<SensoryKey, { label: string; short: string; emoji: string }> = {
  noise: { label: 'Noise', short: 'Noise', emoji: '🔊' },
  crowds: { label: 'Crowds', short: 'Crowds', emoji: '👥' },
  temperature: { label: 'Temperature', short: 'Temp', emoji: '🌡️' },
  smell: { label: 'Smell', short: 'Smell', emoji: '👃' },
  lights: { label: 'Lights', short: 'Lights', emoji: '💡' },
};

/** The three fixed preset slots, in display order. */
export const PRESET_IDS: PresetId[] = ['p1', 'p2', 'p3'];

/** Default per-slot names, used until the user renames a preset. */
export const PRESET_NAMES: Record<PresetId, string> = {
  p1: 'Preset 1',
  p2: 'Preset 2',
  p3: 'Preset 3',
};

/** Max characters allowed for a user-chosen preset name. */
export const PRESET_NAME_MAX_LENGTH = 24;

/**
 * The name to show for a preset: the user's chosen name, falling back to the
 * slot default when it's blank.
 */
export const presetDisplayName = (preset: Preset): string =>
  preset.name?.trim() ? preset.name.trim() : PRESET_NAMES[preset.id];

/** A complete set of sensitivities (every dimension set) backing one preset. */
export type PresetValues = Record<SensoryKey, SensitivityLevel>;

/**
 * Current working sensitivities. Mirrors `PresetValues` but allows `null` for the
 * logged-out path (no personalization signal sent to route scoring).
 */
export type ActiveValues = Record<SensoryKey, SensitivityLevel | null>;

export const EMPTY_VALUES: ActiveValues = {
  noise: null,
  crowds: null,
  temperature: null,
  smell: null,
  lights: null,
};

/** Build a preset with every dimension at one level (used for seeded defaults). */
const presetAt = (id: PresetId, level: SensitivityLevel): Preset => ({
  id,
  name: PRESET_NAMES[id],
  noise: level,
  crowds: level,
  temperature: level,
  smell: level,
  lights: level,
});

/**
 * Seeded defaults used when a user has no presets saved yet. A calm ramp so the
 * three slots start meaningfully different — p1 lenient, p3 most protective.
 */
export const DEFAULT_PRESETS: Preset[] = [
  presetAt('p1', 'little'),
  presetAt('p2', 'medium'),
  presetAt('p3', 'high'),
];

/** Extract just the five sensitivity values from a preset. */
export const presetValues = (preset: Preset): PresetValues => ({
  noise: preset.noise,
  crowds: preset.crowds,
  temperature: preset.temperature,
  smell: preset.smell,
  lights: preset.lights,
});

/**
 * Return the three presets in slot order, filling any missing slot from the
 * defaults so the UI always has exactly p1/p2/p3.
 */
export const normalizePresets = (presets: Preset[]): Preset[] =>
  PRESET_IDS.map(
    (id) =>
      presets.find((p) => p.id === id) ??
      DEFAULT_PRESETS.find((p) => p.id === id)!
  );
