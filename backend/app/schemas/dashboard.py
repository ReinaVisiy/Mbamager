"""
Mbamager Dashboard Pydantic Schemas

This module defines response schemas for dashboard summaries and financial metrics.
"""

from datetime import date
from decimal import Decimal
from pydantic import Field

from app.models.transaction import TransactionCategory
from app.schemas.common import BaseSchema
from app.schemas.budget import BudgetResponse
from app.schemas.savings_goal import SavingsGoalResponse
from app.schemas.recurring_transaction import RecurringTransactionResponse
from app.schemas.notification import NotificationResponse

class BudgetProgressResponse(BaseSchema):
    """
    Schema for budget spending and usage progress.
    """
    budget_id: int = Field(..., description="Unique identifier of the budget")
    category: TransactionCategory = Field(..., description="Spending category tag")
    limit_amount: Decimal = Field(..., description="Positive budget limit amount")
    spent_amount: Decimal = Field(..., description="Total amount spent in the budget interval")
    remaining_amount: Decimal = Field(..., description="Remaining limit amount")
    percentage_used: Decimal = Field(..., description="Percentage of the budget used")
    start_date: date = Field(..., description="Start of the budget period")
    end_date: date = Field(..., description="End of the budget period")

class DashboardSummary(BaseSchema):
    """
    Comprehensive dashboard metrics summary.
    """
    total_net_worth: Decimal = Field(..., description="Aggregated net worth across all accounts")
    total_income: Decimal = Field(..., description="Total credit transaction volume within specified interval")
    total_expenses: Decimal = Field(..., description="Total debit transaction volume plus fees within specified interval")
    account_balances: dict[int, Decimal] = Field(..., description="Mapping of account ID to active balance")
    active_budgets: list[BudgetResponse] = Field(..., description="List of active budgets")
    budget_progress: list[BudgetProgressResponse] = Field(..., description="Usage and spending metrics for active budgets")
    savings_goals: list[SavingsGoalResponse] = Field(default_factory=list, description="List of the user's savings goals")
    upcoming_payments: list[RecurringTransactionResponse] = Field(default_factory=list, description="List of active recurring payments templates")
    unread_notifications: list[NotificationResponse] = Field(default_factory=list, description="List of unread notifications")


class NetWorthResponse(BaseSchema):
    """
    Simple response containing calculated net worth.
    """
    net_worth: Decimal = Field(..., description="Dynamic aggregated net worth across all active accounts")

class IncomeSummaryResponse(BaseSchema):
    """
    Total income inside a date range.
    """
    total_income: Decimal = Field(..., description="Calculated total incoming credit volume within interval")

class ExpenseSummaryResponse(BaseSchema):
    """
    Total expenses inside a date range.
    """
    total_expenses: Decimal = Field(..., description="Calculated total debit volume including fees within interval")

class AccountBalanceResponse(BaseSchema):
    """
    Balance details for a specific user account.
    """
    account_id: int = Field(..., description="Unique account identifier")
    account_name: str = Field(..., description="User assigned descriptive account name")
    balance: Decimal = Field(..., description="Dynamically computed active balance")

class CategorySpendingResponse(BaseSchema):
    """
    Aggregated expenditure details for a given transaction category.
    """
    category: TransactionCategory = Field(..., description="Categorization tag")
    amount: Decimal = Field(..., description="Aggregated debit expenditure volume including fees")

class TopSpendingCategoryItem(BaseSchema):
    category: str = Field(..., description="The category name")
    amount: Decimal = Field(..., description="Total spent in category")
    percentage: Decimal | None = Field(default=None, description="Optional percentage of total spending")

class LargestExpenseItem(BaseSchema):
    narrative: str = Field(..., description="Description or narrative of the largest expense")
    amount: Decimal = Field(..., description="The amount of the largest expense")

class DashboardInsightsResponse(BaseSchema):
    """
    Response schema for AI-powered dashboard insights and recommendations.
    """
    top_spending_categories: list[TopSpendingCategoryItem] = Field(..., description="Top categories sorted by spending")
    largest_expense: LargestExpenseItem = Field(..., description="Details of the largest recorded expense")
    income_trend: str = Field(..., description="AI description of income trajectory")
    budget_warnings: list[str] = Field(..., description="List of category budget warnings and limit excesses")
    unusual_spending_alerts: list[str] = Field(..., description="Unusual spikes or anomalous payments alerts")
    savings_suggestions: list[str] = Field(..., description="Tailored suggestions on saving opportunities")
    budget_recommendations: list[str] = Field(..., description="Budget recommendations based on recent spending patterns")

