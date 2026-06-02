import type { SensitivityLevel } from '@/types/preference';

export const OPTIONS: { value: SensitivityLevel; label: string }[] = [
  { value: 'little', label: 'A little' },
  { value: 'manageable', label: 'Manageable' },
  { value: 'dontcare', label: 'Do not care' },
];

export const OPTION_COLORS: Record<
  SensitivityLevel,
  { bg: string; text: string; border: string }
> = {
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
};
