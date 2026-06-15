@AGENTS.md
@DESIGN.md

# Frontend (Expo / React Native)

> **Before any UI work, read `DESIGN.md`** — the design system and the **required**
> screenshot-verification loop live there.

All source under `src/`, with `@/*` → `./src/*`:

- `src/app/` — expo-router routes only (thin screens). Folder **must** stay named
  `app` (expo-router requirement).
- `src/components/{home,routes,preferences,ui}/` — decomposed UI (kebab-case
  files, PascalCase exports).
- `src/services/` — injectable HTTP client + per-domain services (see below).
- `src/types/` — shared TS types. `route.ts`/`preference.ts` re-export the
  **generated** contract and add frontend-only types (`WarningItem`, UI `Preference`).
- `src/constants/` — `config.ts` (`API_BASE_URL`), `theme.ts` (the **Clearway** design
  tokens: `CLEARWAY`, `GLASS`, `Radii`, `softShadow`, `ClearwayFonts`; legacy `getPalette` etc.
  are calm-value shims). Reusable glass primitives (`Glass`, `GlassCard`, `GlassButton`, `Chip`,
  `GradientDot`, `GradientBackground`) live in `src/components/ui/`. **Read `DESIGN.md`.**
- `assets/` + config (`app.json`, `vercel.json`) live at the `frontend/` root.

## Services — dependency injection (read before adding a service or endpoint)

Services are injected, not imported directly. The dependency flow:

```
constants/config.ts (URL strings)
  → services/client-config.ts   createApiClient / createLocalApiClient  ← the ONLY endpoint decision
  → services/http-client.ts      createHttpClient({ baseUrl }) + HttpClient interface
  → services/fallback-client.ts  createFallbackClient(primary, fallback) — transparent failover
  → services/services-context.tsx  createDefaultServices() composition root + ServicesProvider + hooks
  → screens consume useRoutesService / usePreferencesService / useHealthService
```

Rules:
- **No URL outside `client-config.ts`.** Screens/services must never import
  `constants/config.ts` or build a host string. To repoint a backend or change
  which service gets failover, edit `createDefaultServices()` only.
- Services are factory functions (`createXService(client)`) depending on the
  `HttpClient` interface, returning an object of methods — never call `fetch`
  directly. Use `client.get`/`post` (throw on non-ok) or `client.getResponse`
  when a status like 404 is data, not an error.
- Screens get services via the `useXService()` hooks, never by importing the
  service module. Add the service to effect dep arrays (it's a stable ref).
- Mock in tests by rendering under `<ServicesProvider value={mockServices}>`.

## Generated API types — generated, not committed

`src/types/generated/api.ts` is generated from `../shared/openapi.json` and is
**gitignored** — never commit it, never hand-edit it. It's produced automatically:
on `npm install` (`prepare` script), in CI before lint/tsc, and in the Vercel build
(`gen:api` in `vercel.json`'s `buildCommand`). A fresh clone has no `api.ts` until
the first `npm install`; run `npm run gen:api` manually if you need it sooner.

Import contract types via `@/types/route` / `@/types/preference` (which re-export
the generated schemas), not from `generated/` directly.

## Checks (match CI)

`npm run lint` (expo lint) and `npx tsc --noEmit`. Web build: `npx expo export --platform web`.
