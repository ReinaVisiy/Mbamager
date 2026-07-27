"""
Mbamager Application Entrypoint

Instantiates the FastAPI app, wires in production-hardening middleware, global
exception handlers, and every API router under the /api/v1 prefix. Exposes
/, /health, /ready, and /version for uptime monitoring and load balancers.
"""

from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routes import (
    account,
    assistant,
    auth,
    budget,
    dashboard,
    goals,
    notifications,
    recurring_transactions,
    scam,
    search,
    sms,
    tontine,
    transaction,
)
from app.core.config import settings
from app.core.exceptions import setup_exception_handlers
from app.core.middleware import setup_middleware
from app.core.scheduler import create_scheduler
from app.database.session import get_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application startup/shutdown hook. Starts the APScheduler instance that
    drives automatic recurring-transaction processing (see core/scheduler.py)
    and shuts it down cleanly on app exit.
    """
    scheduler = create_scheduler()
    scheduler.start()
    app.state.scheduler = scheduler
    try:
        yield
    finally:
        scheduler.shutdown(wait=False)
        app.state.scheduler = None


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    debug=settings.DEBUG,
    lifespan=lifespan,
)

# --- Middleware --------------------------------------------------------------------------

setup_middleware(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS_LIST,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Exception handlers --------------------------------------------------------------------

setup_exception_handlers(app)

# --- Routers -------------------------------------------------------------------------------

API_V1_PREFIX = "/api/v1"

app.include_router(account.router, prefix=API_V1_PREFIX)
app.include_router(assistant.router, prefix=API_V1_PREFIX)
app.include_router(auth.router, prefix=API_V1_PREFIX)
app.include_router(budget.router, prefix=API_V1_PREFIX)
app.include_router(dashboard.router, prefix=API_V1_PREFIX)
app.include_router(goals.router, prefix=API_V1_PREFIX)
app.include_router(notifications.router, prefix=API_V1_PREFIX)
app.include_router(recurring_transactions.router, prefix=API_V1_PREFIX)
app.include_router(scam.router, prefix=API_V1_PREFIX)
app.include_router(search.router, prefix=API_V1_PREFIX)
app.include_router(sms.router, prefix=API_V1_PREFIX)
app.include_router(tontine.router, prefix=API_V1_PREFIX)
app.include_router(transaction.router, prefix=API_V1_PREFIX)

# --- System endpoints ------------------------------------------------------------------------

@app.get("/")
async def root() -> dict:
    """
    Welcome / landing endpoint.
    """
    return {
        "message": f"Welcome to {settings.PROJECT_NAME}",
        "tagline": "Understand it. Protect it. Grow it.",
        "status": "online",
        "version": settings.VERSION,
    }


@app.get("/health")
async def health(db: AsyncSession = Depends(get_db)) -> dict:
    """
    Liveness/health probe. Checks database connectivity and reports the
    configured state of the AI layer and recurring-transaction scheduler.
    """
    try:
        await db.execute(text("SELECT 1"))
        database_status = "connected"
    except Exception:
        database_status = "disconnected"

    return {
        "status": "healthy" if database_status == "connected" else "degraded",
        "database": database_status,
        "ai_availability": "configured" if settings.GEMINI_API_KEY else "not_configured",
        "scheduler": "running" if getattr(app.state, "scheduler", None) else "stopped",
    }


@app.get("/ready")
async def ready() -> dict:
    """
    Readiness probe for orchestrators (Docker/Kubernetes-style).
    """
    return {"ready": True}


@app.get("/version")
async def version() -> dict:
    """
    Reports the running application version.
    """
    return {"version": settings.VERSION}
