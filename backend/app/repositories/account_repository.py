"""
Mbamager Account Repository

This module defines the dedicated data access layer for Account entities.
"""

from sqlalchemy import cast, or_, select, String
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.account import Account
from app.repositories.base import BaseRepository

class AccountRepository(BaseRepository[Account]):
    """
    Repository handling data access operations for Account entities.
    """

    def __init__(self, db: AsyncSession) -> None:
        """
        Initialize the Account repository with a database session.
        """
        super().__init__(db, Account)

    async def get_by_user_id(self, user_id: int) -> list[Account]:
        """
        Retrieve all accounts belonging to a user.
        """
        stmt = select(Account).where(Account.user_id == user_id)
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def get_active_accounts(self, user_id: int) -> list[Account]:
        """
        Retrieve only active accounts belonging to a user.
        """
        stmt = select(Account).where(Account.user_id == user_id, Account.is_active.is_(True))
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def search(self, user_id: int, query: str, limit: int = 5) -> list[Account]:
        """
        Search a user's accounts by name, provider, or account type.
        Filters and limits at the SQL level so this stays fast regardless
        of how many accounts the user has.
        """
        pattern = f"%{query}%"
        stmt = (
            select(Account)
            .where(
                Account.user_id == user_id,
                or_(
                    Account.name.ilike(pattern),
                    cast(Account.provider, String).ilike(pattern),
                    cast(Account.account_type, String).ilike(pattern),
                ),
            )
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()
