"""
Mbamager Tontine (Njangi) Router

This module defines FastAPI endpoints for rotating savings/credit groups:
group management, membership, per-cycle contributions, and payouts.
"""

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencies.auth import get_current_user, get_tontine_service
from app.models.user import User
from app.schemas.tontine import (
    TontineContributionCreate,
    TontineContributionResponse,
    TontineCycleStatusResponse,
    TontineGroupCreate,
    TontineGroupResponse,
    TontineGroupUpdate,
    TontineMemberCreate,
    TontineMemberResponse,
    TontinePayoutCreate,
    TontinePayoutResponse,
)
from app.services.tontine_service import TontineService

router = APIRouter(prefix="/tontine", tags=["Tontine / Njangi Groups"])


def _raise_not_found_or_bad_request(e: ValueError) -> None:
    """
    Membership/ownership failures and workflow validation errors are both
    raised as ValueError by the service layer. "not found" phrasing maps to
    404 (also used to hide groups the requester has no access to); anything
    else is a 400.
    """
    detail = str(e)
    if "not found" in detail.lower():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail)
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


# --- Groups ---------------------------------------------------------------------------

@router.post("", response_model=TontineGroupResponse, status_code=status.HTTP_201_CREATED)
async def create_group(
    group_in: TontineGroupCreate,
    current_user: User = Depends(get_current_user),
    tontine_service: TontineService = Depends(get_tontine_service),
) -> TontineGroupResponse:
    """
    Create a new tontine/njangi group. The creator becomes rotation
    position 1 automatically.
    """
    return await tontine_service.create_group(current_user.id, group_in)


@router.get("", response_model=list[TontineGroupResponse])
async def list_groups(
    current_user: User = Depends(get_current_user),
    tontine_service: TontineService = Depends(get_tontine_service),
) -> list[TontineGroupResponse]:
    """
    List every group the authenticated user created or belongs to.
    """
    return await tontine_service.get_user_groups(current_user.id)


@router.get("/{group_id}", response_model=TontineGroupResponse)
async def get_group(
    group_id: int,
    current_user: User = Depends(get_current_user),
    tontine_service: TontineService = Depends(get_tontine_service),
) -> TontineGroupResponse:
    """
    Retrieve details of a specific tontine group.
    """
    try:
        return await tontine_service.get_group(current_user.id, group_id)
    except ValueError as e:
        _raise_not_found_or_bad_request(e)


@router.put("/{group_id}", response_model=TontineGroupResponse)
async def update_group(
    group_id: int,
    group_in: TontineGroupUpdate,
    current_user: User = Depends(get_current_user),
    tontine_service: TontineService = Depends(get_tontine_service),
) -> TontineGroupResponse:
    """
    Update a group's name, description, contribution amount, or status.
    """
    try:
        return await tontine_service.update_group(current_user.id, group_id, group_in)
    except ValueError as e:
        _raise_not_found_or_bad_request(e)


@router.delete("/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_group(
    group_id: int,
    current_user: User = Depends(get_current_user),
    tontine_service: TontineService = Depends(get_tontine_service),
) -> None:
    """
    Delete a tontine group and all of its members/contributions/payouts.
    """
    try:
        await tontine_service.delete_group(current_user.id, group_id)
    except ValueError as e:
        _raise_not_found_or_bad_request(e)


# --- Members ----------------------------------------------------------------------------

@router.post("/{group_id}/members", response_model=TontineMemberResponse, status_code=status.HTTP_201_CREATED)
async def add_member(
    group_id: int,
    member_in: TontineMemberCreate,
    current_user: User = Depends(get_current_user),
    tontine_service: TontineService = Depends(get_tontine_service),
) -> TontineMemberResponse:
    """
    Add a member to the rotation at the next available payout position.
    """
    try:
        return await tontine_service.add_member(current_user.id, group_id, member_in)
    except ValueError as e:
        _raise_not_found_or_bad_request(e)


@router.get("/{group_id}/members", response_model=list[TontineMemberResponse])
async def list_members(
    group_id: int,
    current_user: User = Depends(get_current_user),
    tontine_service: TontineService = Depends(get_tontine_service),
) -> list[TontineMemberResponse]:
    """
    List all members of a group in rotation order.
    """
    try:
        return await tontine_service.list_members(current_user.id, group_id)
    except ValueError as e:
        _raise_not_found_or_bad_request(e)


@router.delete("/{group_id}/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    group_id: int,
    member_id: int,
    current_user: User = Depends(get_current_user),
    tontine_service: TontineService = Depends(get_tontine_service),
) -> None:
    """
    Remove a member from the rotation, provided they haven't already
    received a payout.
    """
    try:
        await tontine_service.remove_member(current_user.id, group_id, member_id)
    except ValueError as e:
        _raise_not_found_or_bad_request(e)


# --- Contributions ------------------------------------------------------------------------

@router.post(
    "/{group_id}/contributions",
    response_model=TontineContributionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def record_contribution(
    group_id: int,
    contribution_in: TontineContributionCreate,
    current_user: User = Depends(get_current_user),
    tontine_service: TontineService = Depends(get_tontine_service),
) -> TontineContributionResponse:
    """
    Record that a member has paid into the current (or specified) cycle.
    """
    try:
        return await tontine_service.record_contribution(current_user.id, group_id, contribution_in)
    except ValueError as e:
        _raise_not_found_or_bad_request(e)


@router.get("/{group_id}/cycles/{cycle_number}", response_model=TontineCycleStatusResponse)
async def get_cycle_status(
    group_id: int,
    cycle_number: int,
    current_user: User = Depends(get_current_user),
    tontine_service: TontineService = Depends(get_tontine_service),
) -> TontineCycleStatusResponse:
    """
    Get a computed snapshot of a cycle: who has paid, total collected, and
    whether it is ready for payout.
    """
    try:
        return await tontine_service.get_cycle_status(current_user.id, group_id, cycle_number)
    except ValueError as e:
        _raise_not_found_or_bad_request(e)


# --- Payouts ------------------------------------------------------------------------------

@router.post(
    "/{group_id}/payouts",
    response_model=TontinePayoutResponse,
    status_code=status.HTTP_201_CREATED,
)
async def record_payout(
    group_id: int,
    payout_in: TontinePayoutCreate,
    current_user: User = Depends(get_current_user),
    tontine_service: TontineService = Depends(get_tontine_service),
) -> TontinePayoutResponse:
    """
    Pay out the collected pot for the group's current cycle to whichever
    member holds that rotation position, then advance the rotation.
    """
    try:
        return await tontine_service.record_payout(current_user.id, group_id, payout_in)
    except ValueError as e:
        _raise_not_found_or_bad_request(e)
