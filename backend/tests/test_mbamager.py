import pytest
from fastapi import status
from fastapi.testclient import TestClient

def test_root_endpoint(client: TestClient):
    """
    Test that the root endpoint returns the correct welcome message and version.
    """
    response = client.get("/")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "message" in data
    assert "tagline" in data
    assert data["status"] == "online"

def test_health_checks(client: TestClient):
    """
    Test the health, ready, and version endpoints.
    """
    response = client.get("/health")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["status"] == "healthy"
    assert data["database"] == "connected"
    assert "ai_availability" in data
    assert "scheduler" in data

    response = client.get("/ready")
    assert response.status_code == status.HTTP_200_OK
    assert response.json() == {"ready": True}

    response = client.get("/version")
    assert response.status_code == status.HTTP_200_OK
    assert "version" in response.json()

def test_auth_and_registration_flow(client: TestClient):
    """
    Test register, login, and profile retrieval endpoints.
    """
    # 1. Register a new user
    register_payload = {
        "username": "testuser",
        "phone_number": "+237699999999",
        "password": "SecurePassword123!"
    }
    response = client.post("/api/v1/auth/register", json=register_payload)
    assert response.status_code == status.HTTP_201_CREATED
    user_data = response.json()
    assert user_data["username"] == "testuser"
    assert user_data["phone_number"] == "+237699999999"
    assert "id" in user_data

    # 2. Login with the credentials
    login_payload = {
        "phone_number": "+237699999999",
        "password": "SecurePassword123!"
    }
    response = client.post("/api/v1/auth/login", json=login_payload)
    assert response.status_code == status.HTTP_200_OK
    token_data = response.json()
    assert token_data["token_type"] == "bearer"
    assert "access_token" in token_data
    access_token = token_data["access_token"]

    # 3. Retrieve current user profile
    headers = {"Authorization": f"Bearer {access_token}"}
    response = client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == status.HTTP_200_OK
    profile_data = response.json()
    assert profile_data["username"] == "testuser"
    assert profile_data["phone_number"] == "+237699999999"

def test_unauthorized_endpoints(client: TestClient):
    """
    Test that authenticated endpoints reject requests without a token.
    """
    response = client.get("/api/v1/auth/me")
    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.json()["error_code"] == "UNAUTHORIZED"

    response = client.get("/api/v1/accounts/")
    assert response.status_code == status.HTTP_401_UNAUTHORIZED

def test_account_creation_and_retrieval(client: TestClient):
    """
    Test account creation and retrieval flows under authenticated state.
    """
    # 1. Register and login
    register_payload = {
        "username": "accountuser",
        "phone_number": "+237688888888",
        "password": "SecurePassword123!"
    }
    client.post("/api/v1/auth/register", json=register_payload)
    
    login_payload = {
        "phone_number": "+237688888888",
        "password": "SecurePassword123!"
    }
    response = client.post("/api/v1/auth/login", json=login_payload)
    access_token = response.json()["access_token"]
    headers = {"Authorization": f"Bearer {access_token}"}

    # 2. Get accounts (initially empty)
    response = client.get("/api/v1/accounts/", headers=headers)
    assert response.status_code == status.HTTP_200_OK
    assert len(response.json()) == 0

    # 3. Create a new account
    account_payload = {
        "name": "Orange Money Wallet",
        "account_type": "MOBILE_MONEY",
        "provider": "ORANGE_MONEY",
        "currency": "XAF"
    }
    response = client.post("/api/v1/accounts/", json=account_payload, headers=headers)
    assert response.status_code == status.HTTP_201_CREATED
    new_account = response.json()
    assert new_account["name"] == "Orange Money Wallet"
    assert new_account["account_type"] == "MOBILE_MONEY"
    assert new_account["provider"] == "ORANGE_MONEY"
    assert "id" in new_account
    account_id = new_account["id"]

    # 4. Get active accounts
    response = client.get("/api/v1/accounts/active", headers=headers)
    assert response.status_code == status.HTTP_200_OK
    assert len(response.json()) == 1
    assert response.json()[0]["id"] == account_id

    # 5. Get individual account details
    response = client.get(f"/api/v1/accounts/{account_id}", headers=headers)
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["name"] == "Orange Money Wallet"

    # 6. Delete account
    response = client.delete(f"/api/v1/accounts/{account_id}", headers=headers)
    assert response.status_code == status.HTTP_204_NO_CONTENT

    # 7. Verify account is gone
    response = client.get(f"/api/v1/accounts/{account_id}", headers=headers)
    assert response.status_code == status.HTTP_404_NOT_FOUND
