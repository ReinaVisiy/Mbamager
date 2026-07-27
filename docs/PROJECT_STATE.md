# Mbamager — Project State & Roadmap
*A living documentation of the Mbamager AI Financial Operating System for the Unbanked and Underbanked.*

---

## 1. Project Vision
Mbamager is designed as a secure, non-custodial **AI-powered Financial Operating System** tailored for the unbanked and underbanked population of Cameroon. By removing the barrier of traditional bank integrations, Mbamager empowers users to capture cash transactions, understand expenditure, protect against mobile money scams, and grow wealth through local informal mechanisms like Njangis.

---

## 2. Product Pitch
For millions of Cameroonians, Mobile Money (MTN MoMo, Orange Money) is their bank, yet they lack tools to analyze, secure, and plan their cash flow. Mbamager fills this gap by reading unstructured SMS confirmations, turning them into clean structured financial statements, alerting users to rampant fraud patterns, and acting as a bilingual financial advisor that respects local contexts.

---

## 3. Tagline
> **Understand it. Protect it. Grow it.**

---

## 4. Architecture Status
The technical architecture of Mbamager is **frozen** and follows a strictly decoupled **Clean Architecture**:

*   **Frontend:** React (SPA) + Tailwind CSS + Lucide Icons. Built with desktop precision and a responsive, warm mobile-first layout.
*   **Backend:** FastAPI (Python 3.12). Replaced the temporary Express node layer with Vite development static proxying to directly route API calls.
*   **Database:** PostgreSQL 16 (via Docker Compose, `postgresql+asyncpg://` async driver), mapped via SQLAlchemy 2.0 ORM.
*   **Migrations:** Alembic configured with auto-generation support, mapped models, and custom database URL properties.
*   **Cognitive Services:** Server-side Gemini API SDK (`@google/genai` or `google-genai` Python library) driving the AI Layer with isolated prompts.

---

## 5. Frozen Engineering Rules

1.  **AI Never Owns Money (Core Engineering Law):** Under no circumstances may AI compute, calculate, write, or modify financial ledger balances, budgets, nets, or transactions. All calculations must be performed by deterministic Python business services. The AI is restricted strictly to text parsing, scam risk classification, insight suggestions, translation, and coaching.
2.  **Financial Precision:** The `float` data type is banned for financial values. All money, transactions, fees, and balances must be stored and calculated using Python's `decimal.Decimal` class and PostgreSQL `Numeric(precision=18, scale=2)` configurations.
3.  **Two-Stage Parsing Pipeline:** The SMS transaction parsing system must always attempt fast, local, and free regular expression matches (Stage 1) from `app/constants/sms_patterns.py` first. It may only fallback to Gemini API parsing (Stage 2) if regex confidence is zero, minimizing API latency and preserving free-tier quotas.
4.  **Modular, Layered Responsibility:**
    *   **Routers:** Handle HTTP transport only; no calculations.
    *   **Services:** Implement deterministic business algorithms.
    *   **Repositories:** Execute database CRUD operations.
    *   **Models:** Define SQLAlchemy database tables only.
    *   **Schemas:** Handle validation using strict Pydantic configurations.
    *   **AI Layer:** Implement isolated cognitive services translating raw metrics to conversational guidance.

---

## 6. Current Sprint
*   **Active Sprint:** Sprint 8 complete — all 5 items from the last master review are closed. See Section 7.
*   **Goal going forward:** Keep expanding test coverage (AI services still untested).

---

