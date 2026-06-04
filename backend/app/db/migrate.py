"""Tiny forward-only SQL migration runner for the Supabase Postgres database.

The app talks to Supabase through the REST client, which cannot run DDL, so
schema changes live as ordered ``backend/migrations/NNNN_name.sql`` files and are
applied here against a direct Postgres connection (``DATABASE_URL`` — the Supabase
*Session* pooler URI). Applied files are recorded in a ``schema_migrations``
ledger; pending files run once, in filename order, each in its own transaction.

Run manually with ``python -m app.db.migrate`` (or ``make migrate``); it also runs
automatically before the web server on deploy (see ``Procfile``).

This module is intentionally NOT imported by the app/services, so the test suite
and CI never need a database or a live connection — a connection is only opened
inside ``run()``.
"""

from __future__ import annotations

from pathlib import Path

import psycopg

from app.config import settings

# backend/app/db/migrate.py -> parents[2] == backend/
MIGRATIONS_DIR: Path = Path(__file__).resolve().parents[2] / "migrations"

# Fixed session-advisory-lock key (bytes of "DRPMIG") so concurrent boots/instances
# serialize: only one process applies migrations at a time; the rest wait then find
# nothing pending.
ADVISORY_LOCK_KEY: int = 0x4452504D4947


def discover_migrations(migrations_dir: Path = MIGRATIONS_DIR) -> list[tuple[str, Path]]:
    """Return ``(version, path)`` for every ``*.sql`` file, sorted by filename.

    ``version`` is the filename stem (e.g. ``"0001_baseline"``). Pure — no DB.
    """
    files = sorted(migrations_dir.glob("*.sql"), key=lambda p: p.name)
    return [(p.stem, p) for p in files]


def pending_versions(all_versions: list[str], applied: set[str]) -> list[str]:
    """Return the versions not yet applied, preserving original order. Pure — no DB."""
    return [v for v in all_versions if v not in applied]


def split_sql_statements(sql: str) -> list[str]:
    """Split a SQL script into individual statements on top-level ``;``. Pure — no DB.

    We execute statements one at a time (rather than relying on multi-statement
    ``execute``) so behaviour doesn't depend on psycopg's protocol selection. The
    splitter is aware of ``--`` line comments, ``/* */`` block comments, single-quoted
    strings, and ``$tag$ … $tag$`` dollar-quoting (so PL/pgSQL bodies stay intact).
    """
    statements: list[str] = []
    buf: list[str] = []
    i, n = 0, len(sql)

    while i < n:
        ch = sql[i]
        two = sql[i : i + 2]

        if two == "--":  # line comment → skip to end of line
            j = sql.find("\n", i)
            i = n if j == -1 else j
            continue
        if two == "/*":  # block comment → skip to closing */
            j = sql.find("*/", i + 2)
            i = n if j == -1 else j + 2
            continue
        if ch == "'":  # single-quoted string (doubled '' is an escaped quote)
            buf.append(ch)
            i += 1
            while i < n:
                buf.append(sql[i])
                if sql[i] == "'":
                    if i + 1 < n and sql[i + 1] == "'":
                        buf.append(sql[i + 1])
                        i += 2
                        continue
                    i += 1
                    break
                i += 1
            continue
        if ch == "$":  # possible dollar-quote opener: $tag$
            j = i + 1
            while j < n and (sql[j].isalnum() or sql[j] == "_"):
                j += 1
            if j < n and sql[j] == "$":
                tag = sql[i : j + 1]
                end = sql.find(tag, j + 1)
                end = n if end == -1 else end + len(tag)
                buf.append(sql[i:end])
                i = end
                continue
        if ch == ";":  # statement boundary
            stmt = "".join(buf).strip()
            if stmt:
                statements.append(stmt)
            buf = []
            i += 1
            continue

        buf.append(ch)
        i += 1

    tail = "".join(buf).strip()
    if tail:
        statements.append(tail)
    return statements


def _ensure_ledger(conn: psycopg.Connection) -> None:
    conn.execute(
        "CREATE TABLE IF NOT EXISTS schema_migrations ("
        "    version text PRIMARY KEY,"
        "    applied_at timestamptz NOT NULL DEFAULT now()"
        ")"
    )


def _applied(conn: psycopg.Connection) -> set[str]:
    rows = conn.execute("SELECT version FROM schema_migrations").fetchall()
    return {row[0] for row in rows}


def _apply_one(conn: psycopg.Connection, version: str, sql_path: Path) -> None:
    """Run a migration file and record it, atomically, in one transaction.

    Each statement in the file runs individually, then the ledger row is inserted —
    all within one ``conn.transaction()`` so the DDL and its bookkeeping commit
    together (or roll back together on error).
    """
    statements = split_sql_statements(sql_path.read_text(encoding="utf-8"))
    with conn.transaction():
        for statement in statements:
            conn.execute(statement)  # type: ignore[arg-type]
        conn.execute("INSERT INTO schema_migrations (version) VALUES (%s)", (version,))


def run(database_url: str | None = None) -> int:
    """Apply pending migrations. Returns a process exit code (0 ok/skip, 1 failure)."""
    url = database_url if database_url is not None else settings.DATABASE_URL
    if not url:
        print("DATABASE_URL not set; skipping migrations.")
        return 0

    migrations = discover_migrations()
    if not migrations:
        print(f"No migration files found in {MIGRATIONS_DIR}; nothing to do.")
        return 0

    try:
        with psycopg.connect(url, autocommit=True) as conn:
            conn.execute("SELECT pg_advisory_lock(%s)", (ADVISORY_LOCK_KEY,))
            try:
                _ensure_ledger(conn)
                applied = _applied(conn)
                path_by_version = dict(migrations)
                pending = pending_versions([v for v, _ in migrations], applied)

                if not pending:
                    print(f"Schema up to date ({len(applied)} migration(s) applied).")
                    return 0

                for version in pending:
                    print(f"Applying migration {version} ...")
                    _apply_one(conn, version, path_by_version[version])

                print(f"Applied {len(pending)} migration(s): {', '.join(pending)}.")
                return 0
            finally:
                conn.execute("SELECT pg_advisory_unlock(%s)", (ADVISORY_LOCK_KEY,))
    except psycopg.OperationalError as exc:
        print(f"Could not connect to the database: {exc}")
        return 1
    except Exception as exc:  # noqa: BLE001 — surface any migration error as a non-zero exit
        print(f"Migration failed: {exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(run())
