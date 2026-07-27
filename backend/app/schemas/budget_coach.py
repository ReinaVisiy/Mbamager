"""
Mbamager Budget Coach (COMPASS) Schemas

This module defines the Pydantic response schema for the COMPASS budget
coaching endpoint. The endpoint takes no request body — it reads an existing
budget owned by the authenticated user — so only a response schema is needed.
"""

from decimal import Decimal

from pydantic import Field

from app.models.transaction import TransactionCategory
from app.schemas.common import BaseSchema


class BudgetCoachResponse(BaseSchema):
    """
    Schema for a COMPASS budget coaching result: deterministic progress
    metrics (computed by BudgetService) plus AI-authored, encouraging
    guidance. Advisory only — never modifies the budget or ledger.
    """
    budget_id: int = Field(..., description="Unique identifier of the budget")
    category: TransactionCategory = Field(..., description="Spending category tag")
    limit_amount: Decimal = Field(..., description="Positive budget limit amount")
    spent_amount: Decimal = Field(..., description="Total amount spent in the budget interval")
    remaining_amount: Decimal = Field(..., description="Remaining limit amount")
    percentage_used: Decimal = Field(..., description="Percentage of the budget used")
    risk_level: str = Field(..., description="Deterministic risk tier: SAFE, WARNING, or EXCEEDED")
    message: str = Field(..., description="Short, encouraging coaching message from COMPASS")
    tips: list[str] = Field(default_factory=list, description="Up to 3 concrete, actionable tips")
    encouragement: str = Field(..., description="One short, warm closing sentence")
