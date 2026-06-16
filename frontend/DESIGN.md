# Frontend design system & screenshot workflow

How UI gets built in this app. The app is **Expo / React Native on `react-native-web`** —
there is **no Tailwind and no HTML/CSS**. Everything is `StyleSheet` + the tokens in
`src/constants/theme.ts`. Architecture, services (DI), and the frozen API contract live in
`CLAUDE.md` — read it for anything non-visual.

> The app was rebranded from the old neo-brutalist **"Wero"** look to **Clearway** — a calm,
> airy **glassmorphism** language (see `Clearway.pdf` at the repo root for the source deck).
> If you find any leftover Wero idioms (hard offset shadows, neon pink/yellow fills, UPPERCASE
> headings, 2px ink borders), they're bugs — migrate them to the tokens below.

## Always do first

- If the `frontend-design` skill is installed, **invoke it before writing any frontend code**.
- **Never ship a visual change you haven't screenshotted and looked at.** "It should look right"
  is not verification — the screenshot is.

## The Clearway design language (use the tokens, don't reinvent)

A single, calm theme — **there is no light/dark toggle anymore** (`useColorScheme()` always
returns `'light'`; the old `ThemeProvider`/`ThemeToggle` are gone/no-ops). All tokens live in
`src/constants/theme.ts`. Import `CLEARWAY`, `GLASS`, `Radii`, `softShadow`, `ClearwayFonts`
directly; the older names (`getPalette`, `getAccents`, `getSemanticColors`, `hardShadow`,
`BRAND`) are kept as **compatibility shims that now return calm Clearway values** so the tree
keeps compiling — prefer the new tokens in new code.

### Colour (`CLEARWAY`)
- **Background:** a pale blue-grey field (`bgBase #d5dbe1`) under a few large, diffuse pastel
  **mesh blobs** (`meshBlue / meshLilac / meshPeach`). Painted by `GradientBackground` — static,
  no animation. **Each screen mounts its own** (RN-web gotcha below).
- **Text:** `heading #1a1c1e` (near-black, big headings), `ink #33363b` (body/primary),
  `textSecondary #5a5e66`, `textMuted #878d96`, `onGlassDark #f4f6f9` (on dark glass).
- **Accent (single, soft blue):** `blue #5b8fd6`, `blueStrong #2f6fed` (links/active), and the
  pill gradient `bluePillFrom → bluePillTo` (`#cfe0f5 → #a7c8ef`). A faint `lilac` pairs with
  blue in the signature `GradientDot`. Don't reintroduce pink/yellow/green as decoration.
- **Functional colour stays** (do NOT monochrome): the sensory severity ramp
  (`good` green → amber `#d3a83c` → orange `#d9844e` → `bad` coral) and the official
  `TFL_LINE_COLORS` liveries (`resolveLineColor`) for transit legs/markers. Warning surfaces use
  the amber semantic tokens.

### Glass (`GLASS`, the signature surface)
Frosted glass is the product's identity. Use the primitives — don't hand-roll blur:
- **`Glass`** (`components/ui/glass.tsx`) — the base frosted surface: real backdrop blur via
  `expo-blur` `BlurView` (maps to CSS `backdrop-filter` on web) under a translucent tinted fill,
  a **thin 1px light border**, soft shadow. Props: `tone` (`'light'` default / `'dark'`),
  `radius`, `shadow` (0–3), `bordered`.
- **`GlassCard`** — `Glass` + padding, for grouped content.
- **`GlassButton`** — the signature CTA: `primary` (blue→light-blue gradient pill, white text),
  `secondary` (frosted pill), `ghost`. Has a pressed (scale+dim) state.
- **`Chip`** — selectable pill: selected = blue gradient (or a `selectedColor`), unselected =
  frosted glass.
- **`GradientDot`** — the small blue→lilac accent dot (card corners, the "Clearway." dot).
- **`GLASS.light` / `GLASS.dark`** give `{ fill, border, blur }` if you need a bespoke frosted
  surface (e.g. a bottom sheet): put a `BlurView` as an absolute-fill first child of an
  `overflow:'hidden'` rounded container, then the translucent fill + content over it. See
  `route-time-sheet.tsx` / `journey.tsx` sheet panels for the pattern.

### Shadows — soft, never hard
`softShadow(level)` (1 = pills/buttons → 3 = raised cards/sheets): a low-opacity, **blurred**
ambient shadow. The old hard 0-radius offset block is gone (`hardShadow` is now an alias to
`softShadow`). **No hard/un-blurred shadows.**

