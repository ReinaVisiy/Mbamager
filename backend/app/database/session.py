"""
Mbamager Database Session Management

This module configures the async SQLAlchemy engine and session factory. Every
repository in app/repositories/ is written against `AsyncSession` (async def
methods, `await self.db.execute(...)`, etc.), so the engine created here MUST
be async — a sync engine would break every service call at runtime.
"""

from typing import AsyncGenerator

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
