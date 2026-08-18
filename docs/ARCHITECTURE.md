# Mbamager Architecture Specifications & Guidelines

This document serves as the single source of truth for the system design, layered boundaries, and implementation rules of the **Mbamager** backend services. All future contributions must strictly adhere to this architectural specification.

---

## 🏛️ Clean Architecture Principles

Mbamager is designed around a strictly decoupled, modular Clean Architecture to ensure speed, auditability, testability, and extreme maintainability.

```
       ┌────────────────────────────────────────────────────────┐
       │                     Presentation                       │
       │           (Vite + React / FastAPI Routers)             │
       └───────────────────────────┬────────────────────────────┘
                                   │
                                   ▼
       ┌────────────────────────────────────────────────────────┐
       │                Application Business Logic              │
       │                   (Services Layer)                     │
       └───────────────────────────┬────────────────────────────┘
                                   │
                                   ▼
       ┌────────────────────────────────────────────────────────┐
       │                    Enterprise Core                     │
       │        (Repositories / Models / Database Session)      │
       └────────────────────────────────────────────────────────┘
```

### Layer Boundaries and Responsibilities

1. **Routers (`app/api/routes/`)**
   - **Role:** Entrypoints for HTTP/REST communication.
   - **Rules:** They *only* receive input payloads (requests), trigger service-layer functions, and return JSON serializations (responses). They must **never** write business calculations, direct database queries, or trigger core AI API calls directly.

2. **Services (`app/services/`)**
   - **Role:** The core repository of deterministic business logic and operational policies.
   - **Rules:** Services translate real-world financial concepts (allocations, thresholds) into algorithms. They depend on repositories to save or retrieve state.

3. **Repositories (`app/repositories/`)**
   - **Role:** Gateways mediating between business services and raw persistence operations.
   - **Rules:** Every SQL query, table filter, and model update must occur inside a repository. Services must never access SQLAlchemy sessions directly.

4. **Models (`app/models/`)**
   - **Role:** Mapping entities to the database structure.
   - **Rules:** SQLAlchemy classes inheriting from `Base`. They contain zero logic except table configurations, column definitions, constraints, and relationships.

5. **Schemas (`app/schemas/`)**
   - **Role:** Data contracts, deserialization, and serialization validators.
   - **Rules:** Implemented via Pydantic. They ensure inputs contain valid types and structures before reaching routers and services.

6. **AI Modules (`app/ai/`)**
   - **Role:** Cognitive interpretation and micro-guidance.
   - **Rules:** Used for text semantic parsing (M-PARSE), fraud analysis (SENTINEL), conversational guidelines (GUIDE), spend feedback (COMPASS), and behavioral insights (PULSE). They never handle core business rules.

---

## 🧮 Financial Precision: No Floats for Money

**Project Rule #1:** Float representations are strictly forbidden for tracking and calculating monetary balances, fees, limits, or interest. Floating-point binary representations introduce precision loss (e.g., `0.1 + 0.2 != 0.3`) which is unacceptable in audit-grade financial platforms.

### Guidelines for Money Representation:
- **Python Code:** Use Python's built-in `decimal.Decimal` type for all money operations.
- **SQLAlchemy Models:** Use `sqlalchemy.types.Numeric` with strict precision configuration (e.g., `Numeric(precision=18, scale=2, asdecimal=True)`).
- **Pydantic Schemas:** Use `pydantic.types.Decimal` to ensure values are sanitized on ingestion.

#### Correct Database Modeling Example:
```python
from decimal import Decimal
from sqlalchemy import Numeric
from sqlalchemy.orm import Mapped, mapped_column
from app.database.base import Base

class Transaction(Base):
    __tablename__ = "transactions"
    
    amount: Mapped[Decimal] = mapped_column(
        Numeric(precision=18, scale=2, asdecimal=True),
        nullable=False
    )
    fee: Mapped[Decimal] = mapped_column(
        Numeric(precision=18, scale=2, asdecimal=True),
        default=Decimal("0.00")
    )
```

#### Correct Business Service Calculation Example:
```python
from decimal import Decimal

def compute_total_cost(amount: Decimal, fee: Decimal) -> Decimal:
    """
    Computes exact total cost including provider transaction commissions.
    """
    return amount + fee
```

---

## ⚖️ Engineering Law: AI Never Owns Money

In the Mbamager ecosystem, cognitive artificial intelligence and deterministic systems operate on strictly separated permissions to protect underbanked users from hallucinations, unexpected loss of funds, and state corruptions.

### 🚫 AI must NEVER:
1. **Calculate Balances:** Never let an LLM compute totals, add up transaction values, or derive net asset holdings.
2. **Update Wallets:** Never trigger ledger adjustments, transaction modifications, or database writes directly inside an AI agent.
3. **Compute Budgets:** Never calculate leftover spending limits or compile numerical ratios.
4. **Compute Net Worth:** Never summarize debt or asset values mathematically.
5. **Modify Records:** AI must remain read-only with respect to historical transactional states.

### ✅ AI MAY:
1. **Parse SMS (M-PARSE):** Extract semantic numbers, recipient identifiers, and timestamps from SMS, but pass them immediately to deterministic pipelines for validation and mathematical checks.
2. **Classify Transactions:** Suggest category markers (e.g. food vs utilities) based on SMS descriptors.
3. **Detect Scams (SENTINEL):** Analyze SMS phrases for phishing, fraud, or social engineering alerts.
4. **Generate Insights (PULSE):** Provide behavioral micro-coaching based on pre-calculated data (e.g., advising a user about afternoon commissions).
5. **Coach Users (COMPASS):** Encourage users with friendly, local metaphors when they approach thresholds compiled deterministically.
6. **Answer Financial Questions (GUIDE):** Explain localized financial terms (e.g., Njangis) or give educational tips in English, French, and local linguistic phrasings.

**All financial calculations must be completed by deterministic Python services (e.g., `account_service.py`, `transaction_service.py`, `budget_service.py`). The AI's role is to translate these exact outcomes into friendly, clear, human, and localized guidance.**
