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

## Design system (use what exists — don't reinvent)

- **Colour:** only via `getPalette(isDark)` (`src/constants/theme.ts`). The accent is `#E91E63`.
  Don't scatter raw hex through components; if a new token is genuinely needed, add it to the
  palette. Sensory level colours come from `SensoryMeter`.
- **Type:** `Fonts` from the theme (system stack today). A display face for headings can be added
  via `expo-font` — pair it with the body sans, don't reuse one font for both.
- **Radius:** cards 14–16, pills/segments 12–20 — match neighbours.
- **Shadows:** soft, low-opacity, slightly tinted (RN `shadow*` / `elevation`), never harsh.
- **Reuse primitives:** `SensoryMeter`, `SegmentedControl`, `HeaderNav`, `RouteCard`,
  `RouteFilterSheet` before building new ones.

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

## Hard rules

- Match references; don't embellish or "improve" them.
- Don't stop after a single screenshot pass.
- Respect the **frozen `GET /routes/` contract** and the DI/services architecture (see `CLAUDE.md`).
- New UI goes in `src/components/{area}/` — kebab-case files, PascalCase exports.
- Don't introduce Tailwind, raw `fetch`, or a second styling system.
