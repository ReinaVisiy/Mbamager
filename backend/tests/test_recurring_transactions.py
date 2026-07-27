"""
Tests for RecurringTransactionService.is_due — a deterministic, pure
function that decides whether a scheduled payment fires on a given day —
and for the /recurring-transactions/process endpoint that spawns real
ledger entries from it (Frozen Engineering Rule #2: nothing important is
duplicated, so a template must never post twice for the same period).
"""

from datetime import date

from fastapi import status
from fastapi.testclient import TestClient

from app.models.recurring_transaction import RecurringFrequency, RecurringTransaction
from app.models.transaction import TransactionCategory, TransactionDirection
from app.services.recurring_transaction_service import RecurringTransactionService


def _service() -> RecurringTransactionService:
    """
    is_due() is a pure function of (rec, target_date) — it touches no
    repository — so a service instance built with no real DB access is
    enough to exercise it in isolation.
    """
    return RecurringTransactionService(
        repository=None,
        transaction_repository=None,
        account_repository=None,
    )


def _make_recurring(**overrides) -> RecurringTransaction:
    defaults = dict(
        id=1,
        user_id=1,
        account_id=1,
        amount=10000,
        category=TransactionCategory.EXPENSE_UTILITIES,
        direction=TransactionDirection.DEBIT,
        frequency=RecurringFrequency.MONTHLY,
        start_date=date(2026, 1, 15),
        end_date=None,
        last_processed=None,
        active=True,
        narrative="Rent",
    )
    defaults.update(overrides)
    return RecurringTransaction(**defaults)


def test_inactive_template_is_never_due():
    rec = _make_recurring(active=False)
    assert _service().is_due(rec, date(2026, 2, 15)) is False


def test_not_due_before_start_date():
    rec = _make_recurring(start_date=date(2026, 3, 1))
    assert _service().is_due(rec, date(2026, 2, 15)) is False


def test_not_due_after_end_date():
    rec = _make_recurring(end_date=date(2026, 2, 1))
    assert _service().is_due(rec, date(2026, 2, 15)) is False


def test_first_run_is_due_on_or_after_start_date():
    rec = _make_recurring(start_date=date(2026, 1, 15), last_processed=None)
    assert _service().is_due(rec, date(2026, 1, 15)) is True
    assert _service().is_due(rec, date(2026, 1, 10)) is False


def test_daily_frequency_due_the_next_day_only():
    rec = _make_recurring(frequency=RecurringFrequency.DAILY, last_processed=date(2026, 1, 15))
    assert _service().is_due(rec, date(2026, 1, 15)) is False
    assert _service().is_due(rec, date(2026, 1, 16)) is True


def test_weekly_frequency_requires_seven_days():
    rec = _make_recurring(frequency=RecurringFrequency.WEEKLY, last_processed=date(2026, 1, 15))
    assert _service().is_due(rec, date(2026, 1, 21)) is False
    assert _service().is_due(rec, date(2026, 1, 22)) is True


def test_monthly_frequency_waits_for_next_calendar_month():
    rec = _make_recurring(
        frequency=RecurringFrequency.MONTHLY,
        start_date=date(2026, 1, 15),
        last_processed=date(2026, 1, 15),
    )
    # Same month, has not advanced yet.
    assert _service().is_due(rec, date(2026, 1, 20)) is False
    # Next month, but before the preferred day (15th) — not due yet.
    assert _service().is_due(rec, date(2026, 2, 10)) is False
    # Next month, on/after the preferred day — due.
    assert _service().is_due(rec, date(2026, 2, 15)) is True


def test_monthly_frequency_already_fired_this_month_is_not_due_again():
    """
    Guards against double-posting: once last_processed is inside the target
    month, the template must not fire a second time in that same month.
    """
    rec = _make_recurring(
        frequency=RecurringFrequency.MONTHLY,
        start_date=date(2026, 1, 15),
        last_processed=date(2026, 2, 15),
    )
    assert _service().is_due(rec, date(2026, 2, 28)) is False


def test_yearly_frequency_requires_full_year_and_matching_day():
    rec = _make_recurring(
        frequency=RecurringFrequency.YEARLY,
        start_date=date(2026, 3, 10),
        last_processed=date(2026, 3, 10),
    )
    assert _service().is_due(rec, date(2027, 3, 9)) is False
    assert _service().is_due(rec, date(2027, 3, 10)) is True


def _register_and_login(client: TestClient, phone: str) -> dict:
    client.post(
        "/api/v1/auth/register",
        json={
            "username": f"recuser{phone[-4:]}",
            "phone_number": phone,
            "password": "SecurePassword123!",
        },
    )
    response = client.post(
        "/api/v1/auth/login",
        json={"identifier": phone, "password": "SecurePassword123!"},
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _create_account(client: TestClient, headers: dict) -> int:
    response = client.post(
        "/api/v1/accounts/",
        json={
            "name": "MTN Wallet",
            "account_type": "MOBILE_MONEY",
            "provider": "MTN_MOMO",
            "currency": "XAF",
        },
        headers=headers,
    )
    assert response.status_code == status.HTTP_201_CREATED
    return response.json()["id"]


def test_process_endpoint_posts_a_due_transaction_and_does_not_duplicate(client: TestClient):
    headers = _register_and_login(client, "+237688888888")
    account_id = _create_account(client, headers)

    create_resp = client.post(
        "/api/v1/recurring-transactions",
        json={
            "account_id": account_id,
            "amount": "15000.00",
            "category": "Electricity / Water / Internet",
            "direction": "DEBIT",
            "frequency": "MONTHLY",
            "start_date": date.today().isoformat(),
            "narrative": "Netflix",
        },
        headers=headers,
    )
    assert create_resp.status_code == status.HTTP_201_CREATED

    # First run: template is due today (first run), should post exactly one transaction.
    first_run = client.post("/api/v1/recurring-transactions/process", headers=headers)
    assert first_run.status_code == status.HTTP_200_OK
    assert "1" in first_run.json()["message"]

    # Second run same day: must not double-post.
    second_run = client.post("/api/v1/recurring-transactions/process", headers=headers)
    assert second_run.status_code == status.HTTP_200_OK
    assert "0" in second_run.json()["message"]

    tx_list = client.get("/api/v1/transactions/", headers=headers)
    assert tx_list.status_code == status.HTTP_200_OK
    assert len(tx_list.json()) == 1
    assert tx_list.json()[0]["amount"] == "15000.00"
