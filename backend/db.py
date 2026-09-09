"""Postgres access: a psycopg connection pool plus idempotent schema application."""
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

import psycopg
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from config import get_settings

SCHEMA_PATH = Path(__file__).parent / "schema.sql"

_pool: ConnectionPool | None = None


def _configure(conn: psycopg.Connection) -> None:
    schema = get_settings().db_schema
    if schema != "public":
        conn.execute(f'SET search_path TO "{schema}", public')
        conn.commit()


def init_pool() -> ConnectionPool:
    global _pool
    if _pool is None:
        _pool = ConnectionPool(
            get_settings().conninfo,
            min_size=1,
            max_size=8,
            kwargs={"row_factory": dict_row, "autocommit": True},
            configure=_configure,
            open=True,
            # Validate connections handed out; hosted DBs drop idle SSL sessions.
            check=ConnectionPool.check_connection,
        )
    return _pool


def close_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None


@contextmanager
def get_conn() -> Iterator[psycopg.Connection]:
    """Borrow a pooled connection (autocommit). Use `with conn.transaction():` for atomic groups."""
    with init_pool().connection() as conn:
        yield conn


def apply_schema() -> None:
    """Apply schema.sql. Every statement is idempotent so this is safe on every startup."""
    sql = SCHEMA_PATH.read_text(encoding="utf-8")
    with get_conn() as conn:
        conn.execute(sql)


def create_schema_namespace(name: str) -> None:
    """Create an isolated Postgres schema (used by the test-suite)."""
    with get_conn() as conn:
        conn.execute(f'CREATE SCHEMA IF NOT EXISTS "{name}"')


def drop_schema_namespace(name: str) -> None:
    with get_conn() as conn:
        conn.execute(f'DROP SCHEMA IF EXISTS "{name}" CASCADE')
