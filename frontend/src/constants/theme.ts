/**
 * Clearway design tokens — a single, calm glassmorphism theme.
 *
 * The app used to ship the neo-brutalist "Wero" look (ink outlines, hard offset
 * shadows, neon fills) with a light/dark toggle. Clearway replaces that with one
 * airy theme: a pale blue-grey field with soft pastel mesh, frosted-glass
 * surfaces, thin light borders, soft shadows and heavy mixed-case grotesque type.
 *
 * Read `DESIGN.md` before any UI work. New code should use the CLEARWAY / GLASS /
 * Radii / softShadow tokens directly. The older export names (BRAND, getPalette,
 * getAccents, hardShadow, …) are kept as compatibility shims that now return calm
 * Clearway values, so the tree keeps compiling while screens are migrated.
 */

import { Platform } from 'react-native';

/* ------------------------------------------------------------------ *
 * Core Clearway palette (single theme — no light/dark variants)
 * ------------------------------------------------------------------ */

export const CLEARWAY = {
  // Background field + the diffuse pastel mesh blobs painted over it.
  bgBase: '#d5dbe1',
  meshBlue: '#9fc0e8',
  meshLilac: '#cabfe0',
  meshPeach: '#ecd9c4',

  // Ink / text. Headings are near-black; body is charcoal.
  heading: '#1a1c1e',
  ink: '#33363b',
  textSecondary: '#5a5e66',
  textMuted: '#878d96',
  onGlassDark: '#f4f6f9', // text on dark frosted glass

  white: '#ffffff',

  // The single soft-blue accent + blue gradient-pill stops.
  blue: '#5b8fd6',
  blueStrong: '#2f6fed', // links / active emphasis
  bluePillFrom: '#cfe0f5',
  bluePillTo: '#a7c8ef',
  lilac: '#c2b6df',

  // Functional sensory scale (softened, glass-friendly) — keep the green/amber/
  // red semantics for usability; do not monochrome these.
  good: '#5b9d6b',
  okay: '#d39a3c',
  bad: '#cf6b5b',

  hairline: 'rgba(40,48,60,0.14)',
} as const;

/* ------------------------------------------------------------------ *
 * Glass tokens
 * ------------------------------------------------------------------ */

export type GlassTone = 'light' | 'dark';

/** Frosted-glass recipes. `blur` is the backdrop-blur radius (web px / BlurView intensity). */
export const GLASS: Record<GlassTone, { fill: string; border: string; blur: number }> = {
  light: { fill: 'rgba(255,255,255,0.45)', border: 'rgba(255,255,255,0.60)', blur: 20 },
  dark: { fill: 'rgba(38,42,48,0.55)', border: 'rgba(255,255,255,0.32)', blur: 24 },
};

/** Corner radii. Cards are generously rounded; pills are fully round. */
export const Radii = {
  chip: 14,
  input: 16,
  card: 28,
  cardLg: 36,
  pill: 999,
} as const;

/* ------------------------------------------------------------------ *
 * Shadows — soft + blurred (the Wero hard offset block is gone)
 * ------------------------------------------------------------------ */

const SOFT_SHADOW_LEVELS = {
  1: { shadowRadius: 14, height: 6, shadowOpacity: 0.1, elevation: 3 },
  2: { shadowRadius: 20, height: 10, shadowOpacity: 0.14, elevation: 6 },
  3: { shadowRadius: 28, height: 14, shadowOpacity: 0.18, elevation: 10 },
} as const;

/**
 * Soft, low-opacity ambient shadow. `level` is 1 (pills/buttons) → 3 (raised
 * cards / sheets). On web this maps to a blurred box-shadow.
 */
export const softShadow = (level: 1 | 2 | 3 = 2) => {
  const s = SOFT_SHADOW_LEVELS[level];
  return {
    shadowColor: '#2a3340',
    shadowOffset: { width: 0, height: s.height },
    shadowOpacity: s.shadowOpacity,
    shadowRadius: s.shadowRadius,
    elevation: s.elevation,
  };
};

/**
 * Back-compat shim for the old hard-offset shadow. Maps the Wero offset (2–6) to
 * a soft level so existing call sites get the new soft look until they migrate to
 * `softShadow`. NOT a hard shadow anymore.
 */
export const hardShadow = (offset = 6) => softShadow(offset >= 6 ? 3 : offset >= 4 ? 2 : 1);

/* ------------------------------------------------------------------ *
 * Fonts — Hanken Grotesk (loaded in app/_layout.tsx)
 * ------------------------------------------------------------------ */

export const ClearwayFonts = {
  display: 'HankenGrotesk_800ExtraBold',
  displayBlack: 'HankenGrotesk_900Black',
  heading: 'HankenGrotesk_700Bold',
  semibold: 'HankenGrotesk_600SemiBold',
  body: 'HankenGrotesk_500Medium',
  bodyRegular: 'HankenGrotesk_400Regular',
} as const;

/** Back-compat alias (was the Archivo set). */
export const WeroFonts = ClearwayFonts;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
    display: ClearwayFonts.display,
    body: ClearwayFonts.body,
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
    display: ClearwayFonts.display,
    body: ClearwayFonts.body,
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
    display: ClearwayFonts.display,
    body: ClearwayFonts.body,
  },
});

