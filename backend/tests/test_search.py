"""
Tests for the server-side global search endpoint (replaces the old
client-side-only search: fetch everything, filter in the browser).
"""

from fastapi import status
from fastapi.testclient import TestClient


def _register_and_login(client: TestClient, phone: str) -> dict:
    client.post(
        "/api/v1/auth/register",
        json={
            "username": f"searchuser{phone[-4:]}",
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


def test_search_finds_account_by_name(client: TestClient):
    headers = _register_and_login(client, "+237630000001")
    client.post(
        "/api/v1/accounts/",
        json={
            "name": "Orange SIM Wallet",
            "account_type": "MOBILE_MONEY",
            "provider": "ORANGE_MONEY",
            "currency": "XAF",
        },
        headers=headers,
    )

    response = client.get("/api/v1/search", params={"q": "Orange"}, headers=headers)
    assert response.status_code == status.HTTP_200_OK
    body = response.json()
    titles = [r["title"] for r in body["results"]]
    assert "Orange SIM Wallet" in titles
    assert all(r["type"] in {"account", "transaction", "goal", "recurring", "notification", "tontine"} for r in body["results"])


def test_search_finds_tontine_group(client: TestClient):
    headers = _register_and_login(client, "+237630000002")
    client.post(
        "/api/v1/tontine",
        json={
            "name": "Njangi des Amies",
            "contribution_amount": "5000.00",
            "frequency": "MONTHLY",
        },
        headers=headers,
    )

    response = client.get("/api/v1/search", params={"q": "Njangi"}, headers=headers)
    assert response.status_code == status.HTTP_200_OK
    results = response.json()["results"]
    assert any(r["type"] == "tontine" and r["title"] == "Njangi des Amies" for r in results)


def test_search_is_scoped_to_requesting_user(client: TestClient):
    owner_headers = _register_and_login(client, "+237630000003")
    client.post(
        "/api/v1/accounts/",
        json={
            "name": "Very Unique Account Name",
            "account_type": "CASH",
            "provider": "CASH",
            "currency": "XAF",
        },
        headers=owner_headers,
    )

    other_headers = _register_and_login(client, "+237630000004")
    response = client.get("/api/v1/search", params={"q": "Very Unique"}, headers=other_headers)
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["results"] == []


def test_search_requires_query_param(client: TestClient):
    headers = _register_and_login(client, "+237630000005")
    response = client.get("/api/v1/search", headers=headers)
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
