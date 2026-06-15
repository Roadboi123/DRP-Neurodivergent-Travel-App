/**
 * Tiny in-memory navigation history so the in-app Back button returns to the
 * screen the traveller actually came from — not the stack anchor.
 *
 * expo-router's tab navigation jumps between tabs without pushing onto the
 * native stack, so `router.back()` from a tab falls through to the anchor
 * (Home). We instead record each visited path (driven by `usePathname()` in the
 * root layout) and let the Back button navigate to the previous distinct one.
 */

let stack: string[] = [];

/** Record the currently-active path. Trims forward history when going back. */
export function recordPath(path: string): void {
  if (!path) return;
  if (stack[stack.length - 1] === path) return;
  const existingIdx = stack.indexOf(path);
  if (existingIdx !== -1) {
    // Returning to a path already in history — drop everything after it.
    stack = stack.slice(0, existingIdx + 1);
  } else {
    stack.push(path);
    if (stack.length > 25) stack.shift();
  }
}

/** The path before the current one, or null if there's nothing to go back to. */
export function previousPath(): string | null {
  return stack.length >= 2 ? stack[stack.length - 2] : null;
}