### Type — heavy grotesque, mixed-case
`ClearwayFonts` = **Hanken Grotesk** (loaded in `app/_layout.tsx`): `display` (800),
`displayBlack` (900), `heading` (700), `semibold` (600), `body` (500), `bodyRegular` (400).
Also exposed via `Fonts.display / .heading / .semibold / .body`.
- **Headings are mixed-case** (NOT uppercase), heavy (800–900), with **tight negative tracking**
  (`letterSpacing` ≈ -0.3 to -1.4 on large sizes). Build big, confident headings (e.g.
  "My Planner", "Your preferences").
- Body/labels are weight 500–700, generous line-height (~1.4 on body).

### Radii & borders
`Radii`: `chip 14`, `input 16`, `card 28`, `cardLg 36`, `pill 999`. Borders are **1px** hairlines
(`palette.border` light, `palette.borderStrong` for a darker hairline), never 2px ink.

### Motion
Animate **only `transform` and `opacity`**, via RN core `Animated` (reanimated has no
worklets/babel plugin here — its animated styles silently no-op). Keep motion gentle; the
background is deliberately static (neurodivergent users).

## Screenshot workflow (REQUIRED for any visual change)

**First-time setup (once per machine):** the Chromium download is skipped on install (so CI /
Vercel stay green), so fetch a browser once: `npx puppeteer browsers install chrome`.

1. Start the web dev server in the background: `npm run web` → serves on
   **http://localhost:8081**. Use **plain `npm run web`** (watch mode) for an iterative loop so
   edits show on reload; `CI=1 npm run web` caches the bundle and **won't pick up edits without a
   restart** (a frequent "the screenshot didn't update" cause). Wait until it responds.
   - **Port gotcha:** if 8081 is in use, Expo silently bumps to 8082/8083… Kill stale
     `expo start` processes first (`pkill -f "expo start"`) or shoot the printed port.
2. Capture: `npm run screenshot -- <url> [label]` → PNGs land in `frontend/screenshots/`
   (auto-incremented). Viewport defaults to a phone (390×844); override with `SHOT_WIDTH/HEIGHT`.
   - **For data-backed / interactive states** (route list, details modal, journey, sheets) the
     built-in script's fixed settle is often too short / can't click. Drive a one-off puppeteer
     script: load `…/routes?start=Norbiton&end=Imperial%20College%20London`, wait ~12s for the
     fetch, `page.mouse.click(...)` a card to open the details modal, then "Start journey", etc.
3. **Read the PNG back with the Read tool** and actually inspect it.
4. Compare against the deck (`Clearway.pdf`) / mockup and **fix mismatches, then re-screenshot**.
   Do at least **2 comparison rounds**. Stop only when no visible differences remain.
5. Be specific: spacing/padding, font size/weight/tracking, exact hex, alignment, radius,
   shadow softness, glass opacity.

## Reference images
- **If a reference/mockup is provided** (the deck, sketches): match layout, spacing, typography
  and colour. Don't "improve" it, add sections, or invent content.
- **If none:** design from scratch with high craft, following the tokens above.

## React Native Web gotchas (learned the hard way)
- **Every screen needs its OWN opaque background.** The bottom-tab navigator does **not** detach
  inactive screens on web, so transparent screen backgrounds let screens bleed through on
  navigation. Each screen mounts its own `GradientBackground`; the navigator base is a solid
  colour (`CLEARWAY.bgBase`), never `transparent`.
- **Glass blur:** `expo-blur` `BlurView` blurs what's *behind* it — it needs content behind
  (the page/map), and the container needs `overflow:'hidden'` + a radius to clip the blur to
  rounded corners. A `BlurView` whose card has an element poking outside (e.g. a cancel button at
  `top:-10`) can't use `overflow:'hidden'` — make that card an **opaque** light surface instead.
- **Translucent surfaces over a busy map** can be hard to read — frost them (BlurView) or make
  them opaque; over the soft mesh background `palette.surface` (≈45–55% white) reads fine.
- **`adjustsFontSizeToFit` / auto-shrink is a no-op on web** — size text to fit explicitly.
- **Avoid nested horizontal `ScrollView`s inside list rows** (repaint a blank frame). The
  route-card timeline is a wrapping row for this reason.
- **Memoize list cards** (`React.memo`) so re-sorting reorders painted nodes instead of remounting.

## Hard rules
- Match the deck; don't embellish or "improve" it.
- Don't stop after a single screenshot pass.
- Single calm theme — don't reintroduce a light/dark toggle or the Wero palette.
- Soft shadows only; mixed-case headings; 1px hairline borders; glass surfaces via the primitives.
- Respect the **frozen `GET /routes/` contract** and the DI/services architecture (see `CLAUDE.md`).
- New UI goes in `src/components/{area}/` — kebab-case files, PascalCase exports.
- Don't introduce Tailwind, raw `fetch`, or a second styling system.
