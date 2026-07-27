"""
Mbamager API Dependencies

FastAPI dependency-provider functions used across all routers. Each
get_*_service function builds the repository/service chain for one request,
scoped to the request's AsyncSession from get_db. get_current_user decodes
the JWT issued by AuthService.login() and loads the authenticated user.
"""

from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.database.session import get_db
from app.models.user import User
from app.repositories import (
    AccountRepository,
    BudgetRepository,
    FinancialProfileRepository,
    NotificationRepository,
    PasswordResetOTPRepository,
    RecurringTransactionRepository,
    SavingsGoalRepository,
    SMSMessageRepository,
    TontineContributionRepository,
    TontineGroupRepository,
    TontineMemberRepository,
    TontinePayoutRepository,
    TransactionRepository,
    UserRepository,
)
from app.services import (
    AccountService,
    AIService,
    AuthService,
    BudgetService,
    DashboardService,
    NotificationService,
    RecurringTransactionService,
    SavingsGoalService,
    SearchService,
    SMSService,
    TontineService,
    TransactionService,
    UserService,
)
from app.services.email_service import EmailService
from app.services.password_reset_service import PasswordResetService
from app.services.sms_recovery_service import SMSRecoveryService

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


# --- Simple, single-repository services -------------------------------------------------

def get_user_service(db: AsyncSession = Depends(get_db)) -> UserService:
    return UserService(UserRepository(db))


def get_account_service(db: AsyncSession = Depends(get_db)) -> AccountService:
    return AccountService(AccountRepository(db))


def get_notification_service(db: AsyncSession = Depends(get_db)) -> NotificationService:
    return NotificationService(NotificationRepository(db))


def get_savings_goal_service(db: AsyncSession = Depends(get_db)) -> SavingsGoalService:
    return SavingsGoalService(
        SavingsGoalRepository(db),
        notification_service=get_notification_service(db),
    )


def get_ai_service() -> AIService:
    return AIService()


def get_tontine_service(db: AsyncSession = Depends(get_db)) -> TontineService:
    return TontineService(
        TontineGroupRepository(db),
        TontineMemberRepository(db),
        TontineContributionRepository(db),
        TontinePayoutRepository(db),
        notification_service=get_notification_service(db),
    )


def get_search_service(db: AsyncSession = Depends(get_db)) -> SearchService:
    return SearchService(
        AccountRepository(db),
        TransactionRepository(db),
        SavingsGoalRepository(db),
        RecurringTransactionRepository(db),
        NotificationRepository(db),
        TontineGroupRepository(db),
    )


# --- Services with cross-repository dependencies -----------------------------------------

def get_transaction_service(
    db: AsyncSession = Depends(get_db),
    ai_service: AIService = Depends(get_ai_service),
) -> TransactionService:
    return TransactionService(
        TransactionRepository(db),
        account_repository=AccountRepository(db),
        ai_service=ai_service,
    )


def get_budget_service(db: AsyncSession = Depends(get_db)) -> BudgetService:
    return BudgetService(
        BudgetRepository(db),
        transaction_repository=TransactionRepository(db),
    )


def get_recurring_transaction_service(db: AsyncSession = Depends(get_db)) -> RecurringTransactionService:
    return RecurringTransactionService(
        RecurringTransactionRepository(db),
        transaction_repository=TransactionRepository(db),
        account_repository=AccountRepository(db),
        notification_service=get_notification_service(db),
    )


def get_sms_service(
    db: AsyncSession = Depends(get_db),
    ai_service: AIService = Depends(get_ai_service),
) -> SMSService:
    return SMSService(
        SMSMessageRepository(db),
        transaction_service=get_transaction_service(db, ai_service),
        account_service=get_account_service(db),
        ai_service=ai_service,
    )


def get_dashboard_service(
    db: AsyncSession = Depends(get_db),
    ai_service: AIService = Depends(get_ai_service),
) -> DashboardService:
    return DashboardService(
        account_service=get_account_service(db),
        transaction_service=get_transaction_service(db, ai_service),
        budget_service=get_budget_service(db),
        savings_goal_service=get_savings_goal_service(db),
        recurring_service=get_recurring_transaction_service(db),
        notification_service=get_notification_service(db),
    )


# --- Auth-specific services -----------------------------------------------------------

def get_auth_service(db: AsyncSession = Depends(get_db)) -> AuthService:
    return AuthService(
        UserRepository(db),
        FinancialProfileRepository(db),
    )


def get_password_reset_service(db: AsyncSession = Depends(get_db)) -> PasswordResetService:
    return PasswordResetService(
        otp_repository=PasswordResetOTPRepository(db),
        user_repository=UserRepository(db),
        email_service=EmailService(),
        sms_service=SMSRecoveryService(),
    )


# --- Current user resolution ------------------------------------------------------------

async def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Decode the bearer JWT issued by AuthService.login(), and load the
    corresponding user. Raises 401 for any missing/invalid/expired token or
    unknown user.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not token:
        raise credentials_exception

    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        # Refresh tokens are signed with the same secret but carry
        # scope="refresh" - they must never authorize a normal request,
        # only a call to POST /auth/refresh.
        if payload.get("scope") == "refresh":
            raise credentials_exception
        user_id = payload.get("user_id")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user_repository = UserRepository(db)
    user = await user_repository.get_by_id(int(user_id))
    if user is None:
        raise credentials_exception
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account has been deactivated.",
        )

    return user
