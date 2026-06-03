import type { SensitivityLevel } from '@/types/preference';

export const OPTIONS: { value: SensitivityLevel; label: string }[] = [
  { value: 'little', label: 'A little' },
  { value: 'manageable', label: 'Manageable' },
  { value: 'dontcare', label: 'Do not care' },
];

export const getOptionColors = (level: SensitivityLevel, isDark: boolean) => {
  if (isDark) {
    return {
      little: {
        bg: '#4A1D1D',
        text: '#FF8A8A',
        border: '#5C2D2D',
      },
      manageable: {
        bg: '#3E2F1F',
        text: '#FFB74D',
        border: '#4F3E2B',
      },
      dontcare: {
        bg: '#252932',
        text: '#888888',
        border: '#313745',
      },
    }[level];
  }
  return {
    little: {
      bg: '#FFE8E8',
      text: '#C0392B',
      border: '#F5A9A9',
    },
    manageable: {
      bg: '#FFF3DC',
      text: '#B7770D',
      border: '#F5D08A',
    },
    dontcare: {
      bg: '#EAEAEA',
      text: '#666666',
      border: '#CCCCCC',
    },
  }[level];
};
