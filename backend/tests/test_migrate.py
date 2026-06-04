"""Unit tests for the migration runner's pure helpers (no database).

These never open a connection — importing ``app.db.migrate`` must not connect, and
only the filename/version bookkeeping is exercised, so they run in CI without a DB.
"""

from pathlib import Path

from app.db import migrate
from app.db.migrate import (
    discover_migrations,
    pending_versions,
    run,
    split_sql_statements,
)


def _touch(dir_: Path, name: str) -> None:
    (dir_ / name).write_text("SELECT 1;\n", encoding="utf-8")


def test_discover_migrations_sorted_by_filename(tmp_path: Path):
    # Created out of order to prove sorting is by filename, not creation time.
    _touch(tmp_path, "0002_user_presets.sql")
    _touch(tmp_path, "0001_baseline.sql")
    _touch(tmp_path, "0010_later.sql")
    (tmp_path / "notes.txt").write_text("ignored", encoding="utf-8")  # non-.sql ignored

    found = discover_migrations(tmp_path)

    assert [v for v, _ in found] == ["0001_baseline", "0002_user_presets", "0010_later"]
    assert all(isinstance(p, Path) and p.suffix == ".sql" for _, p in found)


def test_discover_migrations_empty(tmp_path: Path):
    assert discover_migrations(tmp_path) == []


def test_pending_versions_filters_applied_and_preserves_order():
    allv = ["0001_baseline", "0002_user_presets", "0003_x"]
    assert pending_versions(allv, {"0001_baseline"}) == ["0002_user_presets", "0003_x"]
    assert pending_versions(allv, set()) == allv
    assert pending_versions(allv, set(allv)) == []


def test_split_sql_basic_statements():
    sql = "CREATE TABLE a (id int);\nCREATE TABLE b (id int);\n"
    assert split_sql_statements(sql) == ["CREATE TABLE a (id int)", "CREATE TABLE b (id int)"]


def test_split_sql_ignores_comments_and_blank_trailing():
    sql = (
        "-- a leading line comment; with a semicolon\n"
        "CREATE TABLE a (id int);\n"
        "/* block; comment; */\n"
        "CREATE TABLE b (id int)\n"  # no trailing semicolon
    )
    assert split_sql_statements(sql) == ["CREATE TABLE a (id int)", "CREATE TABLE b (id int)"]


def test_split_sql_respects_string_and_dollar_quotes():
    sql = (
        "INSERT INTO t (msg) VALUES ('hi; not a split''s end');\n"
        "CREATE FUNCTION f() RETURNS void AS $$ BEGIN PERFORM 1; PERFORM 2; END; $$ LANGUAGE plpgsql;\n"
    )
    stmts = split_sql_statements(sql)
    assert len(stmts) == 2
    assert stmts[0] == "INSERT INTO t (msg) VALUES ('hi; not a split''s end')"
    assert stmts[1].endswith("LANGUAGE plpgsql")
    assert "PERFORM 1; PERFORM 2;" in stmts[1]


def test_split_sql_empty():
    assert split_sql_statements("   \n -- just a comment\n") == []


def test_real_migration_files_split_into_statements():
    # The committed baseline contains three CREATE TABLE statements.
    _, path = next(p for p in discover_migrations(migrate.MIGRATIONS_DIR) if p[0] == "0001_baseline")
    stmts = split_sql_statements(path.read_text(encoding="utf-8"))
    assert len(stmts) == 3
    assert all(s.upper().startswith("CREATE TABLE") for s in stmts)


def test_run_skips_when_database_url_empty(capsys):
    # Empty URL must skip cleanly (exit 0) without attempting a connection.
    assert run(database_url="") == 0
    assert "skipping migrations" in capsys.readouterr().out.lower()


def test_real_migration_files_are_ordered_and_named():
    # The committed migrations resolve and are in the expected order.
    found = discover_migrations(migrate.MIGRATIONS_DIR)
    versions = [v for v, _ in found]
    assert versions[:2] == ["0001_baseline", "0002_user_presets"]
