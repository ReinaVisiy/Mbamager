"""
Tests for the transaction ledger (Frozen Engineering Rules #1 and #2):
amounts must round-trip as exact Decimal values with no float drift, the
ledger never stores a balance directly, and validation must reject
non-positive amounts before they ever reach the database.
"""

from fastapi import status
from fastapi.testclient import TestClient


def _register_and_login(client: TestClient, phone: str) -> dict:
    client.post(
        "/api/v1/auth/register",
        json={
            "username": f"txuser{phone[-4:]}",
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


def test_transaction_amount_round_trips_exactly_as_decimal(client: TestClient):
    """
    18,2-precision Decimal amounts (including cents) must come back exactly
    as sent — no float rounding drift.
    """
    headers = _register_and_login(client, "+237611111111")
    account_id = _create_account(client, headers)

    response = client.post(
        "/api/v1/transactions/",
        json={
            "account_id": account_id,
            "amount": "1234.56",
            "fee": "12.34",
            "direction": "DEBIT",
            "category": "Food & Groceries",
            "narrative": "Market groceries",
        },
        headers=headers,
    )
    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data["amount"] == "1234.56"
    assert data["fee"] == "12.34"


def test_zero_amount_is_rejected(client: TestClient):
    headers = _register_and_login(client, "+237622222222")
    account_id = _create_account(client, headers)

    response = client.post(
        "/api/v1/transactions/",
        json={
            "account_id": account_id,
            "amount": "0",
            "direction": "DEBIT",
            "category": "Food & Groceries",
        },
        headers=headers,
    )
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_negative_amount_is_rejected(client: TestClient):
    headers = _register_and_login(client, "+237633333333")
    account_id = _create_account(client, headers)

    response = client.post(
        "/api/v1/transactions/",
        json={
            "account_id": account_id,
            "amount": "-500",
            "direction": "CREDIT",
            "category": "Salary / Wages",
        },
        headers=headers,
    )
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_negative_fee_is_rejected(client: TestClient):
    headers = _register_and_login(client, "+237644444444")
    account_id = _create_account(client, headers)

    response = client.post(
        "/api/v1/transactions/",
        json={
            "account_id": account_id,
            "amount": "1000",
            "fee": "-1",
            "direction": "DEBIT",
            "category": "Food & Groceries",
        },
        headers=headers,
    )
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


def test_transaction_crud_lifecycle(client: TestClient):
    headers = _register_and_login(client, "+237655555555")
    account_id = _create_account(client, headers)

    # Create
    create_resp = client.post(
        "/api/v1/transactions/",
        json={
            "account_id": account_id,
            "amount": "5000",
            "direction": "CREDIT",
            "category": "Salary / Wages",
        },
        headers=headers,
    )
    assert create_resp.status_code == status.HTTP_201_CREATED
    tx_id = create_resp.json()["id"]

    # Read
    get_resp = client.get(f"/api/v1/transactions/{tx_id}", headers=headers)
    assert get_resp.status_code == status.HTTP_200_OK
    assert get_resp.json()["amount"] == "5000.00" or get_resp.json()["amount"] == "5000"

    # Update
    update_resp = client.put(
        f"/api/v1/transactions/{tx_id}",
        json={"narrative": "Updated narrative"},
        headers=headers,
    )
    assert update_resp.status_code == status.HTTP_200_OK
    assert update_resp.json()["narrative"] == "Updated narrative"

    # List (account owner can see it)
    list_resp = client.get("/api/v1/transactions/", headers=headers)
    assert list_resp.status_code == status.HTTP_200_OK
    assert any(tx["id"] == tx_id for tx in list_resp.json())

    # Delete
    delete_resp = client.delete(f"/api/v1/transactions/{tx_id}", headers=headers)
    assert delete_resp.status_code == status.HTTP_204_NO_CONTENT

    # Confirm gone
    confirm_resp = client.get(f"/api/v1/transactions/{tx_id}", headers=headers)
    assert confirm_resp.status_code == status.HTTP_404_NOT_FOUND


def test_user_cannot_access_another_users_transaction(client: TestClient):
    owner_headers = _register_and_login(client, "+237666666666")
    account_id = _create_account(client, owner_headers)

    create_resp = client.post(
        "/api/v1/transactions/",
        json={
            "account_id": account_id,
            "amount": "2000",
            "direction": "DEBIT",
            "category": "Taxi / Moto / Transport",
        },
        headers=owner_headers,
    )
    tx_id = create_resp.json()["id"]

    intruder_headers = _register_and_login(client, "+237677777777")
    response = client.get(f"/api/v1/transactions/{tx_id}", headers=intruder_headers)
    assert response.status_code == status.HTTP_404_NOT_FOUND
