# Mbamager Cleanup Report

Branch: `refactor/ai-slop-cleanup` (based on `main`, not merged)
Test baseline: 106/106 backend tests passing before this work, 106/106 passing after every commit below.

This is a summary of a controlled cleanup pass. It is not a rewrite and no product features, database schema, migration history, or deterministic financial logic were changed.

## Commits on this branch

1. `a143303` Fix service/repository boundary violations in Budget and SMS services
2. `51c3f43` Stop guessing specific categories in AI categorization fallback
3. `560ebc7` Differentiate Gemini failure modes in the provider call path
4. `a216a40` Add root README, sync docs with actual repo state
5. `b5252f6` Strip narration docstrings from BaseRepository and BaseService
6. `74ae86f` State reasons directly instead of repeating Engineering Law citations

## What was changed

**Service/repository boundaries.** `BudgetService.calculate_budget_progress` and `SmsService.check_duplicate` were running raw queries against a foreign repository's session instead of going through their own repository. Moved the queries into `TransactionRepository` as named methods (`get_debits_for_budget_period`, `exists_duplicate`), exposed the latter through `TransactionService`, and updated the callers. No behavior change, just moving the query to the layer that owns it.

**Categorization fallback.** When Gemini is unavailable, the fallback used to default an unlabeled debit to `EXPENSE_FOOD` and an unlabeled credit to `INCOME_SALARY`. That is a specific, potentially wrong claim about someone's money. No `UNCATEGORIZED`/`OTHER` value exists in the `TransactionCategory` enum, and adding one means a migration, which is out of scope for this cleanup. The fallback path now returns the string `"UNCATEGORIZED"` for genuinely unknown transactions, which safely fails the `TransactionCategory(...)` cast (caught by the existing `except ValueError: pass`) so it can never be persisted to a stored transaction. Keyword-based matches (taxi, school, hospital, commission, and so on) still work as before. Two tests that asserted the old, misleading default behavior were updated to match.

**Gemini error handling.** `_call_gemini_json` used to catch one broad `except Exception` and return `None` for everything: a missing API key, a network failure, and a malformed response all looked identical in the logs. Now a missing key, a provider/network failure, an empty response, and malformed JSON are each logged with their own message. Callers still just see `None` and fall back to deterministic logic exactly as before, only the logging changed.

**Engineering Law citations.** Four docstrings in `ai_service.py` cited "Engineering Law 1" by name instead of stating the actual constraint. The formal rule stays documented in `docs/ARCHITECTURE.md` where it belongs. The docstrings now state the concrete reason directly (no invented figures, no ledger writes, advisory only) so a maintainer does not need to cross-reference the architecture doc to understand why a method is written the way it is.

**Docstring and comment narration.** Removed docstrings on `BaseRepository` and `BaseService` that only restated the method signature (Initialize, Retrieve, Create by delegating). Kept the one comment that explains genuinely non-obvious behavior: why `create()`/`update()` refresh after flush, because columns with `onupdate` are left expired otherwise and crash on later access with `MissingGreenlet`.

**Root README and doc sync.** Added a root `README.md` covering stack, project layout, and setup for Docker Compose, backend-only, and frontend-only workflows. `docs/PROJECT_STATE.md` was claiming the AI services were untested and that the suite had 99 tests. Both were stale: `test_ai_service_fallback.py` and `test_ai_service_gemini_success.py` already cover the AI services with a mocked Gemini client, and the suite is at 106. Updated the sprint status, pending tasks, and changelog to match. `docs/ARCHITECTURE.md` still referenced a `backend/app/routers/` package that does not exist; the actual path is `backend/app/api/routes/`, fixed.

## Areas audited with no changes made

**`ai_service.py` responsibility split (categorization, anomaly detection, narrative cleanup, insights, scam analysis, budget coaching, assistant chat, SMS extraction).** All eight methods share one client property and one `_call_gemini_json` helper, and the whole service is injected as a single dependency across four routers (`scam.py`, `dashboard.py`, `transaction.py`, `budget.py`). Splitting it into separate services would mean new dependency wiring in `api/dependencies/auth.py` and every calling route for an organizational benefit only, no bug and no behavior change. Left intact. If this ever needs to happen, the natural first split would be the SMS extraction and scam analysis paths, since they are the most self-contained.

**Prompt ownership (`app/ai/prompts.py` vs `app/prompts/*.md`).** These are not duplicates. `app/ai/prompts.py` holds the actual executable prompt strings used by `ai_service.py`. `app/prompts/*.md` holds a one-paragraph design description per persona (COMPASS, GUIDE, PULSE, SENTINEL, M-PARSE) and is never imported by application code. The split is already documented in `app/ai/__init__.py`. Left as is.

**Frontend service overlap.** Checked every endpoint call across all 11 files in `frontend/src/services/`. No duplicate endpoints between `finance.ts`, `dashboard.ts`, and the narrower domain services (accounts, transactions, tontine, and so on); `finance.ts` owns budgets, goals, and recurring transactions, `dashboard.ts` owns the read-only aggregate views. No overlap found.

**Frontend API configuration.** There is exactly one Axios instance, `frontend/src/lib/api.ts`, with the auth header injection and refresh-token logic already centralized there. No duplicate clients found anywhere in `src/`.

**Frontend type duplication.** Every core domain interface (`Account`, `Transaction`, `Budget`, `SavingsGoal`, `Notification`, `TontineGroup`) is defined exactly once, in `frontend/src/types/index.ts`. Services import from there. No duplication found.

**Dead code.** Ran `ruff check` with `F401` (unused import) and `F841` (unused variable) against the backend: clean. Ran `tsc --noUnusedLocals --noUnusedParameters --noEmit` against the frontend: clean. No TODO/FIXME markers pointing at abandoned work, no empty or near-empty scaffold files.

**Dependency audit.** Checked every package in `backend/requirements.txt` and every dependency in `frontend/package.json` against actual imports in the codebase. All are genuinely used. Nothing removed.

## Left for you to decide

`docs/PROJECT_STATE.md` still has some marketing-style language in its product pitch section (for example, describing the architecture as "frozen" and using a tagline). None of it is factually wrong or contradicts the code, so it was not touched here. Whether to keep that tone is a product/voice decision, not an engineering cleanup decision, so it is being left to you rather than trimmed unilaterally.

## What was not touched

No changes to database schema, Alembic migrations, authentication, transaction semantics, Tontine/Njangi behavior, deterministic financial calculations, or any product feature. No new dependencies added, no package upgrades performed, no tests weakened or deleted. Nothing was pushed to or merged into `main`.
