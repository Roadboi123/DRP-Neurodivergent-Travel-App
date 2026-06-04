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

## Database & migrations

Schema lives in `migrations/` as ordered, immutable `NNNN_name.sql` files and is
applied by a small runner (`app/db/migrate.py`) over a **direct Postgres
connection** — the supabase REST client can't run DDL. Applied files are tracked
in a `schema_migrations` ledger; pending files run once, in filename order, each
in its own transaction (a session advisory lock serializes concurrent runners).

- **Add a migration:** create the next `migrations/NNNN_description.sql` (don't
  edit already-applied files). Use `CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF
  NOT EXISTS` so re-runs and the existing prod DB stay safe.
- **Apply locally:** `make migrate` (or `python -m app.db.migrate`). Needs
  `DATABASE_URL` — the Supabase **Session pooler** URI (port 5432, `?sslmode=require`),
  NOT the 6543 transaction pooler. See `.env.example`.
- **On deploy:** the `Procfile` runs `python -m app.db.migrate` before uvicorn, so
  Railway applies pending migrations on each deploy. It's **fail-fast**: a broken
  migration blocks boot, so test migrations before pushing. With `DATABASE_URL`
  unset the runner skips (exit 0) rather than failing.
- The runner is never imported by the app/services, so `pytest`/CI need no DB; its
  pure helpers are unit-tested in `tests/test_migrate.py`.

## Checks (match CI)

`ruff check .`, `mypy .`, `pytest -q`. ruff/mypy/pytest are installed by CI, not
pinned in `requirements.txt` — don't add them there.
