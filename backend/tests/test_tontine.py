"""
Tests for the Tontine/Njangi rotating savings group feature: membership,
per-cycle contribution collection, and rotation payouts.
"""

from decimal import Decimal

from fastapi import status
from fastapi.testclient import TestClient


def _register_and_login(client: TestClient, phone: str) -> dict:
    client.post(
        "/api/v1/auth/register",
        json={
            "username": f"tontineuser{phone[-4:]}",
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


def _create_group(client: TestClient, headers: dict) -> dict:
    response = client.post(
        "/api/v1/tontine",
        json={
            "name": "Family Njangi",
            "contribution_amount": "10000.00",
            "frequency": "MONTHLY",
        },
        headers=headers,
    )
    assert response.status_code == status.HTTP_201_CREATED
    return response.json()


def test_creator_is_automatically_first_member(client: TestClient):
    headers = _register_and_login(client, "+237620000001")
    group = _create_group(client, headers)

    members_resp = client.get(f"/api/v1/tontine/{group['id']}/members", headers=headers)
    members = members_resp.json()

    assert len(members) == 1
    assert members[0]["payout_position"] == 1
    assert members[0]["has_received_payout"] is False


def test_full_rotation_cycle_collects_and_pays_out(client: TestClient):
    """
    Two members contribute for cycle 1; once both have paid, the payout
    goes to whoever holds rotation position 1, and the group advances to
    cycle 2 -- all computed, nothing stored as a running balance.
    """
    headers = _register_and_login(client, "+237620000002")
    group = _create_group(client, headers)

    member_resp = client.post(
        f"/api/v1/tontine/{group['id']}/members",
        json={"display_name": "Cousin Ada"},
        headers=headers,
    )
    assert member_resp.status_code == status.HTTP_201_CREATED
    second_member = member_resp.json()

    members = client.get(f"/api/v1/tontine/{group['id']}/members", headers=headers).json()
    creator_member = next(m for m in members if m["payout_position"] == 1)

    for member_id in (creator_member["id"], second_member["id"]):
        contrib_resp = client.post(
            f"/api/v1/tontine/{group['id']}/contributions",
            json={"member_id": member_id},
            headers=headers,
        )
        assert contrib_resp.status_code == status.HTTP_201_CREATED
        assert Decimal(contrib_resp.json()["amount"]) == Decimal("10000.00")

    cycle_status = client.get(f"/api/v1/tontine/{group['id']}/cycles/1", headers=headers).json()
    assert cycle_status["all_members_paid"] is True
    assert Decimal(cycle_status["collected_total"]) == Decimal("20000.00")
    assert cycle_status["recipient_member_id"] == creator_member["id"]

    payout_resp = client.post(
        f"/api/v1/tontine/{group['id']}/payouts",
        json={},
        headers=headers,
    )
    assert payout_resp.status_code == status.HTTP_201_CREATED
    payout = payout_resp.json()
    assert payout["member_id"] == creator_member["id"]
    assert Decimal(payout["amount"]) == Decimal("20000.00")

    updated_group = client.get(f"/api/v1/tontine/{group['id']}", headers=headers).json()
    assert updated_group["current_cycle"] == 2


def test_duplicate_contribution_for_same_cycle_rejected(client: TestClient):
    headers = _register_and_login(client, "+237620000003")
    group = _create_group(client, headers)
    members = client.get(f"/api/v1/tontine/{group['id']}/members", headers=headers).json()
    member_id = members[0]["id"]

    first = client.post(
        f"/api/v1/tontine/{group['id']}/contributions",
        json={"member_id": member_id},
        headers=headers,
    )
    assert first.status_code == status.HTTP_201_CREATED

    second = client.post(
        f"/api/v1/tontine/{group['id']}/contributions",
        json={"member_id": member_id},
        headers=headers,
    )
    assert second.status_code == status.HTTP_400_BAD_REQUEST


def test_payout_blocked_until_all_members_have_paid(client: TestClient):
    headers = _register_and_login(client, "+237620000004")
    group = _create_group(client, headers)
    client.post(
        f"/api/v1/tontine/{group['id']}/members",
        json={"display_name": "Uncle Tabi"},
        headers=headers,
    )

    payout_resp = client.post(
        f"/api/v1/tontine/{group['id']}/payouts",
        json={},
        headers=headers,
    )
    assert payout_resp.status_code == status.HTTP_400_BAD_REQUEST


def test_non_member_cannot_see_group(client: TestClient):
    owner_headers = _register_and_login(client, "+237620000005")
    group = _create_group(client, owner_headers)

    outsider_headers = _register_and_login(client, "+237620000006")
    response = client.get(f"/api/v1/tontine/{group['id']}", headers=outsider_headers)
    assert response.status_code == status.HTTP_404_NOT_FOUND


def test_cannot_remove_member_who_already_received_payout(client: TestClient):
    headers = _register_and_login(client, "+237620000007")
    group = _create_group(client, headers)
    members = client.get(f"/api/v1/tontine/{group['id']}/members", headers=headers).json()
    member_id = members[0]["id"]

    client.post(
        f"/api/v1/tontine/{group['id']}/contributions",
        json={"member_id": member_id},
        headers=headers,
    )
    client.post(f"/api/v1/tontine/{group['id']}/payouts", json={}, headers=headers)

    remove_resp = client.delete(
        f"/api/v1/tontine/{group['id']}/members/{member_id}",
        headers=headers,
    )
    assert remove_resp.status_code == status.HTTP_400_BAD_REQUEST
