"""
Mbamager Scam Sentinel Routes

This module defines the FastAPI route handler for on-demand scam/fraud risk
analysis of arbitrary SMS, chat messages, or links (SENTINEL). Advisory only —
per Engineering Law 1, the AI layer never acts on the user's behalf.
"""

from fastapi import APIRouter, Depends

from app.api.dependencies.auth import get_ai_service, get_current_user
from app.core.rate_limiter import limit_ai
from app.models.user import User
from app.schemas.scam import ScamAnalysisRequest, ScamAnalysisResponse
from app.services import AIService

router = APIRouter(prefix="/scam", tags=["Scam Sentinel"])

@router.post("/analyze", response_model=ScamAnalysisResponse, dependencies=[Depends(limit_ai)])
async def analyze_message(
    payload: ScamAnalysisRequest,
    current_user: User = Depends(get_current_user),
    ai_service: AIService = Depends(get_ai_service),
) -> ScamAnalysisResponse:
    """
    Analyze a message, SMS, or link for common Mobile Money scam patterns and
    return a risk assessment. Does not store the message or modify any data.
    """
    result = ai_service.analyze_scam_risk(text=payload.text, sender=payload.sender)
    return ScamAnalysisResponse.model_validate(result)
