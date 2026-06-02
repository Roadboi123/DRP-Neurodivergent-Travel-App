# DRP Neurodivergent Travel App

Monorepo with three areas, each with its own `CLAUDE.md`:

- `frontend/` — Expo / React Native client (deployed on Vercel). See `frontend/CLAUDE.md`.
- `backend/` — FastAPI service (deployed on Railway, Supabase storage). See `backend/CLAUDE.md`.
- `shared/` — the cross-language API contract (`openapi.json`). See `shared/CLAUDE.md`.

## API contract (read before touching types)

The HTTP contract has **one source of truth**: the Pydantic schemas in
`backend/app/schemas/`. It flows one direction:

```
backend/app/schemas/*.py  →  shared/openapi.json  →  frontend/src/types/generated/api.ts
   (edit here)                 (committed)              (generated, gitignored)
```

To change it: edit the schema → `cd backend && python scripts/export_openapi.py` →
commit `shared/openapi.json`. That's the only manual step; `api.ts` is gitignored and
regenerated on install/CI/Vercel build. The backend CI drift guard fails if
`openapi.json` is stale versus the schemas.

`GET /routes/` is **frozen** — the live frontend depends on exact field names
(`subName` camelCase alongside snake_case `sensory_score`/`match_percentage`/
`sensory_description`) and byte-identical scoring output. Tightening a Pydantic
annotation is fine only if JSON serialization is unchanged; verify with a
TestClient baseline diff.

## Conventions

- Branch off `main`; never commit straight to it. Granular, scoped commits.
- CI runs per-area (`.github/workflows/{backend,frontend}.yml`) on path triggers.
