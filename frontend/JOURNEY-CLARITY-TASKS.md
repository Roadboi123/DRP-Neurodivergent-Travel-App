# Journey & Map Clarity — Task Tracker

Tracks the 13-point journey/map clarity overhaul (branch `feat/journey-map-clarity`).
Goal: make every UI interaction self-explanatory — clear enough for a 12-year-old —
without touching the frozen `GET /routes/` contract or the Wero design system.

Plan source: `~/.claude/plans/snappy-whistling-zebra.md`.

Status: ⬜ todo · 🟧 in progress · ✅ done · ⏭️ deferred

| # | Task | Status |
|---|------|--------|
| 1 | Strip coordinates from journey steps (both sheets + map popups) | ✅ |
| 2 | Warning emojis match the report rail (smell 👃→🌸, audit rest) | ✅ |
| 3 | Report widget label — keep "Report" | ✅ (kept as-is) |
| 4 | Map markers: blue walking dots + white change markers w/ transport emoji | ✅ |
| 5 | Per-stop white dots along a ride | ⏭️ deferred (no stop coords in data) |
| 6 | Legend (round 1 top pill → **round 2** left-docked swipeable panel) | ✅ |
| 7 | Fix swipe-down sheet glitch (both sheets — overshootClamping) | ✅ |
| 8 | Fix swap corrupting Current Location | ✅ |
| 9 | Rename "Go" → "Start journey" | ✅ |
| 10 | Clearer warnings toggle: icon → pill "Hide/Show warnings" | ✅ |
| 11 | Remove "Sensory alignment" widget (both screens) | ✅ |
| 12 | This tracking markdown | ✅ |
| 13 | General signposting pass (icon-only controls get labels) | ✅ |

## Round 2 follow-ups (post-review)

| # | Task | Status |
|---|------|--------|
| R1 | "your destination" → actual entered destination (label fallback via active-journey) | ✅ |
| R2 | Legend → left-docked, swipeable off/on with chevron tab; clean Hide-changes button | ✅ |
| R3 | SW11→Westfield end-of-route: confirm walk icon at bus→walk change | ✅ (🚌+🚶 markers; ported change markers + blue walking to the pre-Go map too) |
| R4 | Heat warning emoji 🔥 → 🌡️ (thermometer) | ✅ |
| R5 | Remove the reroute feature entirely | ✅ |

`WALK_BLUE` + `modeEmoji` now live in `warning-markers.ts` and are shared by both
maps. Journey labels (`setActiveJourneyLabels`/`getActiveJourneyLabels`) live in
`services/active-journey.ts`.

## Key files

- `src/app/journey.tsx` — live map after "Go".
- `src/components/routes/route-details-modal.tsx` — pre-Go "more details" sheet.
- `src/components/routes/warning-markers.ts` — report options/emojis + marker script.
- `src/components/routes/route-search-inputs.tsx` — start/end inputs (swap bug).
- `src/app/(tabs)/routes.tsx` — `handleSwapLocations`.
- `src/components/routes/route-card.tsx` — `getLegUIProps` (mode → icon/colour).
- `src/utils/place-label.ts` — coordinate-cleaning helper (new).

## Decisions (confirmed with user)

- Change markers: **emoji** transport icons (🚌🚇🚆🚊) in white circles.
- Hide-changes toggle: **bus / bus-outline** Ionicon.
- Per-stop dots (#5): **skipped** — data has no stop coordinates.
- Sensory widget (#11): remove from **both** screens.

## Verification

- Screenshot loop per `DESIGN.md` (`CI=1 npm run web` → 8081, `npm run screenshot`).
- Swap test: pinned place ↔ Current Location, confirm GPS resolves correctly.
- Swipe test: pre-Go sheet drags down smoothly.
- `npm run lint` + `npx tsc --noEmit` clean.
