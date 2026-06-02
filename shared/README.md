# `shared/` — the cross-language API contract

The frontend (TypeScript/Expo) and backend (Python/FastAPI) can't import the same
source files, so the HTTP API contract is shared as a **build-time artifact** rather
than runtime code:

- **`openapi.json`** — the contract, **generated** from the backend's Pydantic
  schemas. It is the single handoff point between the two codebases. Do **not**
  hand-edit it.

## Source of truth

The Pydantic schemas in `backend/app/schemas/` define the contract. `openapi.json`
is generated from them; the frontend's TypeScript types in
`frontend/src/types/generated/` are in turn generated from `openapi.json`. The flow
is one-directional:

```
backend/app/schemas/*.py   →   shared/openapi.json   →   frontend/src/types/generated/api.ts
   (edit here)                  (generated)               (generated)
```

## Changing the contract

1. Edit the relevant Pydantic model in `backend/app/schemas/`.
2. Regenerate the contract:
   ```bash
   cd backend && python scripts/export_openapi.py
   ```
3. Regenerate the frontend types:
   ```bash
   cd frontend && npm run gen:api
   ```
4. Commit all three changes together.

CI enforces this: the backend job fails if `openapi.json` is stale versus the
schemas, and the frontend job fails if the generated TS is stale versus
`openapi.json`. So skipping a regeneration step breaks the build rather than
silently drifting.

## Note on the `/routes/` contract

`GET /routes/` is consumed by the live frontend with exact field names (note the
camelCase `subName` alongside the snake_case `sensory_score` /
`match_percentage` / `sensory_description`). Tightening a Pydantic annotation is
fine as long as JSON serialization is unchanged — verify with the TestClient
baseline-diff method described in the backend docs before committing.
