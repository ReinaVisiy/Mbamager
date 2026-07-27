"""
Mbamager User Pydantic Schemas

This module defines Pydantic schemas for the User model, representing registered individuals.
"""

import re
from pydantic import Field, model_validator
from typing_extensions import Self

from app.schemas.common import BaseSchema, TimestampSchema

class UserBase(BaseSchema):
    """
    Shared attributes for registered users.
    """
    phone_number: str | None = Field(
        default=None,
        pattern=r"^\+2376\d{8}$",
        description="Canonical phone number format: +2376XXXXXXXX"
    )
    email: str | None = Field(
        default=None,
        description="Optional email address for authentication"
    )
    username: str | None = Field(
        default=None,
        max_length=64,
        description="User-defined optional profile username or household alias"
    )

class UserCreate(UserBase):
    """
    Payload required to register a new system user.
    """
    # The plaintext password is received over HTTPS.
    # It must never be stored directly.
    # Password hashing is performed only by the authentication service.
    password: str = Field(
        ...,
        min_length=8,
        max_length=255,
        description="Plaintext password to be hashed prior to persistence"
    )

    @model_validator(mode="after")
    def validate_identifiers(self) -> Self:
        if not self.phone_number and not self.email:
            raise ValueError("At least one of phone number or email is required.")
        if self.email:
            # Validate email format
            if not re.match(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$", self.email):
                raise ValueError("Invalid email format.")
        if self.phone_number:
            # Validate phone format
            if not re.match(r"^\+2376\d{8}$", self.phone_number):
                raise ValueError("Phone number must start with +2376 followed by exactly 8 digits.")
        return self

class UserUpdate(BaseSchema):
    """
    Payload for updating an existing user's information.
    All fields are optional to support partial updates.
    """
    phone_number: str | None = Field(
        default=None,
        pattern=r"^\+2376\d{8}$",
        description="Canonical phone number format: +2376XXXXXXXX"
    )
    email: str | None = Field(
        default=None,
        description="Optional email address"
    )
    username: str | None = Field(
        default=None,
        max_length=64,
        description="User-defined optional profile username or household alias"
    )
    # The plaintext password is received over HTTPS.
    # It must never be stored directly.
    # Password hashing is performed only by the authentication service.
    password: str | None = Field(
        default=None,
        min_length=8,
        max_length=255,
        description="Updated plaintext password"
    )

    @model_validator(mode="after")
    def validate_email_format(self) -> Self:
        if self.email and not re.match(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$", self.email):
            raise ValueError("Invalid email format.")
        return self


# Response schemas intentionally omit all security-sensitive fields (passwords, hashes, salts, etc.).
class UserResponse(UserBase, TimestampSchema):
    """
    Output model representing a registered user.
    Never exposes internal security credentials such as hashed password.
    """
    id: int = Field(..., description="Unique auto-incrementing identifier")
    is_active: bool = Field(..., description="Whether the user account is active")
