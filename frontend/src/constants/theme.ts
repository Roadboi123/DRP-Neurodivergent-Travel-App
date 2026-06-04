/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import { Platform } from 'react-native';

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

/**
 * Wero brand palette — the neo-brutalist style: ink outlines, bright fills,
 * hard offset shadows. These are the raw brand colours; screens consume the
 * semantic `ThemePalette` below (via `getPalette`) for surface/text tokens.
 */
export const BRAND = {
  ink: '#1d1c1c',
  yellow: '#fff48d',
  pink: '#ff158a',
  pinkSoft: '#fd74fd',
  green: '#83f582',
  cyan: '#7af7f7',
  orange: '#fdad70',
  white: '#ffffff',
} as const;

/** Linear-gradient presets (consumed by expo-linear-gradient). */
export const GRADIENTS = {
  // Static page background — pink → yellow at ~121deg (start/end approximate it).
  background: {
    colors: [BRAND.pink, BRAND.yellow] as [string, string],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  // Card fills lifted from the Wero cards.
  cyanGreen: { colors: [BRAND.cyan, BRAND.green] as [string, string] },
  pinkOrange: { colors: [BRAND.pinkSoft, BRAND.orange] as [string, string] },
};

/**
 * The signature Wero shadow: a hard, un-blurred offset block in ink. On web
 * (react-native-web) this maps to `box-shadow: 0 {offset}px 0 #1d1c1c`. Use a
 * smaller offset (e.g. 2) for the pressed state.
 */
export const hardShadow = (offset = 6) => ({
  shadowColor: BRAND.ink,
  shadowOffset: { width: 0, height: offset },
  shadowOpacity: 1,
  shadowRadius: 0,
  elevation: offset,
});

/**
 * Semantic surface/text palette used across the app screens. Token names are
 * unchanged so components keep working; values are now the light-only Wero
 * palette (`getPalette(isDark)` ignores `isDark` — the app is light-only).
 */
export type ThemePalette = {
  background: string;
  surface: string;
  border: string;
  borderStrong: string;
  divider: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
};

// Light-only Wero palette. `background` is transparent so the fixed gradient
// (mounted once behind the navigator) shows through every screen.
const weroPalette: ThemePalette = {
  background: 'transparent',
  surface: BRAND.white,
  border: BRAND.ink,
  borderStrong: BRAND.ink,
  divider: '#bbbaba',
  textPrimary: BRAND.ink,
  textSecondary: BRAND.ink,
  textMuted: '#5b5b5b',
};

export const Palette: { light: ThemePalette; dark: ThemePalette } = {
  light: weroPalette,
  dark: weroPalette,
};

// App is light-only (Wero); the param is kept for call-site compatibility.
export const getPalette = (_isDark: boolean): ThemePalette => weroPalette;

// Archivo family names as loaded by @expo-google-fonts/archivo (see root
// _layout.tsx). `display` is the heavy grotesk for big Wero headings; `body`
// is the medium weight for everything else.
export const WeroFonts = {
  display: 'Archivo_800ExtraBold',
  displayBlack: 'Archivo_900Black',
  body: 'Archivo_500Medium',
  bodyBold: 'Archivo_700Bold',
} as const;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
    display: WeroFonts.display,
    body: WeroFonts.body,
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
    display: WeroFonts.display,
    body: WeroFonts.body,
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
    display: WeroFonts.display,
    body: WeroFonts.body,
  },
});
