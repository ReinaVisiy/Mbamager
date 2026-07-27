"""
Mbamager Dashboard Service

This module coordinates AccountService, TransactionService, and BudgetService
to calculate overall dashboard metrics for a user.
"""

import asyncio
from datetime import date

from app.schemas.budget import BudgetResponse
from app.schemas.dashboard import DashboardSummary
from app.schemas.savings_goal import SavingsGoalResponse
from app.schemas.recurring_transaction import RecurringTransactionResponse
from app.schemas.notification import NotificationResponse
from app.services.account_service import AccountService
from app.services.transaction_service import TransactionService
from app.services.budget_service import BudgetService
from app.services.savings_goal_service import SavingsGoalService
from app.services.recurring_transaction_service import RecurringTransactionService
from app.services.notification_service import NotificationService

class DashboardService:
    """
    Service coordinating AccountService, TransactionService, and BudgetService
    to aggregate dashboard calculations for a user.
    """

    def __init__(
        self,
        account_service: AccountService,
        transaction_service: TransactionService,
        budget_service: BudgetService,
        savings_goal_service: SavingsGoalService | None = None,
        recurring_service: RecurringTransactionService | None = None,
        notification_service: NotificationService | None = None,
    ) -> None:
        """
        Initialize the DashboardService with required sub-services.
        """
        self.account_service = account_service
        self.transaction_service = transaction_service
        self.budget_service = budget_service
        self.savings_goal_service = savings_goal_service
        self.recurring_service = recurring_service
        self.notification_service = notification_service

    async def get_dashboard_summary(
        self,
        user_id: int,
        start_date: date,
        end_date: date,
    ) -> DashboardSummary:
        """
        Aggregate and return dashboard metrics for the user, optimized via concurrent execution.
        """
        # Execute basic core financial metric queries concurrently
        core_queries = asyncio.gather(
            self.transaction_service.calculate_user_net_worth(user_id),
            self.transaction_service.calculate_total_income(user_id, start_date, end_date),
            self.transaction_service.calculate_total_expenses(user_id, start_date, end_date),
            self.account_service.get_by_user_id(user_id),
            self.budget_service.get_active_budgets(user_id, end_date)
        )

        # Execute optional module queries concurrently
        goals_query = self.savings_goal_service.get_user_goals(user_id) if self.savings_goal_service else None
        recurring_query = self.recurring_service.get_user_recurring(user_id) if self.recurring_service else None
        notifications_query = self.notification_service.get_unread_by_user_id(user_id) if self.notification_service else None

        optional_queries = asyncio.gather(
            goals_query if goals_query else asyncio.sleep(0, result=[]),
            recurring_query if recurring_query else asyncio.sleep(0, result=[]),
            notifications_query if notifications_query else asyncio.sleep(0, result=[])
        )

        # Gather both core and optional query sets
        core_results, optional_results = await asyncio.gather(core_queries, optional_queries)

        total_net_worth, total_income, total_expenses, accounts, active_budgets = core_results
        goals, recurrings, notifications = optional_results

        # Parallelize account balance updates to eliminate sequential query blocking
        balance_results = await asyncio.gather(*[
            self.transaction_service.calculate_account_balance(account.id) for account in accounts
        ])
        account_balances = {acc.id: bal for acc, bal in zip(accounts, balance_results)}

        # Parallelize budget progress updates
        budget_progress = list(await asyncio.gather(*[
            self.budget_service.calculate_budget_progress(budget.id) for budget in active_budgets
        ]))

        # Format mappings
        savings_goals_list = [SavingsGoalResponse.model_validate(g) for g in goals]
        upcoming_payments_list = [RecurringTransactionResponse.model_validate(r) for r in recurrings]
        unread_notifications_list = [NotificationResponse.model_validate(n) for n in notifications]

        return DashboardSummary(
            total_net_worth=total_net_worth,
            total_income=total_income,
            total_expenses=total_expenses,
            account_balances=account_balances,
            active_budgets=[BudgetResponse.model_validate(b) for b in active_budgets],
            budget_progress=budget_progress,
            savings_goals=savings_goals_list,
            upcoming_payments=upcoming_payments_list,
            unread_notifications=unread_notifications_list,
        )


