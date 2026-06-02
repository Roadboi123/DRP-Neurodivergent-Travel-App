# Backend (FastAPI)

Python 3.12.3. Entrypoint `app.main:app` (see `Procfile`). Layered:

- `app/api/` — thin HTTP handlers; each module exposes `router = APIRouter`.
- `app/services/` — business logic, FastAPI-free (`routes.py` holds the sensory
  scoring algorithm; `preferences.py` orchestrates Supabase persistence).
- `app/schemas/` — Pydantic request/response models. **These are the single
  source of truth for the HTTP API contract.**
- `app/data/route_seed.py` — mock route catalogue. `app/config.py` — env/settings.
  `app/integrations/supabase.py` — Supabase client.

## Contract source of truth

After editing anything in `app/schemas/`, regenerate the shared contract:

```bash
python scripts/export_openapi.py   # writes ../shared/openapi.json
```

Then regenerate the frontend types (`cd ../frontend && npm run gen:api`) and
commit all three together. Backend CI fails if `shared/openapi.json` is stale.

`GET /routes/` is frozen: keep field names and scoring output byte-identical.
Annotation tightening is safe only when JSON serialization is unchanged — verify
with a `fastapi.testclient.TestClient` baseline diff before committing.

## Checks (match CI)

`ruff check .`, `mypy .`, `pytest -q`. ruff/mypy/pytest are installed by CI, not
pinned in `requirements.txt` — don't add them there.
