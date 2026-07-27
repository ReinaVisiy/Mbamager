"""
Mbamager Authentication Pydantic Schemas

This module defines schemas for handling API authentication requests and responses.
"""

from pydantic import Field

from app.schemas.common import BaseSchema

class LoginRequest(BaseSchema):
    """
    Schema representing a user login request using their email or phone number.
    """
    identifier: str = Field(
        ...,
        description="Email or phone number"
    )
    # The password is received in plaintext over HTTPS.
    # It must never be stored.
    # It must never be logged.
    # It is immediately hashed or verified by the authentication service.
    password: str = Field(
        ...,
        min_length=8,
        max_length=255,
        description="Plaintext security password"
    )

class TokenResponse(BaseSchema):
    """
    Schema representing a successful authentication token response.
    """
    access_token: str = Field(..., description="OAuth2 access token string")
    token_type: str = Field(default="bearer", description="Token scheme identifier")
    refresh_token: str | None = Field(default=None, description="OAuth2 refresh token string")
    expires_in: int = Field(..., description="Access token lifetime in seconds")

class RefreshTokenRequest(BaseSchema):
    """
    Schema representing a request to exchange a refresh token for a new
    access/refresh token pair.
    """
    refresh_token: str = Field(..., description="Previously issued refresh token")

class ForgotPasswordRequest(BaseSchema):
    """
    Schema representing a password recovery request.
    """
    identifier: str = Field(..., description="Email or phone number")

class VerifyOtpRequest(BaseSchema):
    """
    Schema representing an OTP verification request.
    """
    identifier: str = Field(..., description="Email or phone number")
    code: str = Field(..., min_length=6, max_length=6, description="6-digit verification code")

class ResetPasswordRequest(BaseSchema):
    """
    Schema representing a final password reset action.
    """
    identifier: str = Field(..., description="Email or phone number")
    reset_token: str = Field(..., description="Temporary secure reset authorization token")
    new_password: str = Field(..., min_length=8, max_length=255, description="New plaintext password")
