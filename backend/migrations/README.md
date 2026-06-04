# Database migrations

A plain-English guide. For the terse technical reference see the
"Database & migrations" section in `backend/CLAUDE.md`.

## What this is and why

A database has a **schema** — its tables and columns. As the app changes, the
schema has to change too (e.g. adding the `user_presets` table). The old way was
creating/altering tables **by hand** in the Supabase dashboard, which is easy to
forget and leaves no record — that's exactly why production was once missing
`user_presets` and saving presets returned a 500.

A **migration** is a small, numbered `.sql` file describing one schema change,
committed to git. A tiny runner applies them, so the schema is **version-controlled
like code**: reproducible, reviewable, and identical on every machine.

## The files

`backend/migrations/` holds ordered files that each run **once, in order**:

- `0001_baseline.sql` — the tables that already existed (`user_credentials`,
  `user_sensitivities`, `healthcheck`). Uses `CREATE TABLE IF NOT EXISTS`, so it
  does nothing on the live database (they're already there) but rebuilds them on a
  fresh/empty one.
- `0002_user_presets.sql` — the `user_presets` table.

Files are **immutable**: once a file has been applied anywhere, never edit it — add
the next `0003_*.sql` for the next change.

## Running them: `make migrate`

`make migrate` runs `python -m app.db.migrate`, which:

1. **Connects** to Postgres using `DATABASE_URL`.
2. **Takes a lock** so two processes can't migrate at the same time.
3. **Ensures a `schema_migrations` table** exists — bookkeeping that records which
   migration files have already run (by name).
4. **Finds the pending files** (those in `migrations/` not yet in `schema_migrations`).
5. **Applies each pending file** inside a transaction (all-or-nothing) and records
   its name.
6. **Done.** Run it again and nothing is pending → it's a no-op.

That last point is the key property: it is **idempotent** — it only ever runs *new*
migrations and is safe to run any number of times.

## When does it run?

- **On deploy (automatic):** the `Procfile` runs `python -m app.db.migrate` before
  the web server, so Railway applies pending migrations on **every deploy**. You
  don't run anything for production. It's fail-fast — a broken migration blocks boot
  rather than serving a half-migrated schema, so test migrations before pushing.
- **Locally / manually:** `make migrate` (e.g. after pulling new migration files, or
  to apply without a deploy).

## Adding a new migration

1. Create `backend/migrations/000N_short_description.sql` (next number).
2. Write idempotent DDL — prefer `CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD
   COLUMN IF NOT EXISTS`, etc.
3. Apply it: `make migrate` (locally) — it'll go out automatically on the next deploy.

## `DATABASE_URL`

The runner needs a **direct Postgres** connection (the Supabase REST client can't
run DDL). Use the Supabase **Session pooler** connection string (Project Settings →
Database → Connection string → Session, port 5432), append `?sslmode=require`, and
set it as `DATABASE_URL` in `backend/.env` (local) and in Railway's service variables
(production). See `backend/.env.example`. If `DATABASE_URL` is unset the runner skips
cleanly (so an unconfigured environment still boots — it just won't have the schema).
