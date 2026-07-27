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
        """
        Initialize the base repository with a database session and target model class.
        """
        self.db = db
        self.model = model

    async def create(self, obj: T) -> T:
        """
        Persist a new model instance in the database.

        Refreshes after flush so server-generated columns (e.g. timestamps
        with onupdate=func.now()) are actually materialized on the object.
        Without this, SQLAlchemy leaves those attributes expired after
        flush, and accessing them later during response serialization
        triggers an implicit lazy load that isn't safe outside of an
        async-aware context (raises MissingGreenlet).
        """
        self.db.add(obj)
        await self.db.flush()
        await self.db.refresh(obj)
        return obj

    async def get_by_id(self, id: int) -> T | None:
        """
        Retrieve a single model instance by its unique integer identifier.
        """
        return await self.db.get(self.model, id)

    async def get_all(self) -> list[T]:
        """
        Retrieve all instances of the target model from the database.
        """
        stmt = select(self.model)
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def update(self, obj: T) -> T:
        """
        Update an existing model instance and flush the session.

        Refreshes after flush for the same reason as create() — onupdate
        columns are left expired otherwise and crash on later access.
        """
        self.db.add(obj)
        await self.db.flush()
        await self.db.refresh(obj)
        return obj

    async def delete(self, obj: T) -> None:
        """
        Remove a model instance from the database and flush the session.
        """
        await self.db.delete(obj)
        await self.db.flush()

    async def exists(self, id: int) -> bool:
        """
        Check if a model instance exists with the given integer identifier.
        """
        obj = await self.get_by_id(id)
        return obj is not None
