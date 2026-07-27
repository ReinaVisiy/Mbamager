"""
Mbamager Database Models Package

This package exposes all SQLAlchemy domain models. Explicitly importing these here
ensures they are loaded correctly during Alembic migration autogeneration.
"""

from app.database.base import Base
from app.models.account import Account, AccountProvider, AccountType
from app.models.budget import Budget
from app.models.financial_profile import FinancialProfile
from app.models.transaction import Transaction, TransactionCategory, TransactionDirection
from app.models.user import User
from app.models.sms_message import SMSMessage
from app.models.savings_goal import SavingsGoal, SavingsGoalStatus
from app.models.recurring_transaction import RecurringTransaction, RecurringFrequency
from app.models.notification import Notification, NotificationType
from app.models.password_reset_otp import PasswordResetOTP
from app.models.tontine import (
    TontineGroup,
    TontineGroupStatus,
    TontineMember,
    TontineContribution,
    TontineContributionStatus,
    TontinePayout,
    TontineFrequency,
)

__all__ = [
    "Base",
    "User",
    "FinancialProfile",
    "Account",
    "AccountType",
    "AccountProvider",
    "Transaction",
    "TransactionDirection",
    "TransactionCategory",
    "Budget",
    "SMSMessage",
    "SavingsGoal",
    "SavingsGoalStatus",
    "RecurringTransaction",
    "RecurringFrequency",
    "Notification",
    "NotificationType",
    "PasswordResetOTP",
    "TontineGroup",
    "TontineGroupStatus",
    "TontineMember",
    "TontineContribution",
    "TontineContributionStatus",
    "TontinePayout",
    "TontineFrequency",
]
