import type { SensitivityLevel } from '@/types/preference';

// Severity options, ordered least → most affected. The chip colour ramps from
// forest green (a little) to red (very high) to signal increasing severity.
export const OPTIONS: { value: SensitivityLevel; label: string }[] = [
  { value: 'little', label: 'A little' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'veryhigh', label: 'Very high' },
];

export const OPTION_COLORS: Record<
  SensitivityLevel,
  { bg: string; text: string; border: string }
> = {
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
