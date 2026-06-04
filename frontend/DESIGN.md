# Frontend design system & screenshot workflow

How UI gets built in this app. The app is **Expo / React Native on `react-native-web`** — there
is **no Tailwind and no HTML/CSS**. Everything is `StyleSheet` + the theme in
`src/constants/theme.ts`. Architecture, services (DI), and the frozen API contract live in
`CLAUDE.md` — read it for anything non-visual.

## Always do first

- If the `frontend-design` skill is installed, **invoke it before writing any frontend code**.
- **Never ship a visual change you haven't screenshotted and looked at.** "It should look right"
  is not verification — the screenshot is.

## Screenshot workflow (REQUIRED for any visual change)

**First-time setup (once per machine):** the Chromium download is skipped on install (so CI /
Vercel stay green), so fetch a browser once: `npx puppeteer browsers install chrome`.

1. Start the web dev server in the background: `npm run web` (`expo start --web`) → serves on
   **http://localhost:8081**. Wait until it responds before shooting. Always use localhost,
   never a `file://` URL (react-native-web needs the bundler).
   - **Port gotcha:** if 8081 is already in use, Expo silently bumps to **8082 / 8083 …**. Kill
     stale `expo start` processes first (or shoot the printed port) so you're not screenshotting
     an old instance — a frequent "the screenshot didn't update" cause.
2. Capture: `npm run screenshot -- <url> [label]`, e.g.
   `npm run screenshot -- http://localhost:8081/routes routes`.
   PNGs land in `frontend/screenshots/screenshot-N.png` (auto-incremented, never overwritten;
   `-label` suffix optional). Viewport defaults to a phone (390×844); override with
   `SHOT_WIDTH`/`SHOT_HEIGHT`.
3. **Read the PNG back with the Read tool** and actually inspect it.
4. Compare against the reference/mockup and **fix mismatches, then re-screenshot**. Do at least
   **2 comparison rounds**. Stop only when no visible differences remain — or the user says so.
5. Be specific when comparing: spacing/padding, font size / weight / line-height, exact hex,
   alignment, border-radius, shadows, icon/image sizing.

## Reference images

- **If a reference/mockup is provided** (e.g. the route-page sketches): match layout, spacing,
  typography and colour **exactly**. Do not "improve" it, add sections, or invent content.
- **If none:** design from scratch with high craft, following the guardrails below.

## Design system — the Wero language (use the tokens, don't reinvent)

The app uses a neo-brutalist "Wero" style (ink outlines, bright fills, hard offset shadows,
heavy uppercase type, pill controls). All tokens live in `src/constants/theme.ts`:
- **Colour:** `BRAND` (`ink #1d1c1c`, `yellow`, `pink #ff158a`, `pinkSoft`, `green`, `cyan`,
  `orange`, `white`) and the semantic `getPalette(isDark)` (light: ink-on-white; dark: off-white on
  charcoal). Bright BRAND fills used **as accents** must go through `getAccents(isDark)` (a muted,
  desaturated ramp in dark) — not `BRAND.*` directly. Don't scatter raw hex — add a token if needed.
- **Two themes, in-app toggle (not the device setting).** The scheme is an in-app, persisted choice
  owned by `ThemeProvider` (`src/contexts/theme-context.tsx`, AsyncStorage); `useColorScheme()` returns
  it, so `getPalette(useColorScheme() === 'dark')` flows everywhere and re-renders on toggle. The
  `ThemeToggle` (`components/ui/theme-toggle.tsx`) sits top-right of every screen (in `HeaderNav`, and
  the home header). **Dark mode must read from the in-app context, never the device `Appearance`** —
  device dark mode used to leak the old palette into selected preference chips. Surfaces/borders that
  hardcoded `BRAND.white`/`BRAND.ink` must be driven by `palette.surface`/`palette.border` (inline, not
  in static `StyleSheet`), or they break in dark. **Animate with RN core `Animated`** (transform/opacity
  only) — reanimated has no worklets/babel plugin configured here, so its animated styles silently no-op.
- **Bottom sheets have no scrim.** `RouteFilterSheet` / `PreferencesGuideSheet` use a
  **transparent** backdrop — the 2px ink border defines them; a dark scrim clashes with the gradient.
- **Shadows:** the signature `hardShadow(offset)` helper — a hard, un-blurred ink offset block
  (`shadowRadius: 0`). Use offset 6 for cards, 3–4 for pills/buttons, 2 for the pressed state.
  **No soft/blurred shadows.**
- **Type:** `Fonts.display` = Archivo (loaded in the root layout). Headings are **uppercase,
  weight 800–900, tight tracking**; body is weight 500. Build big, confident headings.
- **Background:** the pink→yellow `GradientBackground` (static). **Each screen mounts its own**
  (see the RN-web gotchas) — don't rely on a single shared one.
- **Borders/radius:** 2px ink borders; cards radius ~14, pills/segments 30.
- **Reuse primitives:** `SensoryMeter`, `SegmentedControl`, `HeaderNav`, `RouteCard`,
  `RouteFilterSheet`, `GradientBackground` before building new ones.

## Anti-generic guardrails (translated to React Native)

- **Type pairing:** distinct heading vs body; tight letter-spacing on large headings, generous
  line-height (~1.4–1.7 equivalent) on body.
- **Shadows:** layered/tinted and low-opacity — not one flat default shadow.
- **Depth:** vary elevation so surfaces sit on different planes; don't flatten everything.
- **Motion:** animate **only `transform` and `opacity`** (via `react-native-reanimated`); never
  animate layout or "everything". Use spring-style easing.
- **Interactive states:** every touchable needs a pressed state (and hover/focus on web).
- **Gradients:** use `expo-linear-gradient` (not yet a dependency — add it if you need one).
  CSS radial gradients, `mix-blend`, and SVG-noise grain are **not native to RN** — avoid them.

## React Native Web gotchas (learned the hard way)

- **Every screen needs its OWN opaque background.** The bottom-tab navigator does **not** detach
  inactive screens on web, so transparent screen backgrounds over a single shared background let
  screens **stack and bleed through each other** on navigation. Each screen mounts its own
  `GradientBackground`; the navigator base is a solid colour, never `transparent`.
- **`adjustsFontSizeToFit` / auto-shrink is a no-op on web** — text just truncates (`SOMEW…`).
  Size text to fit explicitly instead of relying on shrink.
- **Avoid nested horizontal `ScrollView`s inside list rows** — they repaint a blank/white frame
  when the surrounding list updates (the route-card timeline is a wrapping row for this reason).
- **Memoize list cards** (`React.memo`) so re-sorting reorders already-painted nodes instead of
  re-rendering/remounting each one.
- **`BRAND` tokens are `as const`** (literal types). A `let` initialised from one (e.g. a leg
  badge colour) narrows to that literal — annotate it `: string` if it gets reassigned to other values.

## Hard rules

- Match references; don't embellish or "improve" them.
- Don't stop after a single screenshot pass.
- Respect the **frozen `GET /routes/` contract** and the DI/services architecture (see `CLAUDE.md`).
- New UI goes in `src/components/{area}/` — kebab-case files, PascalCase exports.
- Don't introduce Tailwind, raw `fetch`, or a second styling system.
