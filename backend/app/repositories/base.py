"""
Mbamager Reusable Base Repository

This module defines the reusable generic foundation for all database repositories
using SQLAlchemy 2.0 async APIs.
"""

from typing import Generic, TypeVar

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.base import Base

T = TypeVar("T", bound=Base)

class BaseRepository(Generic[T]):
    """
    Generic base repository providing standard asynchronous CRUD operations.
    """

    def __init__(self, db: AsyncSession, model: type[T]) -> None:
        self.db = db
        self.model = model

    async def create(self, obj: T) -> T:
        # Refresh after flush so server-generated columns (e.g. timestamps with
        # onupdate=func.now()) are materialized. Without this, SQLAlchemy leaves
        # them expired, and accessing them later during response serialization
        # triggers an implicit lazy load outside an async-aware context,
        # raising MissingGreenlet.
        self.db.add(obj)
        await self.db.flush()
        await self.db.refresh(obj)
        return obj

    async def get_by_id(self, id: int) -> T | None:
        return await self.db.get(self.model, id)

    async def get_all(self) -> list[T]:
        stmt = select(self.model)
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def update(self, obj: T) -> T:
        # Same refresh requirement as create(), see comment above.
        self.db.add(obj)
        await self.db.flush()
        await self.db.refresh(obj)
        return obj

    async def delete(self, obj: T) -> None:
        await self.db.delete(obj)
        await self.db.flush()

    async def exists(self, id: int) -> bool:
        obj = await self.get_by_id(id)
        return obj is not None
