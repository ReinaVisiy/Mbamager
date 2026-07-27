import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.database.base import Base
from app.database.session import get_db
from app.main import app

# Isolated in-memory async SQLite database for the test suite. A fresh engine
# is created per test (function scope) so it always binds to the event loop
# that test is running in, and to avoid state leaking between tests.
SQLALCHEMY_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest_asyncio.fixture
async def db_session():
    engine = create_async_engine(
        SQLALCHEMY_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    testing_session_local = async_sessionmaker(
        bind=engine, class_=AsyncSession, expire_on_commit=False
    )

    async with testing_session_local() as session:
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest.fixture
def client(db_session):
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def reset_rate_limiters():
    """
    auth_limiter/sms_limiter/ai_limiter (app/core/rate_limiter.py) are
    module-level singletons that persist for the life of the Python
    process, keyed by client IP. TestClient always uses the same fixed
    IP, so without resetting this between tests, running the full suite
    trips the real rate limit after ~10 auth calls even though each test
    is otherwise isolated via its own in-memory database.
    """
    from app.core.rate_limiter import auth_limiter, sms_limiter, ai_limiter

    auth_limiter.history.clear()
    sms_limiter.history.clear()
    ai_limiter.history.clear()
    yield
