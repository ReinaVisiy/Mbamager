"""
Tests for SavingsGoal progress math and auto-completion (Frozen Engineering
Rule #2: nothing important is duplicated — progress, remaining amount, and
the recommended monthly contribution are always computed from the goal's
current/target amounts and dates, never stored directly).
"""

from datetime import date
from decimal import Decimal

from fastapi import status
from fastapi.testclient import TestClient


def _add_months(base: date, months: int) -> date:
    """Add whole months to a date without relying on an external dependency."""
    total_months = base.month - 1 + months
    year = base.year + total_months // 12
    month = total_months % 12 + 1
    return date(year, month, base.day)


def _register_and_login(client: TestClient, phone: str) -> dict:
    client.post(
        "/api/v1/auth/register",
        json={
            "username": f"goaluser{phone[-4:]}",
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


def test_goal_progress_math_is_exact(client: TestClient):
    """
    remaining_amount and percentage_completed must be computed exactly from
    target/current amounts, not stored or approximated with floats.
    """
    headers = _register_and_login(client, "+237611111111")
    target_date = _add_months(date.today(), 4)

    create_resp = client.post(
        "/api/v1/goals",
        json={
            "name": "Laptop",
            "target_amount": "500000.00",
            "current_amount": "125000.00",
            "target_date": target_date.isoformat(),
        },
        headers=headers,
    )
    assert create_resp.status_code == status.HTTP_201_CREATED
    goal_id = create_resp.json()["id"]

    progress_resp = client.get(f"/api/v1/goals/{goal_id}/progress", headers=headers)
    assert progress_resp.status_code == status.HTTP_200_OK
    data = progress_resp.json()

    assert Decimal(data["remaining_amount"]) == Decimal("375000.00")
    # 125000 / 500000 * 100 = 25.00 exactly
    assert Decimal(data["percentage_completed"]) == Decimal("25.00")
    # 375000 remaining over 4 months = 93750.00 exactly
    assert Decimal(data["monthly_contribution_recommended"]) == Decimal("93750.00")


def test_goal_auto_completes_on_creation_when_already_met(client: TestClient):
    headers = _register_and_login(client, "+237622222222")

    create_resp = client.post(
        "/api/v1/goals",
        json={
            "name": "Emergency Fund",
            "target_amount": "100000.00",
            "current_amount": "100000.00",
            "target_date": (_add_months(date.today(), 1)).isoformat(),
        },
        headers=headers,
    )
    assert create_resp.status_code == status.HTTP_201_CREATED
    assert create_resp.json()["status"] == "COMPLETED"

    goal_id = create_resp.json()["id"]
    progress_resp = client.get(f"/api/v1/goals/{goal_id}/progress", headers=headers)
    data = progress_resp.json()
    assert data["remaining_amount"] == "0.00"
    assert data["monthly_contribution_recommended"] == "0.00"


def test_goal_transitions_to_completed_on_update(client: TestClient):
    headers = _register_and_login(client, "+237633333333")

    create_resp = client.post(
        "/api/v1/goals",
        json={
            "name": "Vacation",
            "target_amount": "200000.00",
            "current_amount": "50000.00",
            "target_date": (_add_months(date.today(), 2)).isoformat(),
        },
        headers=headers,
    )
    goal_id = create_resp.json()["id"]
    assert create_resp.json()["status"] == "ACTIVE"

    update_resp = client.put(
        f"/api/v1/goals/{goal_id}",
        json={"current_amount": "200000.00"},
        headers=headers,
    )
    assert update_resp.status_code == status.HTTP_200_OK
    assert update_resp.json()["status"] == "COMPLETED"


def test_goal_remaining_amount_never_negative_when_overfunded(client: TestClient):
    """
    remaining_amount uses max(0, target - current) — overfunding a goal must
    never surface as a negative remaining amount.
    """
    headers = _register_and_login(client, "+237644444444")

    create_resp = client.post(
        "/api/v1/goals",
        json={
            "name": "Overfunded Goal",
            "target_amount": "50000.00",
            "current_amount": "70000.00",
            "target_date": (_add_months(date.today(), 1)).isoformat(),
        },
        headers=headers,
    )
    goal_id = create_resp.json()["id"]

    progress_resp = client.get(f"/api/v1/goals/{goal_id}/progress", headers=headers)
    data = progress_resp.json()
    assert data["remaining_amount"] == "0.00"
    assert data["monthly_contribution_recommended"] == "0.00"


def test_user_cannot_access_another_users_goal(client: TestClient):
    owner_headers = _register_and_login(client, "+237655555555")
    create_resp = client.post(
        "/api/v1/goals",
        json={
            "name": "Private Goal",
            "target_amount": "10000.00",
            "current_amount": "0.00",
            "target_date": (_add_months(date.today(), 1)).isoformat(),
        },
        headers=owner_headers,
    )
    goal_id = create_resp.json()["id"]

    intruder_headers = _register_and_login(client, "+237666666666")
    response = client.get(f"/api/v1/goals/{goal_id}", headers=intruder_headers)
    assert response.status_code == status.HTTP_404_NOT_FOUND
