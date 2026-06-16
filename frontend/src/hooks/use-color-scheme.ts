// Clearway ships a single calm theme — there is no light/dark choice anymore.
// This hook is kept (many components still call it) but always reports 'light'
// so every `getPalette(useColorScheme() === 'dark')` resolves to the one theme.
export function useColorScheme(): 'light' | 'dark' {
  return 'light';
}
