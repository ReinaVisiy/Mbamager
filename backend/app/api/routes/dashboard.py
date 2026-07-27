"""
Mbamager Dashboard Router

This module defines FastAPI route handlers for dashboard and financial calculation endpoints.
All complex calculations are delegated to their respective services.
"""

from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.dependencies.auth import (
    get_account_service,
    get_budget_service,
    get_dashboard_service,
    get_transaction_service,
    get_current_user,
    get_ai_service,
)
from app.models.user import User
from app.schemas.dashboard import (
    DashboardSummary,
    NetWorthResponse,
    IncomeSummaryResponse,
    ExpenseSummaryResponse,
    AccountBalanceResponse,
    CategorySpendingResponse,
    BudgetProgressResponse,
    DashboardInsightsResponse,
)
from app.services.account_service import AccountService
from app.services.budget_service import BudgetService
from app.services.dashboard_service import DashboardService
from app.services.transaction_service import TransactionService
from app.services.ai_service import AIService

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

def get_default_dates(
    start_date: date | None = None,
    end_date: date | None = None,
) -> tuple[date, date]:
    """
    Helper to default date parameters to the first day of the current month until today.
    """
    today = date.today()
    if start_date is None:
        start_date = date(today.year, today.month, 1)
    if end_date is None:
        end_date = today
    return start_date, end_date

@router.get("/summary", response_model=DashboardSummary)
async def get_dashboard_summary(
    start_date: date | None = Query(None, description="Start date of the interval"),
    end_date: date | None = Query(None, description="End date of the interval"),
    current_user: User = Depends(get_current_user),
    dashboard_service: DashboardService = Depends(get_dashboard_service),
) -> DashboardSummary:
    """
    Retrieve comprehensive dashboard metrics summary for the authenticated user.
    Defaults date range to current month.
    """
    s_date, e_date = get_default_dates(start_date, end_date)
    try:
        return await dashboard_service.get_dashboard_summary(current_user.id, s_date, e_date)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

@router.get("/net-worth", response_model=NetWorthResponse)
async def get_net_worth(
    current_user: User = Depends(get_current_user),
    transaction_service: TransactionService = Depends(get_transaction_service),
) -> NetWorthResponse:
    """
    Retrieve total net worth across all accounts belonging to the authenticated user.
    """
    try:
        net_worth = await transaction_service.calculate_user_net_worth(current_user.id)
        return NetWorthResponse(net_worth=net_worth)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

@router.get("/account-balances", response_model=list[AccountBalanceResponse])
async def get_account_balances(
    current_user: User = Depends(get_current_user),
    account_service: AccountService = Depends(get_account_service),
    transaction_service: TransactionService = Depends(get_transaction_service),
) -> list[AccountBalanceResponse]:
    """
    Retrieve a list of accounts and their dynamically calculated balances.
    """
    try:
        accounts = await account_service.get_by_user_id(current_user.id)
        balances = []
        for account in accounts:
            balance = await transaction_service.calculate_account_balance(account.id)
            balances.append(
                AccountBalanceResponse(
                    account_id=account.id,
                    account_name=account.name,
                    balance=balance,
                )
            )
        return balances
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

@router.get("/income", response_model=IncomeSummaryResponse)
async def get_income_summary(
    start_date: date | None = Query(None, description="Start date of the interval"),
    end_date: date | None = Query(None, description="End date of the interval"),
    current_user: User = Depends(get_current_user),
    transaction_service: TransactionService = Depends(get_transaction_service),
) -> IncomeSummaryResponse:
    """
    Retrieve total credit volume inside a date range.
    Defaults to current month.
    """
    s_date, e_date = get_default_dates(start_date, end_date)
    try:
        total_income = await transaction_service.calculate_total_income(current_user.id, s_date, e_date)
        return IncomeSummaryResponse(total_income=total_income)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

