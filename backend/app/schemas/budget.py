"""
Mbamager Budget Pydantic Schemas

This module defines Pydantic schemas for the Budget model.
Enforces validation rules on spending bounds, including positive Decimal limit amounts,
reusing the TransactionCategory enum, and enforcing end_date >= start_date.
"""

from datetime import date
from decimal import Decimal
from typing import Self

from pydantic import Field, model_validator

from app.models.transaction import TransactionCategory
from app.schemas.common import BaseSchema, TimestampSchema

class BudgetBase(BaseSchema):
    """
    Shared attributes for category spending limits over defined intervals.
    """
    category: TransactionCategory = Field(
        ...,
        description="Categorization tag referencing the shared transaction category taxonomy used throughout Mbamager"
    )
    limit_amount: Decimal = Field(
        ...,
        gt=Decimal("0"),
        description="Positive spending limit threshold representing the maximum permitted spending for the selected category during the budget period"
    )
    start_date: date = Field(..., description="Starting date of the budget interval")
    end_date: date = Field(..., description="Ending date of the budget interval")

    @model_validator(mode="after")
    def validate_dates(self) -> Self:
        """
        Validates that the ending date is chronologically on or after the starting date.
        """
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("end_date must be greater than or equal to start_date")
        return self

class BudgetCreate(BudgetBase):
    """
    Payload required to register a category budget limit. user_id is
    intentionally not part of this payload — it's derived from the
    authenticated user in the route, matching SavingsGoalCreate and
    RecurringTransactionCreate.
    """
    pass

class BudgetUpdate(BaseSchema):
    """
    Payload for updating an existing category budget limit. All fields are optional.
    """
    category: TransactionCategory | None = Field(
        default=None,
        description="Categorization tag referencing the shared transaction category taxonomy used throughout Mbamager"
    )
    limit_amount: Decimal | None = Field(
        default=None,
        gt=Decimal("0"),
        description="Positive spending limit threshold representing the maximum permitted spending for the selected category during the budget period"
    )
    start_date: date | None = Field(default=None, description="Starting date of the budget interval")
    end_date: date | None = Field(default=None, description="Ending date of the budget interval")

    @model_validator(mode="after")
    def validate_dates(self) -> Self:
        """
        Validates that if both start_date and end_date are modified, end_date >= start_date.
        """
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("end_date must be greater than or equal to start_date")
        return self

class BudgetResponse(BudgetBase, TimestampSchema):
    """
    Public schema representing a persisted budget returned by the API.
    """
    id: int = Field(..., description="Unique auto-incrementing budget identifier")
    user_id: int = Field(..., description="Unique user identifier associated with this budget")
