# Clearway redesign — migration tracker

Rebrand of the whole frontend from the neo-brutalist **Wero** look to the calm **Clearway**
glassmorphism language (source: `Clearway.pdf` at the repo root). Branch:
`feat/clearway-glass-redesign`. **Design spec: `DESIGN.md`** (read it first).

## What changed (foundation)
- `src/constants/theme.ts` — rewritten to Clearway tokens: `CLEARWAY` (pale-blue mesh + charcoal
  text + soft-blue accent), `GLASS`, `Radii`, `softShadow`, `MESH`, `ClearwayFonts` (Hanken
  Grotesk). Old exports (`getPalette`/`getAccents`/`getSemanticColors`/`hardShadow`/`BRAND`) kept
  as calm-value compatibility shims. `TFL_LINE_COLORS` + softened sensory ramp retained.
- Light/dark removed: `hooks/use-color-scheme` → always `'light'`; `contexts/theme-context` →
  no-op; `ThemeToggle` deleted; `_layout.tsx` single nav theme + Hanken fonts.
- New primitives in `components/ui/`: `glass.tsx` (`Glass`), `glass-card.tsx`, `glass-button.tsx`,
  `chip.tsx`, `gradient-dot.tsx`; `gradient-background.tsx` rewritten to the pastel mesh.
- Deps added: `expo-blur`, `@expo-google-fonts/hanken-grotesk`.

## Per-area status
- [x] **Foundation** — tokens, mesh background, glass primitives, font, kill light/dark.
- [x] **Navigation chrome** — floating frosted-glass tab bar (`(tabs)/_layout.tsx`), glass
      `header-nav.tsx`.
- [x] **Home** — `app/(tabs)/index.tsx`, `home/quick-action-card`, `preferences-nudge`,
      `daily-tips`.
- [x] **Preferences** — `app/(tabs)/preferences.tsx`, `preferences/option-chip`, `preference-row`,
      `preference-scale-legend`, `preset-switcher`, `preset-glimpse`, `preset-name-editor`,
      `options.ts` (softened ramp).
- [x] **Routes (list + controls)** — `app/(tabs)/routes.tsx`, `routes/route-card`,
      `route-search-inputs`, `segmented-control`, `sensory-meter`, `preset-indicator`,
      `warnings-panel`, `warning-confidence`, `ui/status-badge`.
- [x] **Routes (modals/sheets)** — `route-details-modal`, `route-filter-sheet`,
      `route-time-sheet` (frosted bottom sheets, blue CTAs, blue map endpoint markers).
- [x] **Journey** — `app/journey.tsx` (frosted bottom sheet + glass legend/controls, blue
      markers, calm report/proximity/warning cards).
- [x] **Profile** — `profile/profile-modal.tsx` (frosted glass auth sheet, blue CTA, soft inputs).
- [x] **Docs** — `DESIGN.md` rewritten; `frontend/CLAUDE.md` + root `CLAUDE.md` updated; this file.

## Verified via screenshot
Home (logged-out), Preferences (logged-out), Routes list + cards, Route details modal, Journey
screen. Logged-in preset views (preset switcher/glimpse, preference chips) follow the same
verified glass patterns but weren't screenshotted (need an auth session puppeteer can't reach).

## Known follow-ups / watch items
- **Logged-in screenshot pass:** verify the preferences chip grid, preset switcher and
  `preset-glimpse` once an authed session is available.
- **Native parity:** glass uses `expo-blur` (web `backdrop-filter` + native `BlurView`). Only
  verified on web (Vercel/screenshot target) — sanity-check on a device/simulator.
- **Leaflet map popups** still use a dark-ink/hard-shadow CSS style inside the map iframe
  (`route-details-modal` / `journey` `leafletHtml`). Cosmetic, inside the map only — soften later
  if desired. Walking polylines keep an ink casing for contrast on the map (intentional).
- **`hardShadow` call sites** remain in a few files as the soft-shim alias; fine to leave, or
  rename to `softShadow` in a cleanup pass. The unused `@expo-google-fonts/archivo` dep can be
  removed.
