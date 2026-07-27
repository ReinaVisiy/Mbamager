"""
Mbamager Application Configuration

This module parses global configuration metrics and credentials from environmental variables,
utilizing Pydantic validation to enforce secure initialization rules.
"""

from typing import Optional

from pydantic_settings import BaseSettings

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
    JWT_SECRET_KEY: str = "your-super-secret-jwt-key-for-development"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

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

settings: Settings = Settings()
