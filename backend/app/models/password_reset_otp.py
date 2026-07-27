"""
Mbamager Password Reset OTP Domain Model

This module defines the SQLAlchemy 2.0 PasswordResetOTP model.
"""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database.base import Base

class PasswordResetOTP(Base):
    """
    PasswordResetOTP entity representing a verification code sent to reset a user's password.
    """
    __tablename__ = "password_reset_otps"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    identifier: Mapped[str] = mapped_column(String(128), index=True, nullable=False) # email or phone number
    otp_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    expiry: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    attempt_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    used_flag: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )

    def __repr__(self) -> str:
        return f"<PasswordResetOTP(id={self.id}, identifier={self.identifier}, used={self.used_flag})>"
