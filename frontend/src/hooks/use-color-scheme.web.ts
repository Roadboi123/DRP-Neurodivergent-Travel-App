// The app is intentionally light-only (the Wero design language). Force 'light'
// so device dark mode never leaks into component `isDark` checks.
export function useColorScheme(): 'light' | 'dark' {
  return 'light';
}
