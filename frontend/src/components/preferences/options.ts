import type { SensitivityLevel } from '@/types/preference';

// Severity options, ordered least → most affected. The chip colour ramps from
// forest green (a little) to red (very high) to signal increasing severity.
export const OPTIONS: { value: SensitivityLevel; label: string }[] = [
  { value: 'little', label: 'A little' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'veryhigh', label: 'Very high' },
];

type ChipColors = { bg: string; text: string; border: string };

const LIGHT_COLORS: Record<SensitivityLevel, ChipColors> = {
  little: {
    bg: '#E3F2E6',
    text: '#1E7A3D',
    border: '#1E7A3D',
  },
  medium: {
    bg: '#FFF6DD',
    text: '#9A7B12',
    border: '#E8C24A',
  },
  high: {
    bg: '#FFE9D6',
    text: '#C2620F',
    border: '#F0A35E',
  },
  veryhigh: {
    bg: '#FCE3E1',
    text: '#C0392B',
    border: '#E07A6E',
  },
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
