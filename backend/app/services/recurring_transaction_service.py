"""
Mbamager Recurring Transaction Service

This module encapsulates business logic for managing and executing recurring transaction schedules.
"""

import calendar
import logging
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional

from app.models.recurring_transaction import RecurringTransaction, RecurringFrequency
from app.models.transaction import Transaction, TransactionDirection
from app.models.notification import NotificationType
from app.repositories.recurring_transaction_repository import RecurringTransactionRepository
from app.repositories.transaction_repository import TransactionRepository
from app.repositories.account_repository import AccountRepository
from app.schemas.recurring_transaction import RecurringTransactionCreate, RecurringTransactionUpdate
from app.services.base_service import BaseService
from app.services.notification_service import NotificationService

logger = logging.getLogger(__name__)

class RecurringTransactionService(BaseService[RecurringTransaction]):
    """
    Service layer coordinating RecurringTransaction CRUD and scheduler executions.
    """

    def __init__(
        self,
        repository: RecurringTransactionRepository,
        transaction_repository: TransactionRepository,
        account_repository: AccountRepository,
        notification_service: Optional[NotificationService] = None,
    ) -> None:
        """
        Initialize with repositories and optional NotificationService.
        """
        super().__init__(repository)
        self.transaction_repository = transaction_repository
        self.account_repository = account_repository
        self.notification_service = notification_service

    async def get_user_recurring(self, user_id: int) -> list[RecurringTransaction]:
        """
        Retrieve all recurring transaction templates for a user.
        """
        return await self.repository.get_by_user_id(user_id)

    async def get_recurring(self, user_id: int, recurring_id: int) -> RecurringTransaction:
        """
        Retrieve a single recurring template after verifying user ownership.
        """
        rec = await self.repository.get_by_id(recurring_id)
        if not rec or rec.user_id != user_id:
            raise ValueError("Recurring transaction template not found")
        return rec

    async def create_recurring(
        self,
        user_id: int,
        recurring_data: RecurringTransactionCreate,
    ) -> RecurringTransaction:
        """
        Create a new recurring transaction rule.
        """
        # Verify account ownership
        account = await self.account_repository.get_by_id(recurring_data.account_id)
        if not account or account.user_id != user_id:
            raise ValueError("Target account not found or access denied")

        rec = RecurringTransaction(
            user_id=user_id,
            account_id=recurring_data.account_id,
            amount=recurring_data.amount,
            category=recurring_data.category,
            direction=recurring_data.direction,
            frequency=recurring_data.frequency,
            start_date=recurring_data.start_date,
            end_date=recurring_data.end_date,
            active=True,
            narrative=recurring_data.narrative,
        )
        return await self.repository.create(rec)

    async def update_recurring(
        self,
        user_id: int,
        recurring_id: int,
        recurring_data: RecurringTransactionUpdate,
    ) -> RecurringTransaction:
        """
        Update an existing recurring transaction rule.
        """
        rec = await self.get_recurring(user_id, recurring_id)

        update_dict = recurring_data.model_dump(exclude_unset=True)
        if "account_id" in update_dict:
            account = await self.account_repository.get_by_id(update_dict["account_id"])
            if not account or account.user_id != user_id:
                raise ValueError("Target account not found or access denied")

        for key, value in update_dict.items():
            setattr(rec, key, value)

        return await self.repository.update(rec)

    async def delete_recurring(self, user_id: int, recurring_id: int) -> None:
        """
        Delete a recurring transaction rule.
        """
        rec = await self.get_recurring(user_id, recurring_id)
        await self.repository.delete(rec)

    def is_due(self, rec: RecurringTransaction, target_date: date) -> bool:
        """
        Determine if a recurring transaction template is due on a specific target date.
        """
        if not rec.active:
            return False
        if target_date < rec.start_date:
            return False
        if rec.end_date and target_date > rec.end_date:
            return False

        # If it hasn't been processed yet, it is due on or after the start_date
        if not rec.last_processed:
            return target_date >= rec.start_date

        days_since = (target_date - rec.last_processed).days
        if days_since <= 0:
            return False

        if rec.frequency == RecurringFrequency.DAILY:
            return days_since >= 1
        elif rec.frequency == RecurringFrequency.WEEKLY:
            return days_since >= 7
        elif rec.frequency == RecurringFrequency.MONTHLY:
            # Check if we have advanced by at least 1 month
            months_diff = (target_date.year - rec.last_processed.year) * 12 + target_date.month - rec.last_processed.month
            if months_diff >= 1:
                # Align with preferred day of month (start_date.day) or end of current month if it's shorter
                _, last_day = calendar.monthrange(target_date.year, target_date.month)
                preferred_day = min(rec.start_date.day, last_day)
                return target_date.day >= preferred_day or months_diff > 1
            return False
        elif rec.frequency == RecurringFrequency.YEARLY:
            # Check if we have advanced by at least 1 year
            years_diff = target_date.year - rec.last_processed.year
            if years_diff >= 1:
                if target_date.month > rec.start_date.month:
                    return True
                elif target_date.month == rec.start_date.month:
                    return target_date.day >= rec.start_date.day
            return False

        return False

    async def process_due_transactions(self, target_date: Optional[date] = None) -> int:
        """
        Scan all active schedules and generate ledger entries for due templates.
        Returns the count of transactions successfully created.
        """
        if target_date is None:
            target_date = date.today()

        active_schedules = await self.repository.get_active_recurring()
        processed_count = 0

        for rec in active_schedules:
            if self.is_due(rec, target_date):
                try:
                    # 1. Spawn corresponding Ledger transaction
                    tx_time = datetime.combine(target_date, datetime.min.time(), tzinfo=timezone.utc)
                    tx = Transaction(
                        account_id=rec.account_id,
                        amount=rec.amount,
                        fee=Decimal("0.00"),
                        direction=rec.direction,
                        category=rec.category,
                        narrative=rec.narrative or f"Recurring {rec.frequency.value.lower()} payment",
                        timestamp=tx_time,
                    )
                    await self.transaction_repository.create(tx)

                    # 2. Update recursion pointer to avoid duplicate executions
                    rec.last_processed = target_date
                    await self.repository.update(rec)
                    processed_count += 1

                    # 3. Create a notification alert
                    if self.notification_service:
                        direction_str = "credit" if rec.direction == TransactionDirection.CREDIT else "debit"
                        await self.notification_service.create_notification(
                            user_id=rec.user_id,
                            title="Recurring Payment Executed",
                            message=(
                                f"A recurring {direction_str} payment of {rec.amount} "
                                f"for '{tx.narrative}' was automatically posted to your account."
                            ),
                            type=NotificationType.RECURRING_PAYMENT
                        )
                except Exception as e:
                    logger.error(f"Failed to process recurring transaction {rec.id}: {str(e)}")

        return processed_count
