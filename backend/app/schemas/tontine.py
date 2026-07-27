"""
Mbamager Tontine (Njangi) Schemas

This module defines Pydantic validation schemas for rotating savings group
(Tontine/Njangi) operations.
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from pydantic import Field

from app.models.tontine import TontineFrequency, TontineGroupStatus, TontineContributionStatus
from app.schemas.common import BaseSchema, TimestampSchema


class TontineGroupCreate(BaseSchema):
    name: str = Field(..., max_length=128, description="The name of the tontine/njangi group")
    description: Optional[str] = Field(default=None, max_length=255, description="Optional group description")
    contribution_amount: Decimal = Field(..., gt=0, description="Fixed amount every member contributes per cycle")
    currency: str = Field(default="XAF", max_length=3, description="ISO currency code")
    frequency: TontineFrequency = Field(..., description="How often the group collects contributions")
    start_date: Optional[date] = Field(default=None, description="Date the rotation begins")


class TontineGroupUpdate(BaseSchema):
    name: Optional[str] = Field(default=None, max_length=128)
    description: Optional[str] = Field(default=None, max_length=255)
    contribution_amount: Optional[Decimal] = Field(default=None, gt=0)
    status: Optional[TontineGroupStatus] = Field(default=None)


class TontineGroupResponse(TimestampSchema):
    id: int
    creator_id: int
    name: str
    description: Optional[str]
    contribution_amount: Decimal
    currency: str
    frequency: TontineFrequency
    status: TontineGroupStatus
    current_cycle: int
    start_date: date


class TontineMemberCreate(BaseSchema):
    display_name: str = Field(..., max_length=128, description="Name shown for this member")
    user_id: Optional[int] = Field(default=None, description="Linked Mbamager user id, if the member has an account")


class TontineMemberResponse(BaseSchema):
    id: int
    group_id: int
    user_id: Optional[int]
    display_name: str
    payout_position: int
    has_received_payout: bool
    joined_at: datetime


class TontineContributionCreate(BaseSchema):
    member_id: int = Field(..., description="Member making the contribution")
    cycle_number: Optional[int] = Field(default=None, description="Cycle being paid for; defaults to the group's current cycle")
    amount: Optional[Decimal] = Field(default=None, gt=0, description="Defaults to the group's fixed contribution amount")
    transaction_id: Optional[int] = Field(default=None, description="Linked ledger transaction, if the money moved through an account")


class TontineContributionResponse(BaseSchema):
    id: int
    group_id: int
    member_id: int
    cycle_number: int
    amount: Decimal
    status: TontineContributionStatus
    transaction_id: Optional[int]
    paid_at: datetime


class TontinePayoutCreate(BaseSchema):
    cycle_number: Optional[int] = Field(default=None, description="Cycle to pay out; defaults to the group's current cycle")
    transaction_id: Optional[int] = Field(default=None, description="Linked ledger transaction, if the money moved through an account")


class TontinePayoutResponse(BaseSchema):
    id: int
    group_id: int
    member_id: int
    cycle_number: int
    amount: Decimal
    transaction_id: Optional[int]
    paid_at: datetime


class TontineMemberCycleStatus(BaseSchema):
    member_id: int
    display_name: str
    payout_position: int
    has_paid: bool


class TontineCycleStatusResponse(BaseSchema):
    """
    Fully computed snapshot of one rotation cycle. Nothing here is stored;
    it is derived from TontineContribution/TontinePayout rows each time it
    is requested.
    """
    group_id: int
    cycle_number: int
    contribution_amount: Decimal
    expected_total: Decimal
    collected_total: Decimal
    members: list[TontineMemberCycleStatus]
    all_members_paid: bool
    recipient_member_id: Optional[int]
    payout_made: bool
