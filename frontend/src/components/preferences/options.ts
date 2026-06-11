import { BRAND } from '@/constants/theme';
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

// Wero ramp: green → yellow → orange → pink, all outlined in ink.
const LIGHT_COLORS: Record<SensitivityLevel, ChipColors> = {
  little: { bg: BRAND.green, text: BRAND.ink, border: BRAND.ink },
  medium: { bg: BRAND.yellow, text: BRAND.ink, border: BRAND.ink },
  high: { bg: BRAND.orange, text: BRAND.ink, border: BRAND.ink },
  veryhigh: { bg: BRAND.pink, text: BRAND.white, border: BRAND.ink },
};

const DARK_COLORS: Record<SensitivityLevel, ChipColors> = {
  little: {
    bg: '#16301E',
    text: '#5FD08A',
    border: '#244A30',
  },
  medium: {
    bg: '#332B12',
    text: '#E8C24A',
    border: '#4A3E1F',
  },
  high: {
    bg: '#3A2415',
    text: '#F0A35E',
    border: '#4F351F',
  },
  veryhigh: {
    bg: '#3A1F1C',
    text: '#FF8A7A',
    border: '#5C2D2D',
  },
};

export const getOptionColors = (level: SensitivityLevel, isDark: boolean): ChipColors =>
  (isDark ? DARK_COLORS : LIGHT_COLORS)[level];
