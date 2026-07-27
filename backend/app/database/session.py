"""
Mbamager Database Session Management

This module configures the async SQLAlchemy engine and session factory. Every
repository in app/repositories/ is written against `AsyncSession` (async def
methods, `await self.db.execute(...)`, etc.), so the engine created here MUST
be async — a sync engine would break every service call at runtime.
"""

from typing import AsyncGenerator
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import settings

# Load database URL from validated application settings.
# Expected format uses an async driver, e.g.:
#   postgresql+asyncpg://user:pass@host:port/db   (production / local Postgres)
#   sqlite+aiosqlite:///:memory:                  (test suite, see tests/conftest.py)
DATABASE_URL: str = settings.DATABASE_URL

# SQLite (aiosqlite) requires check_same_thread=False since FastAPI can hand a
# connection across threads. Postgres (asyncpg) does not need this.
connect_args: dict = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

# Managed Postgres providers (Neon, Render, Supabase, ...) hand out connection
# strings with a libpq-style `?sslmode=require` query param. That's exactly
# what Alembic's sync psycopg2 engine (see alembic/env.py) expects, but
# asyncpg.connect() has no `sslmode` kwarg and raises a TypeError if it's
# passed through verbatim -- it only understands `ssl`. Strip `sslmode` out
# of the URL used to build the async engine and re-supply it as `ssl` via
# connect_args instead, so the exact same DATABASE_URL a provider gives you
# works unmodified for both the app (asyncpg) and Alembic (psycopg2).
if DATABASE_URL.startswith("postgresql"):
    _parts = urlsplit(DATABASE_URL)
    _query_pairs = parse_qsl(_parts.query, keep_blank_values=True)
    _sslmode = next((v for k, v in _query_pairs if k.lower() == "sslmode"), None)
    if _sslmode is not None:
        _remaining = [(k, v) for k, v in _query_pairs if k.lower() != "sslmode"]
        DATABASE_URL = urlunsplit(
            (_parts.scheme, _parts.netloc, _parts.path, urlencode(_remaining), _parts.fragment)
        )
        connect_args = {**connect_args, "ssl": _sslmode}

# pool_pre_ping avoids "server closed the connection unexpectedly" errors on
# Postgres connections that have gone stale (idle timeout, restart, etc.).
engine: AsyncEngine = create_async_engine(
    DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=not DATABASE_URL.startswith("sqlite"),
    echo=False,
)

SessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency injector for async database sessions.

    Commits on clean completion, rolls back on exception, always closes.
    Ensures sessions are properly cleaned up after each HTTP request lifetime.
    """
    async with SessionLocal() as db:
        try:
            yield db
            await db.commit()
        except Exception:
            await db.rollback()
            raise
