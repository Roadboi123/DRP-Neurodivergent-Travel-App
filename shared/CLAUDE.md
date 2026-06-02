# shared/ — cross-language API contract

`openapi.json` is the contract handed between backend and frontend. It is
**generated, never hand-edited**.

- Source of truth: `backend/app/schemas/*.py` (Pydantic).
- Generated here by: `backend/scripts/export_openapi.py`.
- Consumed by: `frontend` codegen (`npm run gen:api`) → `frontend/src/types/generated/`.

Python can't import TS and Metro won't bundle outside `frontend/`, so this is a
build-time artifact, not runtime-imported by either side.

`openapi.json` is the **only committed artifact**. The frontend types
(`frontend/src/types/generated/`) are gitignored and regenerated on install/CI/build.

To change the contract: edit the Pydantic schema, run `python
backend/scripts/export_openapi.py`, and commit `openapi.json` (just one command —
the frontend types regenerate themselves). The backend CI drift guard fails if
`openapi.json` is stale versus the schemas. See `README.md` for the full walkthrough.
