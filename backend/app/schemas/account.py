"""
Mbamager Account Pydantic Schemas

This module defines Pydantic schemas for the Account model, reusing the database enums.
"""

from pydantic import Field

from app.models.account import AccountProvider, AccountType
from app.schemas.common import BaseSchema, TimestampSchema

class AccountBase(BaseSchema):
    """
    Shared attributes for financial accounts and repositories.
    """
    name: str = Field(
        ...,
        min_length=1,
        max_length=64,
        description="User-defined display name shown in the application's UI (e.g. Main Wallet, Savings Cash, Orange SIM 2)"
    )
    account_type: AccountType = Field(
        ...,
        description="Category of financial storage (CASH, MOBILE_MONEY, BANK, OTHER)"
    )
    provider: AccountProvider = Field(
        ...,
        description="Selected underlying financial provider (MTN_MOMO, ORANGE_MONEY, CASH, BANK, OTHER) representing the network service provider (e.g. MTN MoMo, Orange Money, Bank, Cash)"
    )
    currency: str = Field(
        default="XAF",
        min_length=3,
        max_length=3,
        pattern=r"^[A-Z]{3}$",
        description="Standard ISO 4217 Currency Code"
    )
    is_active: bool = Field(
        default=True,
        description="Whether this account is active and available for entries"
    )

class AccountCreate(AccountBase):
    """
    Payload required to register a new storage account. user_id is
    intentionally NOT part of this payload — it is always taken from the
    authenticated user's JWT in the route, never from client input.
    """
    pass

class AccountUpdate(BaseSchema):
    """
    Payload for updating an existing account. All fields are optional.
    """
    name: str | None = Field(
        default=None,
        min_length=1,
        max_length=64,
        description="User-defined display name shown in the application's UI"
    )
    account_type: AccountType | None = Field(
        default=None,
        description="Category of financial storage"
    )
    provider: AccountProvider | None = Field(
        default=None,
        description="Selected underlying financial provider representing the network service provider (e.g. MTN MoMo, Orange Money, Bank, Cash)"
    )
    currency: str | None = Field(
        default=None,
        min_length=3,
        max_length=3,
        pattern=r"^[A-Z]{3}$",
        description="Standard ISO 4217 Currency Code"
    )
    is_active: bool | None = Field(
        default=None,
        description="Whether this account is active and available for entries"
    )

class AccountResponse(AccountBase, TimestampSchema):
    """
    Public schema for returning account information.
    """
    id: int = Field(..., description="Unique auto-incrementing account identifier")
    user_id: int = Field(..., description="Unique user identifier associated with this account")
