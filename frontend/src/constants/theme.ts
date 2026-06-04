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
  // Static page background — pink bleeding from the top-left corner into a
  // dominant yellow field (mirrors Wero's `121deg, #ff158a -20%, #fff48d 66%`).
  background: {
    colors: [BRAND.pink, BRAND.yellow] as [string, string],
    locations: [0, 0.45] as [number, number],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  // Dark-blue variant of the page background — mirrors the light pink→yellow
  // diagonal sweep but with a royal-blue corner glow bleeding into a deep navy
  // field, so dark mode keeps the same Wero gradient style while staying calm.
  backgroundDark: {
    colors: ['#2c4f8f', '#0d1426'] as [string, string],
    locations: [0, 0.45] as [number, number],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  // Card fills lifted from the Wero cards.
  cyanGreen: { colors: [BRAND.cyan, BRAND.green] as [string, string] },
  pinkOrange: { colors: [BRAND.pinkSoft, BRAND.orange] as [string, string] },
};

/**
 * Scheme-aware accent ramp. The Wero brand fills are neon by design; some
 * neurodivergent users find them over-stimulating, so dark mode swaps them for
 * desaturated, dimmed equivalents. Components that use a BRAND colour *as an
 * accent* (status badge, chips, action tiles, sensory blocks…) should read it
 * from here instead of `BRAND` directly so it mutes in dark mode.
 */
export type Accents = {
  green: string;
  yellow: string;
  orange: string;
  pink: string;
  pinkSoft: string;
  cyan: string;
};

const LIGHT_ACCENTS: Accents = {
  green: BRAND.green,
  yellow: BRAND.yellow,
  orange: BRAND.orange,
  pink: BRAND.pink,
  pinkSoft: BRAND.pinkSoft,
  cyan: BRAND.cyan,
};

const DARK_ACCENTS: Accents = {
  green: '#4c9461',
  yellow: '#acaa50',
  orange: '#b86111',
  pink: '#a53e6b',
  pinkSoft: '#9970b1',
  cyan: '#4d8a8a',
};

export const getAccents = (isDark: boolean): Accents => (isDark ? DARK_ACCENTS : LIGHT_ACCENTS);

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

// Light Wero palette. `background` is transparent so the fixed gradient
// (mounted once per screen) shows through.
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

// Calm dark-blue palette: navy-tinted surfaces, soft (not pure-black) borders
// and a faintly blue off-white text. `background` stays transparent so the dark
// blue gradient shows through. Hard ink shadows naturally recede on these
// surfaces — the 2px borders carry the Wero structure instead.
const darkPalette: ThemePalette = {
  background: 'transparent',
  surface: '#172033',
  border: '#33415f',
  borderStrong: '#47587d',
  divider: '#2b3650',
  textPrimary: '#e7ecf6',
  textSecondary: '#bcc6db',
  textMuted: '#828ea8',
};

export const Palette: { light: ThemePalette; dark: ThemePalette } = {
  light: weroPalette,
  dark: darkPalette,
};

export const getPalette = (isDark: boolean): ThemePalette =>
  isDark ? darkPalette : weroPalette;

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
