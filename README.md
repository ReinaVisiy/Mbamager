# Mbamager

A personal finance application for Cameroonian Mobile Money users (MTN MoMo, Orange Money). It reads unstructured Mobile Money SMS confirmations, turns them into a structured transaction ledger, and layers budgets, savings goals, recurring transactions, Tontine/Njangi group savings, scam detection, and AI-assisted coaching on top.

## Stack

- **Backend:** FastAPI (Python 3.12), SQLAlchemy 2.0 (async), Alembic migrations, PostgreSQL 16
- **Frontend:** React 19, TypeScript, Tailwind CSS, React Query, Zustand
- **AI:** Google Gemini, used for SMS parsing fallback, transaction categorization, scam analysis, budget coaching, and a conversational assistant. See `docs/ARCHITECTURE.md` for what the AI is and is not allowed to do.

## Project layout

```
backend/
  app/
    api/routes/      FastAPI routers (HTTP transport only)
    services/        Deterministic business logic
    repositories/     Database queries
    models/           SQLAlchemy tables
    schemas/          Pydantic request/response contracts
    ai/               Gemini prompt templates and the AI service
  alembic/            Migrations
  tests/

frontend/
  src/
    pages/
    components/
    services/         One file per API domain, all routed through lib/api.ts
    types/            Shared domain types

docs/
  ARCHITECTURE.md         Engineering rules (money precision, AI boundaries, layering)
  PROJECT_STATE.md        Sprint history and current status
  DOMAIN_MODEL_REVIEW.md
```

## Running locally

### With Docker Compose (backend + frontend + Postgres)

```
docker compose up
```

Backend on `:8000`, frontend on the port configured in `docker-compose.yml`, Postgres on `:5432`.

### Backend only

```
cd backend
cp .env.example .env   # fill in JWT_SECRET_KEY, GEMINI_API_KEY, etc.
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Tests run against an in-memory SQLite database, no Postgres required:

```
cd backend
pytest
```

### Frontend only

```
cd frontend
npm install
npm run dev
```

## A core engineering rule

Authoritative financial calculations (balances, budget totals, net worth, transaction amounts) are always computed deterministically in the backend services, never by the AI. Gemini assists with parsing, categorization suggestions, scam analysis, and natural-language coaching, but never owns or writes ledger state. See `docs/ARCHITECTURE.md` for the full rule set.

## Contributing

This codebase is being incrementally cleaned up on `refactor/ai-slop-cleanup`; see `docs/PROJECT_STATE.md` for the current status and pending items.
