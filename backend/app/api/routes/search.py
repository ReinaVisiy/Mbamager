"""
Mbamager Global Search Router

This module defines the single server-side search endpoint used by the
frontend's global search dialog (Ctrl+K), replacing the previous
client-side-only approach of downloading entire collections and filtering
them in the browser.
"""

from fastapi import APIRouter, Depends, Query

from app.api.dependencies.auth import get_current_user, get_search_service
from app.models.user import User
from app.schemas.search import SearchResponse
from app.services.search_service import SearchService

router = APIRouter(prefix="/search", tags=["Search"])


@router.get("", response_model=SearchResponse)
async def global_search(
    q: str = Query(..., min_length=1, max_length=128, description="Search text"),
    current_user: User = Depends(get_current_user),
    search_service: SearchService = Depends(get_search_service),
) -> SearchResponse:
    """
    Search across the authenticated user's accounts, transactions, savings
    goals, recurring transactions, notifications, and tontine groups in a
    single request. Each entity type is filtered and limited at the
    database level, so results stay fast regardless of how much data the
    user has accumulated.
    """
    results = await search_service.search(current_user.id, q)
    return SearchResponse(query=q, results=results)
