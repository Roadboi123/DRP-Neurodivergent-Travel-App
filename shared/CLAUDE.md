# shared/ — cross-language API contract

`openapi.json` is the contract handed between backend and frontend. It is
**generated, never hand-edited**.

- Source of truth: `backend/app/schemas/*.py` (Pydantic).
- Generated here by: `backend/scripts/export_openapi.py`.
- Consumed by: `frontend` codegen (`npm run gen:api`) → `frontend/src/types/generated/`.

Python can't import TS and Metro won't bundle outside `frontend/`, so this is a
build-time artifact, not runtime-imported by either side.

To change the contract: edit the Pydantic schema, then regenerate both ends
(`export_openapi.py`, then `gen:api`) and commit together. CI drift guards in both
workflows fail if either artifact is stale. See `README.md` for the full walkthrough.
