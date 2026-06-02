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
 * Semantic surface/text palette used across the app screens. Values mirror the
 * exact hex codes previously inlined as `isDark ? '#x' : '#y'` ternaries so the
 * rendered UI is unchanged — `getPalette(isDark)` is the single source for them.
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

export const Palette: { light: ThemePalette; dark: ThemePalette } = {
  light: {
    background: '#FAF9F6',
    surface: '#FFFFFF',
    border: '#EAEAEA',
    borderStrong: '#E5E7EB',
    divider: '#F0F0EE',
    textPrimary: '#1A1A1A',
    textSecondary: '#666',
    textMuted: '#888',
  },
  dark: {
    background: '#121517',
    surface: '#1E2229',
    border: '#2E3543',
    borderStrong: '#2A303C',
    divider: '#2E3543',
    textPrimary: '#FFF',
    textSecondary: '#AAA',
    textMuted: '#AAA',
  },
};

export const getPalette = (isDark: boolean): ThemePalette =>
  isDark ? Palette.dark : Palette.light;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
