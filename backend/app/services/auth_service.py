"""
Mbamager Authentication Service

This module contains authentication-related business logic.
"""

import re

from jose import JWTError

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    get_password_hash,
    verify_password,
)
from app.models.financial_profile import FinancialProfile
from app.models.user import User
from app.repositories import FinancialProfileRepository, UserRepository
from app.services.base_service import BaseService


class AuthService(BaseService[User]):
    """
    Service handling authentication and user-management business logic.
    """

    def __init__(
        self,
        repository: UserRepository,
        financial_profile_repository: FinancialProfileRepository,
    ) -> None:
        """
        Initialize the AuthService with a UserRepository and FinancialProfileRepository.
        """
        super().__init__(repository)
        self.financial_profile_repository = financial_profile_repository

    async def register_user(
        self,
        username: str,
        phone_number: str | None,
        password: str,
        email: str | None = None,
        **extra_fields,
    ) -> User:
        """
        Register a new user, hash their password, and create a default FinancialProfile.
        """
        if not phone_number and not email:
            raise ValueError("At least one of phone number or email is required")

        # verify that the username does not already exist
        if username:
            existing_user_by_username = await self.repository.get_by_username(username)
            if existing_user_by_username:
                raise ValueError("Username already exists")

        # verify that the phone number does not already exist
        if phone_number:
            existing_user_by_phone = await self.repository.get_by_phone_number(phone_number)
            if existing_user_by_phone:
                raise ValueError("Phone number already exists")

        # verify that the email does not already exist
        normalized_email = None
        if email:
            normalized_email = email.strip().lower()
            existing_user_by_email = await self.repository.get_by_email(normalized_email)
            if existing_user_by_email:
                raise ValueError("Email already exists")

        # hash the password using password utility
        hashed_pw = get_password_hash(password)

        # create a new User model instance
        new_user = User(
            username=username,
            phone_number=phone_number,
            email=normalized_email,
            hashed_password=hashed_pw,
            **extra_fields,
        )

        # persist user using UserRepository
        created_user = await self.repository.create(new_user)

        # create default FinancialProfile
        default_profile = FinancialProfile(
            user_id=created_user.id,
            preferred_currency="XAF",
            language="en",
            risk_tolerance="MEDIUM",
        )

        # persist financial profile using FinancialProfileRepository
        await self.financial_profile_repository.create(default_profile)

        return created_user

    async def login(self, identifier: str, password: str) -> tuple[str, str]:
        """
        Authenticate a user by email, phone number, or username, and return a
        (access_token, refresh_token) pair.
        """
        clean_identifier = identifier.strip()

        # Detect email, phone, or username
        if "@" in clean_identifier:
            user = await self.repository.get_by_email(clean_identifier.lower())
        elif bool(re.match(r"^\+?\d+$", clean_identifier)):
            user = await self.repository.get_by_phone_number(clean_identifier)
        else:
            user = await self.repository.get_by_username(clean_identifier)

        # Raise exception if user does not exist
        if not user:
            raise ValueError("User does not exist")

        # Verify password
        if not verify_password(password, user.hashed_password):
            raise ValueError("Incorrect password")

        return self._issue_token_pair(user)

    async def refresh_access_token(self, refresh_token: str) -> tuple[str, str]:
        """
        Validate a refresh token and issue a new (access_token, refresh_token)
        pair, rotating the refresh token so each one can only be used once.
        """
        try:
            payload = decode_refresh_token(refresh_token)
        except JWTError:
            raise ValueError("Invalid or expired refresh token")

        user_id = payload.get("user_id")
        if user_id is None:
            raise ValueError("Invalid or expired refresh token")

        user = await self.get_by_id(int(user_id))
        if not user:
            raise ValueError("User no longer exists")
        if not user.is_active:
            raise ValueError("This account has been deactivated")

        return self._issue_token_pair(user)

    def _issue_token_pair(self, user: User) -> tuple[str, str]:
        """
        Build the shared identity claims and issue a fresh access + refresh
        token pair for the given user.
        """
        token_data = {
            "sub": user.email if user.email else user.phone_number,
            "user_id": user.id,
            "username": user.username,
        }
        access_token = create_access_token(data=token_data)
        refresh_token = create_refresh_token(data=token_data)
        return access_token, refresh_token

    async def get_current_user(self, user_id: int) -> User:
        """
        Retrieve the authenticated user by their user ID.
        """
        user = await self.get_by_id(user_id)
        if not user:
            raise ValueError("User no longer exists")
        return user

    async def update_profile(self, user: User, updates: dict) -> User:
        """
        Apply a partial profile update to an already-authenticated user.

        `updates` is a dict of already-validated UserUpdate fields with
        unset fields excluded (see UserUpdate.model_dump(exclude_unset=True)
        at the call site). Uniqueness is re-checked here against other
        users, and a new password (if provided) is hashed before storage.
        """
        if "username" in updates and updates["username"] != user.username:
            new_username = updates["username"]
            if new_username:
                existing = await self.repository.get_by_username(new_username)
                if existing and existing.id != user.id:
                    raise ValueError("Username already exists")
            user.username = new_username

        if "phone_number" in updates and updates["phone_number"] != user.phone_number:
            new_phone = updates["phone_number"]
            if new_phone:
                existing = await self.repository.get_by_phone_number(new_phone)
                if existing and existing.id != user.id:
                    raise ValueError("Phone number already exists")
            user.phone_number = new_phone

        if "email" in updates and updates["email"] != user.email:
            new_email = updates["email"].strip().lower() if updates["email"] else None
            if new_email:
                existing = await self.repository.get_by_email(new_email)
                if existing and existing.id != user.id:
                    raise ValueError("Email already exists")
            user.email = new_email

        if "password" in updates and updates["password"]:
            user.hashed_password = get_password_hash(updates["password"])

        if not user.phone_number and not user.email:
            raise ValueError("At least one of phone number or email is required")

        return await self.update(user)
