"""
Mbamager Budget Routes

This module defines FastAPI route handlers for creating, retrieving, updating, and deleting
budgets. It delegates all business logic, including ownership verification and model mutation,
to BudgetService.
"""

from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencies.auth import get_ai_service, get_budget_service, get_current_user
from app.core.rate_limiter import limit_ai
from app.models.budget import Budget
from app.models.user import User
from app.schemas.budget import BudgetCreate, BudgetUpdate, BudgetResponse
from app.schemas.budget_coach import BudgetCoachResponse
from app.services import AIService, BudgetService

router = APIRouter(prefix="/budgets", tags=["Budgets"])

@router.get("/", response_model=list[BudgetResponse])
async def get_budgets(
    current_user: User = Depends(get_current_user),
    budget_service: BudgetService = Depends(get_budget_service),
) -> list[Budget]:
    """
    Retrieve all budgets belonging to the authenticated user.
    """
    return await budget_service.get_by_user_id(current_user.id)

@router.get("/active", response_model=list[BudgetResponse])
async def get_active_budgets(
    current_date: date | None = None,
    current_user: User = Depends(get_current_user),
    budget_service: BudgetService = Depends(get_budget_service),
) -> list[Budget]:
    """
    Retrieve every active budget whose date range includes the supplied date (defaults to today).
    """
    if current_date is None:
        current_date = date.today()
    return await budget_service.get_active_budgets(current_user.id, current_date)

@router.get("/{budget_id}", response_model=BudgetResponse)
async def get_budget(
    budget_id: int,
    current_user: User = Depends(get_current_user),
    budget_service: BudgetService = Depends(get_budget_service),
) -> Budget:
    """
    Retrieve a specific budget by ID.
    """
    try:
        return await budget_service.get_user_budget(current_user.id, budget_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )

@router.get("/{budget_id}/coach", response_model=BudgetCoachResponse, dependencies=[Depends(limit_ai)])
async def get_budget_coaching(
    budget_id: int,
    current_user: User = Depends(get_current_user),
    budget_service: BudgetService = Depends(get_budget_service),
    ai_service: AIService = Depends(get_ai_service),
) -> BudgetCoachResponse:
    """
    Generate COMPASS budget coaching for a specific budget.

    BudgetService computes the deterministic progress metrics and risk tier;
    AIService (COMPASS) only turns those already-decided numbers into a
    friendly, actionable message. Advisory only — never modifies the budget.
    """
    try:
        await budget_service.get_user_budget(current_user.id, budget_id)
        progress = await budget_service.calculate_budget_progress(budget_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )

    risk_level = BudgetService.classify_risk_level(progress.percentage_used)

    coaching = ai_service.generate_budget_coaching(
        category=progress.category.value,
        limit_amount=progress.limit_amount,
        spent_amount=progress.spent_amount,
        remaining_amount=progress.remaining_amount,
        percentage_used=progress.percentage_used,
        risk_level=risk_level,
    )

    return BudgetCoachResponse(
        budget_id=progress.budget_id,
        category=progress.category,
        limit_amount=progress.limit_amount,
        spent_amount=progress.spent_amount,
        remaining_amount=progress.remaining_amount,
        percentage_used=progress.percentage_used,
        risk_level=risk_level,
        message=coaching["message"],
        tips=coaching.get("tips", []),
        encouragement=coaching.get("encouragement", ""),
    )


@router.post("/", response_model=BudgetResponse, status_code=status.HTTP_201_CREATED)
async def create_budget(
    budget_in: BudgetCreate,
    current_user: User = Depends(get_current_user),
    budget_service: BudgetService = Depends(get_budget_service),
) -> Budget:
    """
    Create a new budget.
    """
    try:
        return await budget_service.create_budget(current_user.id, budget_in)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

@router.put("/{budget_id}", response_model=BudgetResponse)
async def update_budget(
    budget_id: int,
    budget_in: BudgetUpdate,
    current_user: User = Depends(get_current_user),
    budget_service: BudgetService = Depends(get_budget_service),
) -> Budget:
    """
    Update an existing budget.
    """
    try:
        return await budget_service.update_budget(current_user.id, budget_id, budget_in)
    except ValueError as e:
        if str(e) == "Budget not found":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(e),
              )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

@router.delete("/{budget_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_budget(
    budget_id: int,
    current_user: User = Depends(get_current_user),
    budget_service: BudgetService = Depends(get_budget_service),
) -> None:
    """
    Delete an existing budget.
    """
    try:
        await budget_service.delete_budget(current_user.id, budget_id)
    except ValueError as e:
        if str(e) == "Budget not found":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(e),
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
