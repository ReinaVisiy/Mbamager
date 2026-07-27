"""
Tests for app/core/config.py's Settings validation -- specifically the
fail-fast check that refuses to start with the insecure, hardcoded
development JWT secret while DEBUG=False.
"""

import pytest

from app.core.config import Settings


def test_default_settings_are_valid_in_debug_mode():
    """
    The out-of-the-box default (DEBUG=True, placeholder JWT secret) must
    keep working for local development with no .env file at all.
    """
    settings = Settings(DEBUG=True)
    assert settings.JWT_SECRET_KEY == "your-super-secret-jwt-key-for-development"


def test_insecure_jwt_secret_rejected_when_debug_is_false():
    """
    Running with DEBUG=False and the placeholder secret must fail loudly
    at startup rather than silently signing tokens with a value visible in
    this repository's source history.
    """
    with pytest.raises(ValueError, match="JWT_SECRET_KEY"):
        Settings(DEBUG=False, JWT_SECRET_KEY="your-super-secret-jwt-key-for-development")


def test_real_jwt_secret_accepted_when_debug_is_false():
    """
    A real, non-default secret must be accepted regardless of DEBUG.
    """
    settings = Settings(DEBUG=False, JWT_SECRET_KEY="a-real-unique-production-secret")
    assert settings.JWT_SECRET_KEY == "a-real-unique-production-secret"
