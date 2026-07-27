"""
Mbamager Repository Package

This package contains the data access layer responsible for interacting with the database
through SQLAlchemy repositories.
"""

from app.repositories.account_repository import AccountRepository
from app.repositories.base import BaseRepository
from app.repositories.budget_repository import BudgetRepository
from app.repositories.financial_profile_repository import FinancialProfileRepository
from app.repositories.transaction_repository import TransactionRepository
from app.repositories.user_repository import UserRepository
from app.repositories.sms_message_repository import SMSMessageRepository
from app.repositories.savings_goal_repository import SavingsGoalRepository
from app.repositories.recurring_transaction_repository import RecurringTransactionRepository
from app.repositories.notification_repository import NotificationRepository
from app.repositories.password_reset_otp_repository import PasswordResetOTPRepository
from app.repositories.tontine_repository import (
    TontineGroupRepository,
    TontineMemberRepository,
    TontineContributionRepository,
    TontinePayoutRepository,
)

__all__: list[str] = [
    "BaseRepository",
    "UserRepository",
    "FinancialProfileRepository",
    "AccountRepository",
    "TransactionRepository",
    "BudgetRepository",
    "SMSMessageRepository",
    "SavingsGoalRepository",
    "RecurringTransactionRepository",
    "NotificationRepository",
    "PasswordResetOTPRepository",
    "TontineGroupRepository",
    "TontineMemberRepository",
    "TontineContributionRepository",
    "TontinePayoutRepository",
]
