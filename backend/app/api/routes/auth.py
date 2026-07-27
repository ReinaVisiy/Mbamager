"""
Mbamager Authentication Routes

This module defines FastAPI route handlers for user registration, user login, and
authenticated profile retrieval. It delegates business logic to the AuthService.
"""

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencies.auth import get_auth_service, get_current_user, get_password_reset_service
from app.core.config import settings
from app.core.rate_limiter import limit_auth
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    TokenResponse,
    ForgotPasswordRequest,
    RefreshTokenRequest,
    VerifyOtpRequest,
    ResetPasswordRequest,
)
from app.schemas.user import UserCreate, UserResponse, UserUpdate
from app.services import AuthService, PasswordResetService

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(limit_auth)])
async def register(
    user_in: UserCreate,
    auth_service: AuthService = Depends(get_auth_service)
) -> User:
    """
    Register a new user and return the created user profile.
    """
    try:
        user = await auth_service.register_user(
            username=user_in.username,
            phone_number=user_in.phone_number,
            password=user_in.password,
            email=user_in.email,
        )
        return user
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

@router.post("/forgot-password", dependencies=[Depends(limit_auth)])
async def forgot_password(
    req: ForgotPasswordRequest,
    reset_service: PasswordResetService = Depends(get_password_reset_service)
):
    """
    Initiate the password recovery process.
    Sends an OTP code via email or SMS.
    """
    try:
        res = await reset_service.request_otp(req.identifier)
        return res
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process recovery request: {str(e)}",
        )

@router.post("/verify-otp", dependencies=[Depends(limit_auth)])
async def verify_otp(
    req: VerifyOtpRequest,
    reset_service: PasswordResetService = Depends(get_password_reset_service)
):
    """
    Verify the entered OTP code.
    If valid, returns a temporary access token for reset.
    """
    try:
        reset_token = await reset_service.verify_otp(req.identifier, req.code)
        return {"reset_token": reset_token}
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

@router.post("/reset-password", dependencies=[Depends(limit_auth)])
async def reset_password(
    req: ResetPasswordRequest,
    reset_service: PasswordResetService = Depends(get_password_reset_service)
):
    """
    Submit and perform the actual password reset.
    """
    try:
        # Validate reset token has the correct scope
        from jose import jwt, JWTError
        try:
            payload = jwt.decode(req.reset_token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
            if payload.get("scope") != "password_reset" or payload.get("sub") != req.identifier.strip().lower():
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token.")
        except JWTError:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token.")

        res = await reset_service.reset_password(req.identifier, req.reset_token, req.new_password)
        return res
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

@router.post("/login", response_model=TokenResponse, dependencies=[Depends(limit_auth)])
async def login(
    login_in: LoginRequest,
    auth_service: AuthService = Depends(get_auth_service)
) -> TokenResponse:
    """
    Log in a user by phone number or username and return an access token.
    """
    try:
        access_token, refresh_token = await auth_service.login(
            identifier=login_in.identifier,
            password=login_in.password,
        )
        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            refresh_token=refresh_token,
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"},
        )

@router.post("/refresh", response_model=TokenResponse, dependencies=[Depends(limit_auth)])
async def refresh(
    req: RefreshTokenRequest,
    auth_service: AuthService = Depends(get_auth_service)
) -> TokenResponse:
    """
    Exchange a valid refresh token for a new access/refresh token pair.

    The refresh token is rotated on every use: the one submitted here is
    single-use, and the response carries a new refresh token that must
    replace it client-side.
    """
    try:
        access_token, refresh_token = await auth_service.refresh_access_token(req.refresh_token)
        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            refresh_token=refresh_token,
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(e),
            headers={"WWW-Authenticate": "Bearer"},
        )

@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Retrieve the current authenticated user's profile information.
    """
    return current_user

@router.patch("/me", response_model=UserResponse)
async def update_me(
    updates: UserUpdate,
    current_user: User = Depends(get_current_user),
    auth_service: AuthService = Depends(get_auth_service)
) -> User:
    """
    Update the current authenticated user's profile (name/phone/email/password).
    Only fields explicitly included in the request body are changed.
    """
    try:
        updated_user = await auth_service.update_profile(
            current_user,
            updates.model_dump(exclude_unset=True),
        )
        return updated_user
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