## 7. Completed Tasks
*   [x] Created complete folder structure for backend (`backend/app/`) and frontend (`frontend/src/`).
*   [x] Initialized all package namespaces with `__init__.py` files and documentation headers.
*   [x] Built the application configuration engine (`core/config.py`) and bcrypt/JWT security utilities (`core/security.py`).
*   [x] Built the database integration files (`database/base.py` and `database/session.py`) mapped to Pydantic settings.
*   [x] Generated constants files containing payment providers, transaction categories, currency rules (FCFA), and Mobile Money regex patterns.
*   [x] Generated standard Python cognitive class blueprints for all 5 product tools: M-PARSE, SENTINEL, COMPASS, PULSE, and GUIDE.
*   [x] Isolated AI Prompt assets into standalone markdown files inside `app/prompts/` to ensure clear separation of concerns.
*   [x] Fully configured Alembic framework (`alembic.ini`, `env.py`, `script.py.mako`) for schema migrations.
*   [x] Integrated a Vite dev server proxy middleware inside `vite.config.ts` to mock fast `/health` and `/` REST responses directly during frontend preview testing.
*   [x] Deleted default template source directories to maintain pristine workspace hygiene.
*   [x] Designed a professional, responsive React landing dashboard centering a real-time health indicator, architectural descriptions, and an interactive Stage 1 regex sandbox playground.
*   [x] Designed and implemented five modular SQLAlchemy 2.0 models: `User`, `FinancialProfile`, `Account`, `Transaction`, and `Budget`.
*   [x] Explicitly imported and exported all SQLAlchemy models inside `app/models/__init__.py` and registered them inside Alembic `env.py` to ensure reliable migration auto-generations.
*   [x] Built Pydantic schemas (`app/schemas/`), repositories (`app/repositories/`), and services (`app/services/`) for auth, accounts, transactions, budgets, savings goals, and recurring transactions.
*   [x] Implemented JWT authentication routers (register, login, refresh, forgot/reset password with OTP, profile).
*   [x] Implemented the two-stage SMS parsing pipeline (regex first, Gemini fallback) with active database writes (`sms_service.py`, `sms_recovery_service.py`).
*   [x] Wired up APScheduler for automatic recurring-transaction processing (`fix #5`).
*   [x] Implemented Scam Sentinel end-to-end: AI analysis + `/scam` routes + dashboard/SMS-page warnings (`fix #6`).
*   [x] Implemented Budget Coach / COMPASS service and endpoint (`fix #7`).
*   [x] Implemented and wired the Financial Assistant / GUIDE chat backend to the frontend (`fix #8`).
*   [x] Fixed a `/dashboard/insights` crash and the account-creation test (`fix #9`).
*   [x] Added the missing `recharts` frontend dependency that `Analytics.tsx` depends on (`fix #10`).
*   [x] Fixed an invalid CORS config (`allow_origins=["*"]` + `allow_credentials=True`); switched to explicit configurable origins with credentials off, matching the Bearer-token (non-cookie) auth model (`fix #11`).
*   [x] Removed the dead, unused `backend/app/routers/` package (`fix #13`).
*   [x] Fixed a real production bug in `BaseRepository.create()`/`update()`: neither refreshed the object after `flush()`, so any model with an `onupdate=func.now()` column (e.g. `Transaction.updated_at`) crashed with `MissingGreenlet` the moment a response tried to serialize it — reproduced via the new transaction tests below (`fix #14`).
*   [x] Added unit/API test coverage for the transaction ledger (Decimal precision round-trip, validation, CRUD, cross-user access), the SMS Stage-1 regex parser (all 8 message shapes plus the Gemini-fallback `None` cases), and the budget risk classifier — 28 tests total, up from 5 (`fix #15`).
*   [x] Verified `google-genai` SDK compatibility against the current Gemini 3.x model lineup and bumped the pin from `0.5.0` to `2.14.0` (`fix #17`).
*   [x] **Sprint 7 — Njangi/Tontine Groups:** Built the full backend feature — `TontineGroup`/`TontineMember`/`TontineContribution`/`TontinePayout` models, repositories, `TontineService` (membership, per-cycle contribution collection with duplicate rejection, computed cycle-status snapshots, rotation payout that validates full collection and auto-advances the cycle), REST endpoints under `/api/v1/tontine`, an Alembic migration for the 4 new tables, and 6 new tests covering the full rotation end-to-end. No custody of funds — amounts collected per cycle are always summed live from contribution rows, never cached, matching the "AI never owns money" / "nothing important is duplicated" laws.
*   [x] **Sprint 8 — Search at scale:** Replaced client-side-only `GlobalSearch.tsx` (fetch entire accounts/transactions/goals/recurring/notifications, filter with `.includes()` in the browser) with a real `/api/v1/search?q=...` endpoint. Each entity type gets a scoped, SQL-level `search()` method (filtered by `user_id`, `LIMIT`ed in the query) so cost stays proportional to the result limit rather than to total data volume. Frontend now debounces (250ms) before calling the endpoint. Tontine groups are indexed too.
*   [x] Ran a full lint pass (`ruff --select=F,E9`) across the backend and fixed the 8 genuine findings — unused imports, a stray f-string, one shadowed import (`fix #18`). The remaining "undefined name" warnings on `models/*.py` relationship declarations are false positives (SQLAlchemy string forward-refs).
*   [x] **Sprint 9 — Tontine/Njangi frontend:** Built the React UI (`pages/Tontine.tsx`, `services/tontine.ts`) for creating groups, adding members, recording contributions, and viewing cycle status, wired to the Sprint 7 backend. `GlobalSearch.tsx` results for tontine groups now resolve to a real page.
*   [x] Added a startup check (`Settings._reject_insecure_jwt_secret_in_production` in `core/config.py`) that refuses to run with the hardcoded `JWT_SECRET_KEY` placeholder when `DEBUG=False`, closing the publicly-known-secret risk.
*   [x] Added Dockerfiles for the backend and frontend and wired both into `docker-compose.yml`, so `docker compose up` brings up the full stack (previously only Postgres was containerized).
*   [x] Expanded test coverage to 99 tests total.