@router.get("/expenses", response_model=ExpenseSummaryResponse)
async def get_expense_summary(
    start_date: date | None = Query(None, description="Start date of the interval"),
    end_date: date | None = Query(None, description="End date of the interval"),
    current_user: User = Depends(get_current_user),
    transaction_service: TransactionService = Depends(get_transaction_service),
) -> ExpenseSummaryResponse:
    """
    Retrieve total debit volume inside a date range.
    Defaults to current month.
    """
    s_date, e_date = get_default_dates(start_date, end_date)
    try:
        total_expenses = await transaction_service.calculate_total_expenses(current_user.id, s_date, e_date)
        return ExpenseSummaryResponse(total_expenses=total_expenses)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

@router.get("/spending-by-category", response_model=list[CategorySpendingResponse])
async def get_spending_by_category(
    start_date: date | None = Query(None, description="Start date of the interval"),
    end_date: date | None = Query(None, description="End date of the interval"),
    current_user: User = Depends(get_current_user),
    transaction_service: TransactionService = Depends(get_transaction_service),
) -> list[CategorySpendingResponse]:
    """
    Retrieve user spending grouped by category within a date range, sorted descending by spending.
    Defaults to current month.
    """
    s_date, e_date = get_default_dates(start_date, end_date)
    try:
        spending_map = await transaction_service.calculate_spending_by_category(current_user.id, s_date, e_date)
        results = [
            CategorySpendingResponse(category=cat, amount=amt)
            for cat, amt in spending_map.items()
        ]
        results.sort(key=lambda x: x.amount, reverse=True)
        return results
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

@router.get("/budgets", response_model=list[BudgetProgressResponse])
async def get_dashboard_budgets(
    current_user: User = Depends(get_current_user),
    budget_service: BudgetService = Depends(get_budget_service),
) -> list[BudgetProgressResponse]:
    """
    Retrieve progress metrics for all active budgets belonging to the user.
    """
    try:
        active_budgets = await budget_service.get_active_budgets(current_user.id, date.today())
        progress_list = []
        for budget in active_budgets:
            progress = await budget_service.calculate_budget_progress(budget.id)
            progress_list.append(progress)
        return progress_list
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

@router.get("/insights", response_model=DashboardInsightsResponse)
async def get_dashboard_insights(
    current_user: User = Depends(get_current_user),
    transaction_service: TransactionService = Depends(get_transaction_service),
    budget_service: BudgetService = Depends(get_budget_service),
    ai_service: AIService = Depends(get_ai_service),
) -> DashboardInsightsResponse:
    """
    Retrieve AI-powered dashboard insights and budget recommendations for the authenticated user.
    """
    try:
        # 1. Fetch transactions
        transactions = await transaction_service.get_user_transactions(current_user.id)
        # 2. Fetch active budgets
        active_budgets = await budget_service.get_active_budgets(current_user.id, date.today())

        # 3. Serialize transactions
        serialized_transactions = []
        for tx in transactions:
            serialized_transactions.append({
                "id": tx.id,
                "amount": float(tx.amount),
                "fee": float(tx.fee),
                "direction": tx.direction.value,
                "category": tx.category.value,
                "narrative": tx.narrative or "",
                "timestamp": tx.timestamp.isoformat() if tx.timestamp else ""
            })

        # 4. Serialize budgets
        serialized_budgets = []
        for budget in active_budgets:
            progress = await budget_service.calculate_budget_progress(budget.id)
            serialized_budgets.append({
                "id": budget.id,
                "category": budget.category.value,
                "amount_limit": float(progress.limit_amount),
                "amount_spent": float(progress.spent_amount),
                "remaining_amount": float(progress.remaining_amount),
                "percentage_used": float(progress.percentage_used)
            })

        # 5. Generate insights via AIService
        insights_data = ai_service.generate_spending_insight(
            transactions=serialized_transactions,
            budgets=serialized_budgets
        )
        return DashboardInsightsResponse.model_validate(insights_data)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
