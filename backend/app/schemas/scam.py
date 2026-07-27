"""
Mbamager Scam Sentinel Schemas

This module defines Pydantic schemas for the SENTINEL scam/fraud analysis endpoint.
"""

from pydantic import Field

from app.schemas.common import BaseSchema

class ScamAnalysisRequest(BaseSchema):
    """
    Schema for submitting a message for scam risk analysis.
    """
    text: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="The raw SMS, chat message, or link text to analyze",
    )
    sender: str | None = Field(
        default=None,
        max_length=64,
        description="The sender identifier or phone number, if known",
    )

class ScamAnalysisResponse(BaseSchema):
    """
    Schema for returning a scam risk assessment. Advisory only — never acts on
    the user's behalf or modifies any data.
    """
    is_suspicious: bool = Field(..., description="Whether the message shows any scam indicators")
    risk_level: str = Field(..., description="Overall risk level: LOW, MEDIUM, or HIGH")
    risk_score: float = Field(..., ge=0, le=1, description="Risk score between 0 and 1")
    reasons: list[str] = Field(default_factory=list, description="Specific reasons behind the assessment")
    recommended_action: str = Field(..., description="A short, practical recommendation for the user")
