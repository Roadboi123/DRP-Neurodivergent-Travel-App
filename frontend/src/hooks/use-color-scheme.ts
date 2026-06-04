// The app is intentionally light-only (the Wero design language). Force 'light'
// so device dark mode never leaks into component `isDark` checks (e.g. selected
// preference chips were rendering with the old dark palette on dark-mode phones).
// Return type kept as the union so existing `=== 'dark'` checks still typecheck
// (they just evaluate to false).
export function useColorScheme(): 'light' | 'dark' {
  return 'light';
}
