"""
Mbamager Security Utilities

This module handles secure password hashing, credential comparison via bcrypt context,
and access token (JWT) issuance. It implements strict validation schemas to safeguard
unbanked and underbanked users from account compromise.
"""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

# Initialize password encryption mechanism (Bcrypt with automatic work rounds tuning)
pwd_context: CryptContext = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Compares a raw login password against a persistent hashed verification record.

    Args:
        plain_password: The unhashed raw input string.
        hashed_password: The cryptographically secured hash.

    Returns:
        True if the password matches; False otherwise.
    """
    return bool(pwd_context.verify(plain_password, hashed_password))

def get_password_hash(password: str) -> str:
    """
    Transforms a raw input password into a cryptographically secured bcrypt hash.

    Args:
        password: Raw password string.

    Returns:
        A secure bcrypt-hashed hex string.
    """
    return str(pwd_context.hash(password))

def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """
    Generates a secure JSON Web Token (JWT) containing custom claims and an expiration stamp.

    Args:
        data: Key-value attributes to incorporate inside the JWT payload.
        expires_delta: Custom duration for access validation.

    Returns:
        A base64 encoded cryptographic JWT string.
    """
    to_encode: Dict[str, Any] = data.copy()
    if expires_delta:
        expire: datetime = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire})
    encoded_jwt: str = jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt

def create_refresh_token(data: Dict[str, Any]) -> str:
    """
    Generates a long-lived JWT refresh token.

    The token carries a "scope": "refresh" claim so it is structurally
    distinguishable from an access token. get_current_user and every other
    access-token consumer must reject tokens carrying this scope, and this
    function must never be used to authorize a request directly - it only
    authorizes a call to /auth/refresh.

    Args:
        data: Key-value attributes to incorporate inside the JWT payload
            (typically the same identity claims as the access token).

    Returns:
        A base64 encoded cryptographic JWT string.
    """
    to_encode: Dict[str, Any] = data.copy()
    to_encode["scope"] = "refresh"
    # A unique id guarantees each issued refresh token is distinct even if
    # two are minted for the same user within the same second (e.g. rapid
    # rotation), so an old token can never be mistaken for still-valid.
    to_encode["jti"] = uuid.uuid4().hex
    expire: datetime = datetime.now(timezone.utc) + timedelta(minutes=settings.REFRESH_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt: str = jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt

def decode_refresh_token(token: str) -> Dict[str, Any]:
    """
    Decodes and validates a refresh token, enforcing that it carries
    scope="refresh" so an access token can never be replayed here.

    Args:
        token: The refresh token JWT string.

    Returns:
        The decoded claim payload.

    Raises:
        JWTError: If the token is malformed, expired, or is not a refresh
            token (wrong or missing scope).
    """
    payload: Dict[str, Any] = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    if payload.get("scope") != "refresh":
        raise JWTError("Token is not a valid refresh token.")
    return payload
