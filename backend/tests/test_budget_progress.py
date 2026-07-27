"""
Tests for BudgetService.calculate_budget_progress — the deterministic
calculation that Engineering Law 2 requires (spent/remaining/percentage are
always computed from the transaction ledger, never stored directly) and
that Engineering Law 1 depends on (the AI coaching layer only narrates a
number this method already decided).
"""

from datetime import date, timedelta
from decimal import Decimal

from fastapi import status
from fastapi.testclient import TestClient

from app.repositories.budget_repository import BudgetRepository
from app.repositories.transaction_repository import TransactionRepository
from app.services.budget_service import BudgetService


def _register_and_login(client: TestClient, phone: str) -> tuple[dict, int]:
    register_resp = client.post(
        "/api/v1/auth/register",
        json={
            "username": f"budgetuser{phone[-4:]}",
            "phone_number": phone,
            "password": "SecurePassword123!",
        },
    )
    user_id = register_resp.json()["id"]
    response = client.post(
        "/api/v1/auth/login",
        json={"identifier": phone, "password": "SecurePassword123!"},
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}, user_id


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


async def test_budget_progress_sums_amount_plus_fee_for_matching_transactions(
    client: TestClient, db_session
):
    headers, user_id = _register_and_login(client, "+237611110000")
    account_id = _create_account(client, headers)

    today = date.today()
    start_date = today - timedelta(days=5)
    end_date = today + timedelta(days=5)

    budget_resp = client.post(
        "/api/v1/budgets/",
        json={
            "category": "Food & Groceries",
            "limit_amount": "200000.00",
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
        },
        headers=headers,
    )
    assert budget_resp.status_code == status.HTTP_201_CREATED
    budget_id = budget_resp.json()["id"]

    # Two matching DEBIT/EXPENSE_FOOD transactions with fees — both should count.
    for amount, fee in [("30000.00", "300.00"), ("20000.00", "0.00")]:
        resp = client.post(
            "/api/v1/transactions/",
            json={
                "account_id": account_id,
                "amount": amount,
                "fee": fee,
                "direction": "DEBIT",
                "category": "Food & Groceries",
            },
            headers=headers,
        )
        assert resp.status_code == status.HTTP_201_CREATED

    # A CREDIT in the same category must NOT count toward spending.
    client.post(
        "/api/v1/transactions/",
        json={
            "account_id": account_id,
            "amount": "50000.00",
            "direction": "CREDIT",
            "category": "Food & Groceries",
        },
        headers=headers,
    )

    # A DEBIT in a different category must NOT count toward this budget.
    client.post(
        "/api/v1/transactions/",
        json={
            "account_id": account_id,
            "amount": "15000.00",
            "direction": "DEBIT",
            "category": "Taxi / Moto / Transport",
        },
        headers=headers,
    )

    budget_service = BudgetService(
        repository=BudgetRepository(db_session),
        transaction_repository=TransactionRepository(db_session),
    )
    progress = await budget_service.calculate_budget_progress(budget_id)

    # 30000 + 300 fee + 20000 + 0 fee = 50300.00 exactly.
    assert progress.spent_amount == Decimal("50300.00")
    assert progress.remaining_amount == Decimal("149700.00")
    # 50300 / 200000 * 100 = 25.15 exactly.
    assert progress.percentage_used == Decimal("25.15")


async def test_budget_progress_with_no_matching_transactions_is_zero(
    client: TestClient, db_session
):
    headers, user_id = _register_and_login(client, "+237611110001")

    today = date.today()
    budget_resp = client.post(
        "/api/v1/budgets/",
        json={
            "category": "Medical & Health",
            "limit_amount": "100000.00",
            "start_date": (today - timedelta(days=1)).isoformat(),
            "end_date": (today + timedelta(days=1)).isoformat(),
        },
        headers=headers,
    )
    budget_id = budget_resp.json()["id"]

    budget_service = BudgetService(
        repository=BudgetRepository(db_session),
        transaction_repository=TransactionRepository(db_session),
    )
    progress = await budget_service.calculate_budget_progress(budget_id)

    assert progress.spent_amount == Decimal("0.00")
    assert progress.remaining_amount == Decimal("100000.00")
    assert progress.percentage_used == Decimal("0.00")


def test_risk_level_matches_progress_thresholds_end_to_end(client: TestClient):
    """
    BudgetCoachResponse surfaces classify_risk_level(percentage_used) driven
    by the same progress calculation, through the real /coach endpoint.
    Skips assertions on the AI-authored message — only checks the
    deterministic numbers the AI is not allowed to alter.
    """
    headers, user_id = _register_and_login(client, "+237611110002")
    account_id = _create_account(client, headers)

    today = date.today()
    budget_resp = client.post(
        "/api/v1/budgets/",
        json={
            "category": "Food & Groceries",
            "limit_amount": "10000.00",
            "start_date": (today - timedelta(days=1)).isoformat(),
            "end_date": (today + timedelta(days=1)).isoformat(),
        },
        headers=headers,
    )
    budget_id = budget_resp.json()["id"]

    # Spend exactly 90% of the limit -> WARNING tier.
    client.post(
        "/api/v1/transactions/",
        json={
            "account_id": account_id,
            "amount": "9000.00",
            "direction": "DEBIT",
            "category": "Food & Groceries",
        },
        headers=headers,
    )

    coach_resp = client.get(f"/api/v1/budgets/{budget_id}/coach", headers=headers)
    assert coach_resp.status_code == status.HTTP_200_OK
    data = coach_resp.json()
    assert Decimal(data["spent_amount"]) == Decimal("9000.00")
    assert Decimal(data["remaining_amount"]) == Decimal("1000.00")
    assert Decimal(data["percentage_used"]) == Decimal("90.00")
    assert data["risk_level"] == "WARNING"


def test_budget_update_and_delete_full_crud(client: TestClient):
    """
    Covers the CRUD paths the Budgets frontend page relies on: listing all
    budgets, updating one, and deleting one — none of these were exercised
    by the coaching-focused tests above.
    """
    headers, _ = _register_and_login(client, "+237611110003")

    today = date.today()
    create_resp = client.post(
        "/api/v1/budgets/",
        json={
            "category": "Food & Groceries",
            "limit_amount": "50000.00",
            "start_date": str(today),
            "end_date": str(today + timedelta(days=10)),
        },
        headers=headers,
    )
    assert create_resp.status_code == status.HTTP_201_CREATED
    budget_id = create_resp.json()["id"]

    # List includes the new budget
    list_resp = client.get("/api/v1/budgets/", headers=headers)
    assert list_resp.status_code == status.HTTP_200_OK
    assert any(b["id"] == budget_id for b in list_resp.json())

    # Update the limit only
    update_resp = client.put(
        f"/api/v1/budgets/{budget_id}",
        json={"limit_amount": "75000.00"},
        headers=headers,
    )
    assert update_resp.status_code == status.HTTP_200_OK
    assert Decimal(update_resp.json()["limit_amount"]) == Decimal("75000.00")
    # Unmodified fields are preserved
    assert update_resp.json()["category"] == "Food & Groceries"

    # Delete it
    delete_resp = client.delete(f"/api/v1/budgets/{budget_id}", headers=headers)
    assert delete_resp.status_code == status.HTTP_204_NO_CONTENT

    list_after = client.get("/api/v1/budgets/", headers=headers)
    assert not any(b["id"] == budget_id for b in list_after.json())
