import { type ReactNode } from 'react';

/**
 * Clearway has a single calm theme — the in-app light/dark toggle was removed.
 * This module is kept as a no-op so existing imports keep working: `ThemeProvider`
 * just renders its children and `useTheme()` always reports the (locked) light
 * scheme. Delete once no component imports it.
 */
export type ColorScheme = 'light' | 'dark';

interface ThemeContextValue {
  scheme: ColorScheme;
  toggleScheme: () => void;
  setScheme: (scheme: ColorScheme) => void;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function useTheme(): ThemeContextValue {
  return { scheme: 'light', toggleScheme: () => {}, setScheme: () => {} };
}
