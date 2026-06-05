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
 * Official TfL line liveries, used to colour transit legs (route-card timeline,
 * route-details nodes, map polylines). These are deliberate transport-brand
 * colours — not Wero accents — so they live in one named token instead of being
 * scattered as literals across components. Keyed by a substring of the line
 * name; `resolveLineColor` matches case-insensitively.
 */
export const TFL_LINE_COLORS: Record<string, { bg: string; text: string }> = {
  central: { bg: '#E32017', text: '#FFFFFF' },
  district: { bg: '#00782A', text: '#FFFFFF' },
  northern: { bg: '#000000', text: '#FFFFFF' },
  victoria: { bg: '#00A0E2', text: '#FFFFFF' },
  jubilee: { bg: '#868F98', text: '#FFFFFF' },
  piccadilly: { bg: '#003688', text: '#FFFFFF' },
  bakerloo: { bg: '#894E24', text: '#FFFFFF' },
  circle: { bg: '#FFD300', text: '#000000' },
  hammersmith: { bg: '#F3A9C8', text: '#000000' },
  metropolitan: { bg: '#9B005A', text: '#FFFFFF' },
  elizabeth: { bg: '#7156A5', text: '#FFFFFF' },
  // New London Overground line names (Nov 2024). Each TfL livery is distinct;
  // checked before the generic `overground` key below.
  mildmay: { bg: '#0071BC', text: '#FFFFFF' },
  lioness: { bg: '#FAA61A', text: '#000000' },
  weaver: { bg: '#823A62', text: '#FFFFFF' },
  suffragette: { bg: '#18A95D', text: '#000000' },
  windrush: { bg: '#DC241F', text: '#FFFFFF' },
  liberty: { bg: '#61686B', text: '#FFFFFF' },
  overground: { bg: '#E86300', text: '#FFFFFF' },
  dlr: { bg: '#00AFAD', text: '#FFFFFF' },
  tram: { bg: '#5FB526', text: '#000000' },
};

/** Fallback livery for an unknown rail line (deep-blue, ink-readable). */
export const TFL_LINE_FALLBACK = { bg: '#0D47A1', text: '#FFFFFF' } as const;

/**
 * Resolve a line name to its TfL livery, or `null` if unrecognised. Insertion
 * order matters: specific new-Overground names are checked before the generic
 * `overground` key.
 */
export const resolveLineColor = (line: string): { bg: string; text: string } | null => {
  const l = (line || '').toLowerCase();
  if (!l) {
    return null;
  }
  for (const key of Object.keys(TFL_LINE_COLORS)) {
    if (l.includes(key)) {
      return TFL_LINE_COLORS[key];
    }
  }
  return null;
};

/**
 * Scheme-aware semantic colours for recurring non-accent UI: warning banners
 * (platform-wait card, login prompt), hyperlinks, and neutral chip/button
 * surfaces. Centralised so these stop being copy-pasted Material hex per file.
 */
export type SemanticColors = {
  warningSurface: string;
  warningBorder: string;
  warningText: string;
  warningIcon: string;
  link: string;
  neutralSurface: string;
};

const LIGHT_SEMANTIC: SemanticColors = {
  warningSurface: '#FFF9F3',
  warningBorder: '#FFE0B2',
  warningText: '#E65100',
  warningIcon: '#FF9800',
  link: '#003688',
  neutralSurface: '#F0F0EE',
};

const DARK_SEMANTIC: SemanticColors = {
  warningSurface: '#2E241C',
  warningBorder: '#5C3820',
  warningText: '#FFB74D',
  warningIcon: '#FF9800',
  link: '#64B5F6',
  neutralSurface: '#2E3543',
};

export const getSemanticColors = (isDark: boolean): SemanticColors =>
  isDark ? DARK_SEMANTIC : LIGHT_SEMANTIC;

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
