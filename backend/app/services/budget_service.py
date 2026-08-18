"""
Budget business logic: CRUD plus the deterministic spend-progress calculation
that BudgetCoach (AI) narrates but never computes (AI Never Owns Money).
"""

from datetime import date
from decimal import Decimal

from app.models.budget import Budget
from app.models.transaction import TransactionCategory
from app.repositories import BudgetRepository, TransactionRepository
from app.schemas.budget import BudgetCreate, BudgetUpdate
from app.schemas.dashboard import BudgetProgressResponse
from app.services.base_service import BaseService

BudgetProgress = BudgetProgressResponse

class BudgetService(BaseService[Budget]):
    def __init__(
        self,
        repository: BudgetRepository,
        transaction_repository: TransactionRepository,
    ) -> None:
        super().__init__(repository)
        self.transaction_repository = transaction_repository

    async def get_by_user_id(self, user_id: int) -> list[Budget]:
        return await self.repository.get_by_user_id(user_id)

    async def get_by_category(
        self, user_id: int, category: TransactionCategory
    ) -> Budget | None:
        return await self.repository.get_by_category(user_id, category)

    async def get_active_budgets(self, user_id: int, current_date: date) -> list[Budget]:
        return await self.repository.get_active_budgets(user_id, current_date)

    async def get_user_budget(
        self,
        user_id: int,
        budget_id: int,
    ) -> Budget:
        budget = await self.repository.get_by_id(budget_id)
        if not budget or budget.user_id != user_id:
            raise ValueError("Budget not found")
        return budget

    async def create_budget(
        self,
        user_id: int,
        budget_data: BudgetCreate,
    ) -> Budget:
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
        budget = await self.get_user_budget(user_id, budget_id)
        await self.repository.delete(budget)

    async def calculate_budget_progress(self, budget_id: int) -> BudgetProgress:
        budget = await self.repository.get_by_id(budget_id)
        if not budget:
            raise ValueError("Budget not found")

        transactions = await self.transaction_repository.get_debits_for_budget_period(
            user_id=budget.user_id,
            category=budget.category,
            start_date=budget.start_date,
            end_date=budget.end_date,
        )

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
        # Keep risk classification deterministic here; the AI coaching layer
        # only explains a level this method already decided, never picks it.
        if percentage_used > Decimal("100.00"):
            return "EXCEEDED"
        if percentage_used >= Decimal("80.00"):
            return "WARNING"
        return "SAFE"
