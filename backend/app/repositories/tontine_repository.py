"""
Mbamager Tontine (Njangi) Repositories

This module defines the data access layer for TontineGroup, TontineMember,
TontineContribution, and TontinePayout entities.
"""

from sqlalchemy import cast, func, or_, select, String
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tontine import TontineContribution, TontineGroup, TontineMember, TontinePayout
from app.repositories.base import BaseRepository


class TontineGroupRepository(BaseRepository[TontineGroup]):
    """
    Repository handling data access operations for TontineGroup entities.
    """

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(db, TontineGroup)

    async def get_by_creator_id(self, creator_id: int) -> list[TontineGroup]:
        """
        Retrieve all tontine groups created by a user.
        """
        stmt = select(TontineGroup).where(TontineGroup.creator_id == creator_id)
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def get_for_member_user(self, user_id: int) -> list[TontineGroup]:
        """
        Retrieve every group a user belongs to as a linked member (in
        addition to any groups they created).
        """
        stmt = (
            select(TontineGroup)
            .join(TontineMember, TontineMember.group_id == TontineGroup.id)
            .where(TontineMember.user_id == user_id)
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def search_by_creator(self, creator_id: int, query: str, limit: int = 5) -> list[TontineGroup]:
        """
        Search groups a user created by name, description, or status.
        """
        pattern = f"%{query}%"
        stmt = (
            select(TontineGroup)
            .where(
                TontineGroup.creator_id == creator_id,
                or_(
                    TontineGroup.name.ilike(pattern),
                    TontineGroup.description.ilike(pattern),
                    cast(TontineGroup.status, String).ilike(pattern),
                ),
            )
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()


class TontineMemberRepository(BaseRepository[TontineMember]):
    """
    Repository handling data access operations for TontineMember entities.
    """

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(db, TontineMember)

    async def get_by_group_id(self, group_id: int) -> list[TontineMember]:
        """
        Retrieve all members of a group, ordered by rotation position.
        """
        stmt = (
            select(TontineMember)
            .where(TontineMember.group_id == group_id)
            .order_by(TontineMember.payout_position)
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def get_max_position(self, group_id: int) -> int:
        """
        Retrieve the highest rotation position currently assigned in a group
        (0 if the group has no members yet).
        """
        stmt = select(func.max(TontineMember.payout_position)).where(
            TontineMember.group_id == group_id
        )
        result = await self.db.execute(stmt)
        return result.scalar() or 0

    async def get_by_position(self, group_id: int, position: int) -> TontineMember | None:
        """
        Retrieve the member holding a specific rotation position in a group.
        """
        stmt = select(TontineMember).where(
            TontineMember.group_id == group_id,
            TontineMember.payout_position == position,
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()


class TontineContributionRepository(BaseRepository[TontineContribution]):
    """
    Repository handling data access operations for TontineContribution
    entities.
    """

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(db, TontineContribution)

    async def get_by_group_and_cycle(self, group_id: int, cycle_number: int) -> list[TontineContribution]:
        """
        Retrieve every contribution recorded for a group's given cycle.
        """
        stmt = select(TontineContribution).where(
            TontineContribution.group_id == group_id,
            TontineContribution.cycle_number == cycle_number,
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def get_by_member_and_cycle(self, member_id: int, cycle_number: int) -> TontineContribution | None:
        """
        Retrieve a specific member's contribution for a given cycle, if any.
        """
        stmt = select(TontineContribution).where(
            TontineContribution.member_id == member_id,
            TontineContribution.cycle_number == cycle_number,
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()


class TontinePayoutRepository(BaseRepository[TontinePayout]):
    """
    Repository handling data access operations for TontinePayout entities.
    """

    def __init__(self, db: AsyncSession) -> None:
        super().__init__(db, TontinePayout)

    async def get_by_group_and_cycle(self, group_id: int, cycle_number: int) -> TontinePayout | None:
        """
        Retrieve the payout already made for a group's given cycle, if any.
        """
        stmt = select(TontinePayout).where(
            TontinePayout.group_id == group_id,
            TontinePayout.cycle_number == cycle_number,
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_group_id(self, group_id: int) -> list[TontinePayout]:
        """
        Retrieve every payout made so far for a group.
        """
        stmt = select(TontinePayout).where(TontinePayout.group_id == group_id)
        result = await self.db.execute(stmt)
        return result.scalars().all()
