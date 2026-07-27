"""
Mbamager Recurring Transaction Scheduler

Wires APScheduler to RecurringTransactionService.process_due_transactions()
so recurring templates (rent, salary, subscriptions, etc.) actually post
transactions on their own, instead of only running when a user hits
POST /recurring-transactions/process by hand.

Runs outside any HTTP request, so it opens its own AsyncSession directly
from SessionLocal (the same session factory app/database/session.py hands
to FastAPI's get_db) rather than going through Depends(). Commit/rollback
here mirrors get_db's behavior.
"""

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.database.session import SessionLocal
from app.repositories.account_repository import AccountRepository
from app.repositories.notification_repository import NotificationRepository
from app.repositories.recurring_transaction_repository import RecurringTransactionRepository
from app.repositories.transaction_repository import TransactionRepository
from app.services.notification_service import NotificationService
from app.services.recurring_transaction_service import RecurringTransactionService

logger = logging.getLogger(__name__)


async def run_recurring_transaction_job() -> None:
    """
    Scan every active recurring template across all users and post ledger
    transactions for anything due today. Scheduled to run once daily; safe
    to trigger more than once since RecurringTransaction.last_processed
    prevents duplicate postings for the same period.
    """
    async with SessionLocal() as db:
        try:
            service = RecurringTransactionService(
                RecurringTransactionRepository(db),
                transaction_repository=TransactionRepository(db),
                account_repository=AccountRepository(db),
                notification_service=NotificationService(NotificationRepository(db)),
            )
            processed = await service.process_due_transactions()
            await db.commit()
            logger.info(f"Recurring transaction job posted {processed} transaction(s).")
        except Exception:
            await db.rollback()
            logger.exception("Recurring transaction job failed and was rolled back.")


def create_scheduler() -> AsyncIOScheduler:
    """
    Build (but do not start) the AsyncIOScheduler. Runs the recurring-
    transaction job once a day at 00:05 server time — late enough past
    midnight that "today" is unambiguous for every frequency in is_due().
    """
    scheduler = AsyncIOScheduler(timezone="UTC")
    scheduler.add_job(
        run_recurring_transaction_job,
        trigger=CronTrigger(hour=0, minute=5),
        id="process_recurring_transactions",
        name="Process due recurring transactions",
        replace_existing=True,
        misfire_grace_time=3600,  # tolerate up to an hour of delay (e.g. after a restart)
    )
    return scheduler