/* ------------------------------------------------------------------ *
 * Background mesh config (consumed by GradientBackground)
 * ------------------------------------------------------------------ */

export const MESH = {
  base: CLEARWAY.bgBase,
  blobs: [
    { color: CLEARWAY.meshBlue, top: '8%', left: '-25%', size: 520, opacity: 0.55 },
    { color: CLEARWAY.meshLilac, top: '45%', left: '55%', size: 460, opacity: 0.4 },
    { color: CLEARWAY.meshPeach, top: '78%', left: '10%', size: 380, opacity: 0.3 },
  ],
} as const;

/* ------------------------------------------------------------------ *
 * Back-compat: BRAND (keys kept, values remapped to calm Clearway tones)
 * ------------------------------------------------------------------ */

export const BRAND = {
  ink: CLEARWAY.ink,
  yellow: CLEARWAY.okay,
  pink: CLEARWAY.blue,
  pinkSoft: CLEARWAY.lilac,
  green: CLEARWAY.good,
  cyan: CLEARWAY.blue,
  orange: CLEARWAY.okay,
  white: CLEARWAY.white,
} as const;

/** Minimal gradient presets kept for compatibility (mesh lives in MESH). */
export const GRADIENTS = {
  background: {
    colors: [CLEARWAY.meshBlue, CLEARWAY.bgBase] as [string, string],
    locations: [0, 0.6] as [number, number],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  backgroundDark: {
    colors: [CLEARWAY.meshLilac, CLEARWAY.bgBase] as [string, string],
    locations: [0, 0.6] as [number, number],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  bluePill: { colors: [CLEARWAY.bluePillFrom, CLEARWAY.bluePillTo] as [string, string] },
};

/* ------------------------------------------------------------------ *
 * Back-compat: accent ramp (single theme — isDark ignored)
 * ------------------------------------------------------------------ */

export type Accents = {
  green: string;
  yellow: string;
  orange: string;
  pink: string;
  pinkSoft: string;
  cyan: string;
};

const CLEARWAY_ACCENTS: Accents = {
  green: CLEARWAY.good,
  yellow: CLEARWAY.okay,
  orange: CLEARWAY.okay,
  pink: CLEARWAY.blue,
  pinkSoft: CLEARWAY.lilac,
  cyan: CLEARWAY.blue,
};

export const getAccents = (_isDark?: boolean): Accents => CLEARWAY_ACCENTS;

/* ------------------------------------------------------------------ *
 * Official TfL line liveries (functional transport colours — unchanged)
 * ------------------------------------------------------------------ */

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

export const TFL_LINE_FALLBACK = { bg: '#0D47A1', text: '#FFFFFF' } as const;

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

/* ------------------------------------------------------------------ *
 * Back-compat: semantic colours (single theme — isDark ignored)
 * ------------------------------------------------------------------ */

export type SemanticColors = {
  warningSurface: string;
  warningBorder: string;
  warningText: string;
  warningIcon: string;
  link: string;
  neutralSurface: string;
};

const CLEARWAY_SEMANTIC: SemanticColors = {
  warningSurface: 'rgba(211,154,60,0.16)',
  warningBorder: 'rgba(211,154,60,0.45)',
  warningText: '#9a6a17',
  warningIcon: CLEARWAY.okay,
  link: CLEARWAY.blueStrong,
  neutralSurface: 'rgba(255,255,255,0.45)',
};

export const getSemanticColors = (_isDark?: boolean): SemanticColors => CLEARWAY_SEMANTIC;

/* ------------------------------------------------------------------ *
 * Back-compat: semantic surface/text palette (single theme)
 * ------------------------------------------------------------------ */

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

const clearwayPalette: ThemePalette = {
  background: 'transparent',
  surface: 'rgba(255,255,255,0.55)',
  border: 'rgba(255,255,255,0.60)',
  borderStrong: 'rgba(40,48,60,0.18)',
  divider: CLEARWAY.hairline,
  textPrimary: CLEARWAY.ink,
  textSecondary: CLEARWAY.textSecondary,
  textMuted: CLEARWAY.textMuted,
};

export const Palette: { light: ThemePalette; dark: ThemePalette } = {
  light: clearwayPalette,
  dark: clearwayPalette,
};

export const getPalette = (_isDark?: boolean): ThemePalette => clearwayPalette;

/** Legacy expo-template colour map (kept; unused by Clearway screens). */
export const Colors = {
  light: {
    text: CLEARWAY.ink,
    background: CLEARWAY.bgBase,
    tint: CLEARWAY.blueStrong,
    icon: CLEARWAY.textMuted,
    tabIconDefault: CLEARWAY.textMuted,
    tabIconSelected: CLEARWAY.blueStrong,
  },
  dark: {
    text: CLEARWAY.ink,
    background: CLEARWAY.bgBase,
    tint: CLEARWAY.blueStrong,
    icon: CLEARWAY.textMuted,
    tabIconDefault: CLEARWAY.textMuted,
    tabIconSelected: CLEARWAY.blueStrong,
  },
};
