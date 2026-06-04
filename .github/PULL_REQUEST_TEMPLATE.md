## What & why

<!-- A short description of the change and the motivation. Link any issue. -->

## Checklist

- [ ] Branched off `main` with granular, scoped commits (no direct commits to `main`).
- [ ] **Backend** (if touched): `ruff check .`, `mypy .`, and `pytest -q` pass.
- [ ] **Frontend** (if touched): `npm run lint` and `npx tsc --noEmit` pass.
- [ ] **Contract** (if schemas changed): re-ran `python scripts/export_openapi.py` and committed `shared/openapi.json` (CI drift-guard passes).
- [ ] **`GET /routes/` is unchanged** (frozen contract) — or this PR deliberately and carefully changes it.
- [ ] **DB schema change**: added a `backend/migrations/NNNN_*.sql` (idempotent) rather than editing an applied one.
- [ ] **UI change**: attached before/after screenshots (light + dark) per `frontend/DESIGN.md`.

## Screenshots / notes

<!-- UI screenshots, deploy/setup notes (e.g. new env vars), or anything reviewers should know. -->