---

## 8. Pending Tasks

### Sprint 9 — Hardening & follow-through (current)
*   [ ] Continue expanding test coverage — transactions, SMS Stage-1 parsing, budget risk classification, savings goals, recurring transactions, tontine rotation, and search are now tested (99 tests total), but the AI services (M-PARSE Stage 2, SENTINEL, COMPASS, PULSE, GUIDE) remain untested since they require a live Gemini API key to exercise meaningfully.
*   [ ] `google-genai` SDK pin has not been smoke-tested against a live Gemini API call yet (no API key available in the review environment) — recommend testing against a real key before relying on it in production.

---

## 9. Next Immediate Task
*   **Sprint 9:** Continue expanding AI service test coverage (M-PARSE Stage 2, SENTINEL, COMPASS, PULSE, GUIDE remain untested).

---

## 10. Technical Decisions
*   **No Express dependency:** Removed Node Express server to keep FastAPI as the single source of truth for backend services, reducing project complexity.
*   **Single CSS File:** Preserved Tailwind v4 standard config (`@import "tailwindcss";` inside `index.css`) for high performance.
*   **PostgreSQL as Primary Store:** Runs via Docker Compose (`postgres:16-alpine`) with the async `asyncpg` driver for the app and sync `psycopg2-binary` for Alembic migrations. Superseded the earlier SQLite plan once Alembic and concurrent-write requirements made Postgres the better fit.

---

## 11. AI Services Overview

| Code Identifier | Product Name | Main Responsibility | Target Prompt Asset |
| :--- | :--- | :--- | :--- |
| **`sms_parser.py`** | **M-PARSE** | Text classification & transactional parameter extraction. | `sms_parser.md` |
| **`scam_analyzer.py`** | **SENTINEL** | Identifying social engineering, phishing, and fake cashout requests. | `scam_analyzer.md` |
| **`budget_coach.py`** | **COMPASS** | Contextual, localized expenditure advice based on deterministic metrics. | `budget_coach.md` |
| **`insight_generator.py`** | **PULSE** | Detecting recurring behavioral patterns and provider fee drains. | `insight_generator.md` |
| **`financial_assistant.py`** | **GUIDE** | Bilingual conversational learning helper (Njangis, security advice). | `financial_assistant.md` |

---

## 12. Folder Structure Status
The workspace directory is fully structured and frozen:

```
mbamager/
├── backend/
│   ├── alembic/              # Database migration version files
│   ├── app/
│   │   ├── ai/               # AI Cognitive services (M-PARSE, COMPASS, etc.)
│   │   ├── api/routes/       # FastAPI HTTP request handlers, registered in main.py (incl. tontine.py, search.py)
│   │   ├── constants/        # static values (providers, categories, currencies)
│   │   ├── core/             # JWT, Bcrypt security, and global configuration
│   │   ├── database/         # Session managers and ORM Declarative Base
│   │   ├── logs/             # Logs directory
│   │   ├── models/           # SQLAlchemy Database tables
│   │   ├── prompts/          # System prompts for Gemini
│   │   ├── repositories/     # SQLAlchemy Database CRUD wrappers
│   │   ├── schemas/          # Pydantic request-response schemas
│   │   ├── services/         # Deterministic business logic services
│   │   └── main.py           # FastAPI entrypoint
│   ├── alembic.ini           # Alembic Configuration file
│   ├── requirements.txt      # Python dependencies
│   ├── .env.example          # Template environment configurations
│   └── .gitignore            # Git exclusions
├── docs/
│   ├── ARCHITECTURE.md       # Core engineering laws and precision directives
│   ├── PROJECT_STATE.md      # Active state (This file)
│   └── README.md             # Project quickstart
└── frontend/
    └── src/
        ├── App.tsx           # React view
        ├── index.css         # Styling styles
        └── main.tsx          # Client-side mounting
```

