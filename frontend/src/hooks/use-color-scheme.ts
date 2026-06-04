import { useTheme } from '@/contexts/theme-context';

// The active scheme is an in-app, persisted choice owned by ThemeProvider — not
// the device setting (which used to leak broken colours into components). Every
// existing `getPalette(useColorScheme() === 'dark')` call now follows the toggle
// and re-renders when it flips. Platform-agnostic, so there is no `.web` variant.
export function useColorScheme(): 'light' | 'dark' {
  return useTheme().scheme;
}
