import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/**
 * App-level colour scheme. This is an *in-app* choice (persisted), NOT the
 * device setting: the device's dark mode used to leak broken colours into
 * components, so the scheme is owned here and surfaced through
 * `useColorScheme()` (see `@/hooks/use-color-scheme`). Default is light so the
 * vivid Wero look is the first impression; users opt into the calmer dark theme.
 */
export type ColorScheme = 'light' | 'dark';

const STORAGE_KEY = '@theme-scheme';

interface ThemeContextValue {
  scheme: ColorScheme;
  toggleScheme: () => void;
  setScheme: (scheme: ColorScheme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [scheme, setSchemeState] = useState<ColorScheme>('light');

  // Restore the saved choice once on mount. A brief light flash before the read
  // resolves is acceptable (and light is the default anyway).
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved: string | null) => {
        if (active && (saved === 'light' || saved === 'dark')) {
          setSchemeState(saved);
        }
      })
      .catch(() => {
        // Storage unavailable — fall back to the default scheme silently.
      });
    return () => {
      active = false;
    };
  }, []);

  const setScheme = useCallback((next: ColorScheme) => {
    setSchemeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {
      // Persistence is best-effort; the in-memory choice still applies.
    });
  }, []);

  const toggleScheme = useCallback(() => {
    setSchemeState((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ scheme, toggleScheme, setScheme }),
    [scheme, toggleScheme, setScheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * Read the active theme. Returns the light default when called outside a
 * provider so isolated component renders (tests/storybook) don't crash.
 */
export function useTheme(): ThemeContextValue {
  return (
    useContext(ThemeContext) ?? {
      scheme: 'light',
      toggleScheme: () => {},
      setScheme: () => {},
    }
  );
}
