"""
Mbamager Global Search Schemas

This module defines Pydantic schemas for the server-side global search
endpoint that replaces fetching entire collections to the client and
filtering in the browser.
"""

from typing import Literal, Optional
from pydantic import Field

from app.schemas.common import BaseSchema

SearchResultType = Literal["account", "transaction", "goal", "recurring", "notification", "tontine"]


class SearchResultItem(BaseSchema):
    id: str = Field(..., description="Stable client-side key, e.g. 'acc-12'")
    type: SearchResultType
    title: str
    subtitle: str
    meta: Optional[str] = None
    url: str


class SearchResponse(BaseSchema):
    query: str
    results: list[SearchResultItem]
