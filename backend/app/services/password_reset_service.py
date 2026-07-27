"""
Mbamager Password Reset Service

Handles OTP generation, hashing, verification limits, and secure password updates.
"""

import hashlib
import random
from datetime import datetime, timedelta, timezone
import logging

from app.core.security import get_password_hash, create_access_token
from app.models.password_reset_otp import PasswordResetOTP
from app.repositories.password_reset_otp_repository import PasswordResetOTPRepository
from app.repositories.user_repository import UserRepository
from app.services.email_service import EmailService
from app.services.sms_recovery_service import SMSRecoveryService

logger = logging.getLogger("app.services.password_reset_service")

class PasswordResetService:
    """
    Business logic layer for executing secure user password recovery.
    """

    def __init__(
        self,
        otp_repository: PasswordResetOTPRepository,
        user_repository: UserRepository,
        email_service: EmailService,
        sms_service: SMSRecoveryService,
    ) -> None:
        self.otp_repo = otp_repository
        self.user_repo = user_repository
        self.email_service = email_service
        self.sms_service = sms_service

    def _hash_otp(self, code: str) -> str:
        """
        Produce a secure SHA-256 hash of the verification OTP.
        """
        return hashlib.sha256(code.encode("utf-8")).hexdigest()

    async def request_otp(self, identifier: str) -> dict:
        """
        Initiate password recovery for an email or phone number.
        Returns a generic status message without disclosing user existence.
        """
        normalized_identifier = identifier.strip().lower()

        # Check if the identifier is email or phone number
        is_email = "@" in normalized_identifier
        user = None

        if is_email:
            user = await self.user_repo.get_by_email(normalized_identifier)
        else:
            # Normalize phone format if needed
            phone_number = normalized_identifier
            if not phone_number.startswith("+") and phone_number.isdigit():
                phone_number = "+" + phone_number
            user = await self.user_repo.get_by_phone_number(phone_number)

        # Retrieve the latest OTP to check 60-second rate limit
        latest_otp = await self.otp_repo.get_active_otp(normalized_identifier)
        if latest_otp:
            now = datetime.now(timezone.utc)
            # Make sure latest_otp.created_at is timezone-aware for subtraction
            created_at = latest_otp.created_at
            if created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=timezone.utc)
            
            elapsed = (now - created_at).total_seconds()
            if elapsed < 60:
                raise ValueError("Please wait 60 seconds before requesting another code.")

        # Generate OTP if user exists
        if user:
            # Secure 6-digit OTP
            otp_code = f"{random.randint(100000, 999999)}"
            otp_hash = self._hash_otp(otp_code)
            expiry_time = datetime.now(timezone.utc) + timedelta(minutes=10)

            # Invalidate previous OTPs for this identifier to prevent reuse
            if latest_otp:
                latest_otp.used_flag = True
                await self.otp_repo.update(latest_otp)

            # Persist OTP entry
            new_otp = PasswordResetOTP(
                identifier=normalized_identifier,
                otp_hash=otp_hash,
                expiry=expiry_time,
                attempt_count=0,
                used_flag=False,
            )
            await self.otp_repo.create(new_otp)

            # Disptach OTP using the appropriate channel
            if is_email:
                await self.email_service.send_password_reset_email(normalized_identifier, otp_code)
            else:
                await self.sms_service.send_otp_sms(user.phone_number, otp_code)
        else:
            logger.info(f"Password reset requested for non-existent identifier: {normalized_identifier}")

        # Always return generic message to protect account privacy
        return {"message": "If an account exists, a verification code has been sent."}

    async def verify_otp(self, identifier: str, code: str) -> str:
        """
        Verify the OTP entered by the user.
        If valid, marks it used and returns a temporary reset token.
        """
        normalized_identifier = identifier.strip().lower()
        otp = await self.otp_repo.get_active_otp(normalized_identifier)

        if not otp:
            raise ValueError("Invalid or expired verification code.")

        # Check expiration
        now = datetime.now(timezone.utc)
        expiry = otp.expiry
        if expiry.tzinfo is None:
            expiry = expiry.replace(tzinfo=timezone.utc)

        if now > expiry:
            otp.used_flag = True
            await self.otp_repo.update(otp)
            raise ValueError("Verification code has expired.")

        # Check attempt count (max 5)
        if otp.attempt_count >= 5:
            otp.used_flag = True
            await self.otp_repo.update(otp)
            raise ValueError("Maximum verification attempts exceeded. Please request a new code.")

        # Validate hash
        entered_hash = self._hash_otp(code.strip())
        if otp.otp_hash != entered_hash:
            otp.attempt_count += 1
            await self.otp_repo.update(otp)
            raise ValueError("Invalid verification code.")

        # Mark OTP as used
        otp.used_flag = True
        await self.otp_repo.update(otp)

        # Issue temporary reset token valid for 15 minutes
        reset_token = create_access_token(
            data={"sub": normalized_identifier, "scope": "password_reset"},
            expires_delta=timedelta(minutes=15)
        )
        return reset_token

    async def reset_password(self, identifier: str, reset_token: str, new_password: str) -> dict:
        """
        Verify temporary reset token and update user's password.
        """
        normalized_identifier = identifier.strip().lower()

        # Retrieve user
        is_email = "@" in normalized_identifier
        user = None
        if is_email:
            user = await self.user_repo.get_by_email(normalized_identifier)
        else:
            phone_number = normalized_identifier
            if not phone_number.startswith("+") and phone_number.isdigit():
                phone_number = "+" + phone_number
            user = await self.user_repo.get_by_phone_number(phone_number)

        if not user:
            raise ValueError("Account no longer exists.")

        # Hash new password and commit
        hashed_pw = get_password_hash(new_password)
        user.hashed_password = hashed_pw
        await self.user_repo.update(user)

        logger.info(f"Password successfully reset for account: {normalized_identifier}")
        return {"status": "success", "message": "Password updated successfully."}