---

## 13. Known Limitations (Sprint 9)
*   **AI services untested:** M-PARSE Stage 2, SENTINEL, COMPASS, PULSE, and GUIDE require a live Gemini API key to test meaningfully and remain uncovered. Everything else (transactions, SMS Stage-1, budgets, goals, recurring, tontine rotation, search) has test coverage — 99 tests total.
*   **`google-genai` SDK pin untested against a live key:** no Gemini API key is available in the review environment, so the pin hasn't been smoke-tested against a real call.

---

## 14. Future Versions (Post-MVP)
*   **Offline Voice Assistance:** Support voice transcripts in Cameroon Pidgin English and Camfranglais.
*   **Peer-to-Peer Syncing:** Mesh-network based synchronization for remote village transactions without cellular network coverages.

---

## 15. Changelog
*   **2026-06-30:** Removed Express and consolidated to Vite server mock endpoints for development runtime. Renamed `transaction_categories.py` to `categories.py`. Generated core safety architectures, security crypt engines, Alembic migration systems, and created `docs/PROJECT_STATE.md` to persist the roadmap across development turns.
*   **2026-07-26:** Corrected this document's database references from SQLite to PostgreSQL — the actual running database, per `core/config.py`, `docker-compose.yml`, and `requirements.txt`, has been Postgres (`asyncpg`/`psycopg2-binary`) all along; the SQLite references were stale. Also added the previously-missing `accounts` router, fixed the SMS-import frontend call to hit `/sms/import` instead of a nonexistent `/sms/parse`, and added a `GET /transactions/` list-all endpoint.
*   **2026-07-26 (cont'd):** Shipped the remaining Sprint 4/5 work: APScheduler-driven recurring transactions (`fix #5`), Scam Sentinel (`fix #6`), Budget Coach (`fix #7`), Financial Assistant / GUIDE (`fix #8`), and a `/dashboard/insights` crash fix (`fix #9`). Full code-vs-spec review surfaced further gaps; fixed the missing `recharts` frontend dependency (`fix #10`) and an invalid CORS config (`fix #11`). This document itself was significantly out of date — Sections 6–9 and 13 above have been rewritten to match the code's actual state rather than the Sprint 3 snapshot they were frozen at.
*   **2026-07-26 (cont'd):** Removed the dead `backend/app/routers/` package (`fix #13`) and corrected the Section 12 folder tree, which had never listed the real `backend/app/api/routes/` directory in the first place.
*   **2026-07-26 (cont'd):** Began expanding test coverage per Section 8. Writing tests for transaction creation surfaced a real bug: `BaseRepository.create()`/`update()` never refreshed after `flush()`, so `onupdate=func.now()` columns crashed API responses with `MissingGreenlet` (`fix #14`). Added 23 new tests across transactions, SMS Stage-1 parsing, and budget risk classification (`fix #15`).
*   **2026-07-27:** Closed the last master-review list. Verified `google-genai` pin against current Gemini 3.x (`fix #17`). Built Sprint 7 (Njangi/Tontine groups) end-to-end on the backend: 4 new models, repositories, `TontineService` with rotation logic, REST routes, an Alembic migration, and 6 tests. Built Sprint 8 (search at scale): replaced client-side-only `GlobalSearch.tsx` with a real `/api/v1/search` endpoint backed by scoped, SQL-level queries per entity type, plus 4 tests; frontend now debounces before calling it. Ran a full `ruff` pass and fixed the 8 genuine lint findings (`fix #18`). Test suite: 28 → 64.
*   **2026-07-27 (cont'd):** Master-review follow-through: implemented `/auth/refresh` end-to-end, made profile management (name/phone/email) editable from `/auth/me` and the UI, and wired real backend session-duration logic behind "Remember Me". Added Dockerfiles for the backend and frontend and wired both into `docker-compose.yml` so the full stack runs via `docker compose up`. Corrected this document's stale claims: the Tontine/Njangi frontend (`pages/Tontine.tsx`) is built and shipped, not pending; the `JWT_SECRET_KEY` production-default risk was already closed by a startup check in `core/config.py`; and the test count was updated from a stale 64 to the actual current count of 99.
