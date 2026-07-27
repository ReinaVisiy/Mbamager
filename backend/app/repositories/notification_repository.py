"""
Mbamager Notification Repository

This module defines the data access layer for Notification entities.
"""

from sqlalchemy import cast, or_, select, String
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification
from app.repositories.base import BaseRepository

class NotificationRepository(BaseRepository[Notification]):
    """
    Repository handling data access operations for Notification entities.
    """

    def __init__(self, db: AsyncSession) -> None:
        """
        Initialize with session.
        """
        super().__init__(db, Notification)

    async def get_by_user_id(self, user_id: int) -> list[Notification]:
        """
        Retrieve all notifications belonging to a user, ordered by creation time descending.
        """
        stmt = select(Notification).where(Notification.user_id == user_id).order_by(Notification.created_at.desc())
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def get_unread_by_user_id(self, user_id: int) -> list[Notification]:
        """
        Retrieve only unread notifications belonging to a user, ordered by creation time descending.
        """
        stmt = select(Notification).where(
            Notification.user_id == user_id,
            Notification.is_read == False
        ).order_by(Notification.created_at.desc())
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def search(self, user_id: int, query: str, limit: int = 5) -> list[Notification]:
        """
        Search a user's notifications by title, message, or type, newest
        first.
        """
        pattern = f"%{query}%"
        stmt = (
            select(Notification)
            .where(
                Notification.user_id == user_id,
                or_(
                    Notification.title.ilike(pattern),
                    Notification.message.ilike(pattern),
                    cast(Notification.type, String).ilike(pattern),
                ),
            )
            .order_by(Notification.created_at.desc())
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()
