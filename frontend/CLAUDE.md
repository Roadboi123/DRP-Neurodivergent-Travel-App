@AGENTS.md

# Frontend (Expo / React Native)

All source under `src/`, with `@/*` → `./src/*`:

- `src/app/` — expo-router routes only (thin screens). Folder **must** stay named
  `app` (expo-router requirement).
- `src/components/{home,routes,preferences,ui}/` — decomposed UI (kebab-case
  files, PascalCase exports).
- `src/services/` — API client + per-domain fetchers.
- `src/types/` — shared TS types. `route.ts`/`preference.ts` re-export the
  **generated** contract and add frontend-only types (`WarningItem`, UI `Preference`).
- `src/constants/` — `config.ts` (`API_BASE_URL`), `theme.ts` (`getPalette`).
- `assets/` + config (`app.json`, `vercel.json`) live at the `frontend/` root.

## Generated API types — do not hand-edit

`src/types/generated/api.ts` is generated from `../shared/openapi.json`. After the
backend contract changes (and `shared/openapi.json` is regenerated):

```bash
npm run gen:api
```

Then commit. CI fails if the generated types are stale. Import contract types via
`@/types/route` / `@/types/preference` (which re-export the generated schemas),
not from `generated/` directly.

## Checks (match CI)

`npm run lint` (expo lint) and `npx tsc --noEmit`. Web build: `npx expo export --platform web`.
