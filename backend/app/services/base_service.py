"""
Mbamager Reusable Base Service

This module provides reusable business-layer functionality built on top of repositories.
"""

from typing import Generic, TypeVar

from app.repositories import BaseRepository

T = TypeVar("T")

class BaseService(Generic[T]):
    """
    Generic base service providing a standard foundation for business-layer operations.
    """

    def __init__(self, repository: BaseRepository[T]) -> None:
        self.repository = repository

    async def create(self, obj: T) -> T:
        return await self.repository.create(obj)

    async def get_by_id(self, id: int) -> T | None:
        return await self.repository.get_by_id(id)

    async def get_all(self) -> list[T]:
        return await self.repository.get_all()

    async def update(self, obj: T) -> T:
        return await self.repository.update(obj)

    async def delete(self, obj: T) -> None:
        await self.repository.delete(obj)

    async def exists(self, id: int) -> bool:
        return await self.repository.exists(id)
