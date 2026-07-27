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
        "identifier": "+237699999999",
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

def test_refresh_token_flow(client: TestClient):
    """
    Test that a refresh token can be exchanged for a new access/refresh
    pair, that the old refresh token cannot be reused after rotation, and
    that a refresh token cannot be used as an access token.
    """
    register_payload = {
        "username": "refreshuser",
        "phone_number": "+237688888888",
        "password": "SecurePassword123!"
    }
    response = client.post("/api/v1/auth/register", json=register_payload)
    assert response.status_code == status.HTTP_201_CREATED

    login_payload = {
        "identifier": "+237688888888",
        "password": "SecurePassword123!"
    }
    response = client.post("/api/v1/auth/login", json=login_payload)
    assert response.status_code == status.HTTP_200_OK
    token_data = response.json()
    assert "refresh_token" in token_data and token_data["refresh_token"]
    old_refresh_token = token_data["refresh_token"]

    # 1. A refresh token must not work as an access token
    bad_headers = {"Authorization": f"Bearer {old_refresh_token}"}
    response = client.get("/api/v1/auth/me", headers=bad_headers)
    assert response.status_code == status.HTTP_401_UNAUTHORIZED

    # 2. Exchange the refresh token for a new pair
    response = client.post("/api/v1/auth/refresh", json={"refresh_token": old_refresh_token})
    assert response.status_code == status.HTTP_200_OK
    new_token_data = response.json()
    assert new_token_data["token_type"] == "bearer"
    new_access_token = new_token_data["access_token"]
    new_refresh_token = new_token_data["refresh_token"]
    assert new_refresh_token and new_refresh_token != old_refresh_token

    # 3. The new access token works against a protected endpoint
    headers = {"Authorization": f"Bearer {new_access_token}"}
    response = client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["username"] == "refreshuser"

    # 4. A garbage/invalid refresh token is rejected
    response = client.post("/api/v1/auth/refresh", json={"refresh_token": "not-a-real-token"})
    assert response.status_code == status.HTTP_401_UNAUTHORIZED

def test_update_profile(client: TestClient):
    """
    Test that PATCH /auth/me updates only the submitted fields, rejects
    duplicate identifiers already used by another user, and rejects
    unauthenticated requests.
    """
    register_payload = {
        "username": "profileuser",
        "phone_number": "+237677777777",
        "password": "SecurePassword123!"
    }
    response = client.post("/api/v1/auth/register", json=register_payload)
    assert response.status_code == status.HTTP_201_CREATED

    other_payload = {
        "username": "otheruser",
        "phone_number": "+237666666666",
        "password": "SecurePassword123!"
    }
    response = client.post("/api/v1/auth/register", json=other_payload)
    assert response.status_code == status.HTTP_201_CREATED

    login_payload = {"identifier": "+237677777777", "password": "SecurePassword123!"}
    response = client.post("/api/v1/auth/login", json=login_payload)
    headers = {"Authorization": f"Bearer {response.json()['access_token']}"}

    # 1. Unauthenticated update is rejected
    response = client.patch("/api/v1/auth/me", json={"username": "nope"})
    assert response.status_code == status.HTTP_401_UNAUTHORIZED

    # 2. Partial update: only username changes, phone stays the same
    response = client.patch("/api/v1/auth/me", json={"username": "newname"}, headers=headers)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["username"] == "newname"
    assert data["phone_number"] == "+237677777777"

    # 3. Email can be added
    response = client.patch("/api/v1/auth/me", json={"email": "profileuser@example.com"}, headers=headers)
    assert response.status_code == status.HTTP_200_OK
    assert response.json()["email"] == "profileuser@example.com"

    # 4. Taking a phone number already used by another user is rejected
    response = client.patch("/api/v1/auth/me", json={"phone_number": "+237666666666"}, headers=headers)
    assert response.status_code == status.HTTP_400_BAD_REQUEST

    # 5. New password works on next login
    response = client.patch("/api/v1/auth/me", json={"password": "NewSecurePassword456!"}, headers=headers)
    assert response.status_code == status.HTTP_200_OK
    response = client.post(
        "/api/v1/auth/login",
        json={"identifier": "+237677777777", "password": "NewSecurePassword456!"},
    )
    assert response.status_code == status.HTTP_200_OK

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
        "identifier": "+237688888888",
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
