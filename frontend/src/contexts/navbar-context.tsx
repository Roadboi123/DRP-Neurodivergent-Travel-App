import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/**
 * Lets a screen temporarily hide the floating bottom tab bar (the
 * Home / Routes / Preferences pill owned by `(tabs)/_layout.tsx`).
 *
 * The route-details view is a full-screen modal rendered *inside* the routes
 * tab, so without this the pill bleeds over it on web. The routes screen flips
 * `hidden` while that modal is open and restores it on close.
 */
interface NavBarContextValue {
  hidden: boolean;
  setHidden: (hidden: boolean) => void;
}

const NavBarContext = createContext<NavBarContextValue | null>(null);

export function NavBarProvider({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState(false);

  const value = useMemo(() => ({ hidden, setHidden }), [hidden]);

  return <NavBarContext.Provider value={value}>{children}</NavBarContext.Provider>;
}

/**
 * Read/control tab-bar visibility. Returns a no-op default when called outside a
 * provider so isolated component renders (tests) don't crash.
 */
export function useNavBar(): NavBarContextValue {
  return useContext(NavBarContext) ?? { hidden: false, setHidden: () => {} };
}
