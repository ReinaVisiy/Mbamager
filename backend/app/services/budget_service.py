"""
Mbamager Budget Service

This module contains Budget-related business logic and repository coordination.
"""

from datetime import date
from decimal import Decimal

from app.models.budget import Budget
from app.models.transaction import TransactionCategory
from app.repositories import BudgetRepository, TransactionRepository
from app.schemas.budget import BudgetCreate, BudgetUpdate
from app.schemas.common import BaseSchema
from app.schemas.dashboard import BudgetProgressResponse
from app.services.base_service import BaseService

BudgetProgress = BudgetProgressResponse

class BudgetService(BaseService[Budget]):
    """
    Service handling Budget-related business logic and repository coordination.
    """

    def __init__(
        self,
        repository: BudgetRepository,
        transaction_repository: TransactionRepository | None = None,
    ) -> None:
        """
        Initialize the BudgetService with a BudgetRepository and optional TransactionRepository.
        """
        super().__init__(repository)
        self.transaction_repository = transaction_repository

    async def get_by_user_id(self, user_id: int) -> list[Budget]:
        """
        Retrieve all budgets belonging to a user.
        """
        return await self.repository.get_by_user_id(user_id)

    async def get_by_category(
        self, user_id: int, category: TransactionCategory
    ) -> Budget | None:
        """
        Retrieve the budget for a specific category belonging to a user.
        """
        return await self.repository.get_by_category(user_id, category)

    async def get_active_budgets(self, user_id: int, current_date: date) -> list[Budget]:
        """
        Retrieve every budget whose date range includes the supplied date.
        """
        return await self.repository.get_active_budgets(user_id, current_date)

    async def get_user_budget(
        self,
        user_id: int,
        budget_id: int,
    ) -> Budget:
        """
        Retrieve the budget by ID.
        Verify it exists and belongs to the supplied user.
        Raise ValueError("Budget not found") if either check fails.
        """
        budget = await self.repository.get_by_id(budget_id)
        if not budget or budget.user_id != user_id:
            raise ValueError("Budget not found")
        return budget

    async def create_budget(
        self,
        user_id: int,
        budget_data: BudgetCreate,
    ) -> Budget:
        """
        Construct the Budget model.
        Set user_id from the authenticated user.
        Copy every field from BudgetCreate.
        Persist using the repository.
        """
        budget = Budget(
            user_id=user_id,
            category=budget_data.category,
            limit_amount=budget_data.limit_amount,
            start_date=budget_data.start_date,
            end_date=budget_data.end_date,
        )
        return await self.repository.create(budget)

    async def update_budget(
        self,
        user_id: int,
        budget_id: int,
        budget_data: BudgetUpdate,
    ) -> Budget:
        """
        Retrieve the user's budget using get_user_budget().
        Update only fields supplied by BudgetUpdate.
        Persist using the repository.
        """
        budget = await self.get_user_budget(user_id, budget_id)

        update_dict = budget_data.model_dump(exclude_unset=True)
        for key, value in update_dict.items():
            setattr(budget, key, value)

        return await self.repository.update(budget)

    async def delete_budget(
        self,
        user_id: int,
        budget_id: int,
    ) -> None:
        """
        Retrieve the user's budget using get_user_budget().
        Delete it through the repository.
        """
        budget = await self.get_user_budget(user_id, budget_id)
        await self.repository.delete(budget)

    async def calculate_budget_progress(self, budget_id: int) -> BudgetProgress:
        """
        Retrieve budget, matching transactions, and calculate spending progress.
        """
        budget = await self.repository.get_by_id(budget_id)
        if not budget:
            raise ValueError("Budget not found")

        # Query all matching DEBIT transactions for same user, same category, within dates
        from sqlalchemy import select
        from app.models.account import Account
        from app.models.transaction import Transaction, TransactionDirection

        stmt = (
            select(Transaction)
            .join(Account, Transaction.account_id == Account.id)
            .where(
                Account.user_id == budget.user_id,
                Transaction.category == budget.category,
                Transaction.direction == TransactionDirection.DEBIT,
                Transaction.timestamp >= budget.start_date,
                Transaction.timestamp <= budget.end_date
            )
        )
        result = await self.repository.db.execute(stmt)
        transactions = result.scalars().all()

        spent_amount = sum((tx.amount + tx.fee) for tx in transactions) if transactions else Decimal("0.00")
        remaining_amount = budget.limit_amount - spent_amount
        if budget.limit_amount > Decimal("0.00"):
            percentage_used = (spent_amount / budget.limit_amount) * Decimal("100.00")
        else:
            percentage_used = Decimal("0.00")

        return BudgetProgress(
            budget_id=budget.id,
            category=budget.category,
            limit_amount=budget.limit_amount,
            spent_amount=spent_amount,
            remaining_amount=remaining_amount,
            percentage_used=percentage_used,
            start_date=budget.start_date,
            end_date=budget.end_date,
        )

    @staticmethod
    def classify_risk_level(percentage_used: Decimal) -> str:
        """
        Deterministically classify budget risk from percentage_used.
        SAFE: under 80% used. WARNING: 80-100% used. EXCEEDED: over 100% used.
        Kept in the service layer (not the AI layer) per Engineering Law 1 —
        the AI layer only ever narrates a risk level already decided here.
        """
        if percentage_used > Decimal("100.00"):
            return "EXCEEDED"
        if percentage_used >= Decimal("80.00"):
            return "WARNING"
        return "SAFE"
