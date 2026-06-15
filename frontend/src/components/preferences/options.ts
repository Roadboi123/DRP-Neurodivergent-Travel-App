import type { SensitivityLevel } from '@/types/preference';

// Severity options, ordered least → most affected. The chip colour ramps from
// forest green (a little) to red (very high) to signal increasing severity.
export const OPTIONS: { value: SensitivityLevel; label: string }[] = [
  { value: 'little', label: 'A little' },
  { value: 'medium', label: 'Somewhat' },
  { value: 'high', label: 'A lot' },
  { value: 'veryhigh', label: 'Too much' },
];

// Spell out exactly what each level does to a route, keyed by the contract value
// so it stays aligned with OPTIONS even if the labels are reworded. Being concrete
// (rather than "affects you a bit") was direct user feedback. Shared by the inline
// scale legend and the guide sheet so they never drift.
export const LEVEL_GLOSS: Record<SensitivityLevel, string> = {
  little: 'we do not avoid this',
  medium: 'we avoid more than 30 mins of this where possible',
  high: 'we avoid more than 15 mins of this where possible',
  veryhigh: 'we avoid this entirely where possible',
};

type ChipColors = { bg: string; text: string; border: string };

// Clearway softened severity ramp: calm green → amber → orange → coral. Selected
// chips are a solid soft fill with white text; the green→red progression still
// signals increasing severity for usability.
const COLORS: Record<SensitivityLevel, ChipColors> = {
  little: { bg: '#5b9d6b', text: '#ffffff', border: '#5b9d6b' },
  medium: { bg: '#d3a83c', text: '#ffffff', border: '#d3a83c' },
  high: { bg: '#d9844e', text: '#ffffff', border: '#d9844e' },
  veryhigh: { bg: '#cf6b5b', text: '#ffffff', border: '#cf6b5b' },
};

export const getOptionColors = (level: SensitivityLevel, _isDark?: boolean): ChipColors =>
  COLORS[level];
