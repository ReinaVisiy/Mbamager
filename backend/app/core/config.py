"""
Mbamager Application Configuration

This module parses global configuration metrics and credentials from environmental variables,
utilizing Pydantic validation to enforce secure initialization rules.
"""

from typing import Optional

from pydantic import model_validator
from pydantic_settings import BaseSettings

# Development-only placeholder. Never used as a real secret in production --
# see Settings._reject_insecure_jwt_secret_in_production below, which fails
# app startup immediately if this value is still active while DEBUG=False.
_INSECURE_DEFAULT_JWT_SECRET_KEY = "your-super-secret-jwt-key-for-development"

class Settings(BaseSettings):
    """
    Validates and stores general environment variables for the Mbamager API.
    """
    PROJECT_NAME: str = "Mbamager"
    VERSION: str = "0.1.0"
    DEBUG: bool = True

    # Comma-separated list of allowed frontend origins for CORS. The API is
    # accessed via a Bearer token in the Authorization header (see
    # frontend/src/lib/api.ts), never cookies, so credentialed CORS is not
    # needed here — origins are still kept explicit rather than "*" as a
    # baseline safe default.
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    @property
    def CORS_ORIGINS_LIST(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    # Cryptographic JWT Config
    JWT_SECRET_KEY: str = _INSECURE_DEFAULT_JWT_SECRET_KEY
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    # Refresh tokens are long-lived and carry scope="refresh" so they can
    # never be used directly against endpoints that expect an access token
    # (get_current_user only accepts tokens without that scope claim).
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 30  # 30 days

    # PostgreSQL Database Connection (async driver — repositories use AsyncSession)
    # Format: postgresql+asyncpg://<user>:<password>@<host>:<port>/<database>
    DATABASE_URL: str = "postgresql+asyncpg://mbamager:mbamager@localhost:5432/mbamager"

    # SMTP configuration for Password Recovery Emails
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "noreply@mbamager.com"

    # Cognitive SDK Secret (Google Gemini API)
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-3.5-flash"
    GEMINI_TEMPERATURE: float = 0.2
    GEMINI_MAX_TOKENS: int = 1000

    class Config:
        env_file: str = ".env"
        case_sensitive: bool = True

    @model_validator(mode="after")
    def _reject_insecure_jwt_secret_in_production(self) -> "Settings":
        """
        Fail app startup immediately if JWT_SECRET_KEY is still the public,
        hardcoded development placeholder while DEBUG=False. Without this,
        a deployment that forgets to set JWT_SECRET_KEY would silently sign
        every access token with a value visible in this repository's
        source history, letting anyone forge valid auth tokens.
        """
        if not self.DEBUG and self.JWT_SECRET_KEY == _INSECURE_DEFAULT_JWT_SECRET_KEY:
            raise ValueError(
                "JWT_SECRET_KEY is still the insecure development default while "
                "DEBUG=False. Set a real, unique JWT_SECRET_KEY in the environment "
                "(e.g. `openssl rand -hex 32`) before running with DEBUG=False."
            )
        return self

settings: Settings = Settings()
