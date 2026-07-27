"""
Mbamager Financial Assistant (GUIDE) Routes

This module defines the FastAPI route handler for the conversational
financial assistant chat. It gathers the authenticated user's real
transactions and budget progress from the ledger, then delegates all
language generation to AIService (GUIDE). Advisory only — per Engineering
Law 1, this endpoint never writes to the ledger.
"""

from datetime import date

from fastapi import APIRouter, Depends

from app.api.dependencies.auth import (
    get_ai_service,
    get_budget_service,
    get_current_user,
    get_transaction_service,
)
from app.core.rate_limiter import limit_ai
from app.models.user import User
from app.schemas.assistant import AssistantChatRequest, AssistantChatResponse
from app.services import AIService, BudgetService, TransactionService

router = APIRouter(prefix="/assistant", tags=["Financial Assistant"])


@router.post("/chat", response_model=AssistantChatResponse, dependencies=[Depends(limit_ai)])
async def chat_with_assistant(
    payload: AssistantChatRequest,
    current_user: User = Depends(get_current_user),
    transaction_service: TransactionService = Depends(get_transaction_service),
    budget_service: BudgetService = Depends(get_budget_service),
    ai_service: AIService = Depends(get_ai_service),
) -> AssistantChatResponse:
    """
    Send a message to GUIDE and get a conversational reply grounded in the
    user's real transaction and budget data. Does not modify any data.
    """
    # 1. Fetch the user's real transactions and active budgets.
    transactions = await transaction_service.get_user_transactions(current_user.id)
    active_budgets = await budget_service.get_active_budgets(current_user.id, date.today())

    # 2. Serialize transactions (most recent first).
    serialized_transactions = [
        {
            "id": tx.id,
            "amount": float(tx.amount),
            "fee": float(tx.fee),
            "direction": tx.direction.value,
            "category": tx.category.value,
            "narrative": tx.narrative or "",
            "timestamp": tx.timestamp.isoformat() if tx.timestamp else "",
        }
        for tx in sorted(transactions, key=lambda t: t.timestamp or date.min, reverse=True)
    ]

    # 3. Serialize budgets with deterministic progress metrics.
    serialized_budgets = []
    for budget in active_budgets:
        progress = await budget_service.calculate_budget_progress(budget.id)
        serialized_budgets.append({
            "id": budget.id,
            "category": budget.category.value,
            "limit_amount": float(progress.limit_amount),
            "spent_amount": float(progress.spent_amount),
            "remaining_amount": float(progress.remaining_amount),
            "percentage_used": float(progress.percentage_used),
        })

    # 4. Serialize conversation history for context.
    serialized_history = [
        {"sender": turn.sender, "content": turn.content}
        for turn in payload.conversation_history
    ]

    # 5. Generate the reply via AIService (GUIDE).
    result = ai_service.generate_assistant_reply(
        message=payload.message,
        conversation_history=serialized_history,
        transactions=serialized_transactions,
        budgets=serialized_budgets,
    )

    return AssistantChatResponse(
        reply=result["reply"],
        suggested_follow_ups=result.get("suggested_follow_ups", []),
    )
