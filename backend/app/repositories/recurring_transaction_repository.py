"""
Mbamager Recurring Transaction Repository

This module defines the data access layer for RecurringTransaction entities.
"""

from sqlalchemy import cast, or_, select, String
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.recurring_transaction import RecurringTransaction
from app.repositories.base import BaseRepository

class RecurringTransactionRepository(BaseRepository[RecurringTransaction]):
    """
    Repository handling data access operations for RecurringTransaction entities.
    """

    def __init__(self, db: AsyncSession) -> None:
        """
        Initialize with session.
        """
        super().__init__(db, RecurringTransaction)

    async def get_by_user_id(self, user_id: int) -> list[RecurringTransaction]:
        """
        Retrieve all recurring transactions belonging to a user.
        """
        stmt = select(RecurringTransaction).where(RecurringTransaction.user_id == user_id)
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def get_active_recurring(self) -> list[RecurringTransaction]:
        """
        Retrieve all active recurring transaction rules in the system.
        """
        stmt = select(RecurringTransaction).where(RecurringTransaction.active == True)
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def search(self, user_id: int, query: str, limit: int = 5) -> list[RecurringTransaction]:
        """
        Search a user's recurring transaction rules by narrative, category,
        or frequency.
        """
        pattern = f"%{query}%"
        stmt = (
            select(RecurringTransaction)
            .where(
                RecurringTransaction.user_id == user_id,
                or_(
                    RecurringTransaction.narrative.ilike(pattern),
                    cast(RecurringTransaction.category, String).ilike(pattern),
                    cast(RecurringTransaction.frequency, String).ilike(pattern),
                ),
            )
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()
