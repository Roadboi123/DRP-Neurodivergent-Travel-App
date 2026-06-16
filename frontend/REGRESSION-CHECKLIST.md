# Regression checklist — fragile journey / warning features

These behaviours keep breaking on unrelated changes. **Read this file at the start
of any task that touches the routes / route-details / journey screens, the warning
store/markers, or `use-route-warnings`, and re-verify the relevant rows before you
finish.** Verify with the screenshot/interaction loop in `DESIGN.md` (drive
puppeteer: open `/routes?start=Norbiton&end=Imperial%20College%20London`, click a
card → details → "Start journey").

## Notifications (`hooks/use-route-warnings.ts`, `app/journey.tsx`)
- [ ] Push notifications fire **only on the active-journey screen** (the hook's
      `notify` flag is `true` only there). The pre-Go route-details map must NOT
      notify, and revisiting the map must not re-fire alerts.
- [ ] You **never** get a notification for **your own** report — compared against
      `username || 'anonymous'` (logged-out reports are stored as `anonymous`), in
      both the hook's "new warning" effect and journey's "upcoming warning" effect.
- [ ] Others' warning notifications name roughly where: **"Sound reported near
      South Kensington"** (via `nearestRouteStop`), not a raw description.
- [ ] Notification icon is the Clearway logo (web `icon` option +
      app.json `expo-notifications` plugin icon).
- [ ] Existing warnings present when the journey opens are seeded into
      `knownWarningIdsRef` (no "new warning" spam on mount).

## Warning cards (`warningDisplayDesc` in `warning-markers.ts`)
- [ ] Your own report's card reads **"<thing> flagged by you"**.
- [ ] Someone else's reads **"<thing> flagged by <username>"**; live (non-user)
      warnings keep their stored description.

## Map markers & clustering (`warningMarkerScript` in `warning-markers.ts`)
- [ ] Warnings within ~100m **cluster** into one stacked marker (overlapping emoji
      discs + count badge).
- [ ] Tapping a single marker opens its action card; tapping a **cluster** posts
      `warningClusterClick` → a **breakdown list** card (journey + route-details).
- [ ] Start marker = green, **Destination marker = red**, change markers = white
      disc w/ mode emoji. (Both the journey map and the pre-Go details map.)

## Change-marker popups (journey `buildJourneyMap`, route-details `leafletHtml`)
- [ ] Tapping a change marker shows **"From X take Y at Z"** (e.g. "From walking
      take Bus 49 at South Kensington"); bus→bus reads **"Switch Bus X to Bus Y at
      Z"**.

## Journey screen layout (`app/journey.tsx`)
- [ ] Map key is the compact **2×2** card (col 1: Start, Destination; col 2:
      Walking, Changes) inline beside the back button. No home button.
- [ ] **Hide changes** + **Hide warnings** pills sit below the back button, inline,
      same size; opaque white, **dark-blue** when active (not mustard).
- [ ] **Report** rail header is the mustard-yellow "Report / below" pill; smell
      shows a 👃 emoji; the rail has a **Light** option (no "Other").
- [ ] The journey timeline shows **per-leg intermediate stops** (collapsible),
      consistent with the pre-Go details sheet — not just "get off at".

## Route-details (pre-Go) sheet (`route-details-modal.tsx`)
- [ ] Opaque background on web (no routes page bleeding through the top).
- [ ] Swipe-down on the sheet collapses smoothly (drag threshold is low).
- [ ] The map key legend is shown here too (top-left).
- [ ] No leg-summary title text at the top (just back/home).

## Routes list / search (`route-card.tsx`, `route-search-inputs.tsx`)
- [ ] "Leave by …" indicator is top-**left** of the card, **black** text.
- [ ] Bus legs are **red** (`#d4351c`), distinct from the orange crowds warning.
- [ ] Tapping a location input **selects all** its text.
- [ ] Autocomplete dropdown is opaque white (readable).

## Home (`app/(tabs)/index.tsx`)
- [ ] Brain **logo + "Clearway"** wordmark header (no "Plan a route" heading).
- [ ] Single rectangular **"Get me somewhere"** CTA with a search icon.
- [ ] Preset-glimpse sense labels are black/legible.

## Always
- [ ] `npm run lint` and `npx tsc --noEmit` pass; web export builds.
- [ ] `GET /routes/` contract unchanged; no raw `fetch`, no second styling system.
