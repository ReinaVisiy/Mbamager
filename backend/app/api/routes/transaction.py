"""
Mbamager Transaction Routes

This module defines FastAPI route handlers for creating, retrieving, updating, and deleting
transactions. It delegates all business logic, including ownership verification and model mutation,
to TransactionService.
"""

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencies.auth import get_transaction_service, get_current_user, get_ai_service
from app.models.transaction import Transaction, TransactionCategory, TransactionDirection
from app.models.user import User
from app.schemas.transaction import (
    TransactionCreate,
    TransactionUpdate,
    TransactionResponse,
    TransactionExplainResponse,
    TransactionReclassifyResponse,
)
from app.services import TransactionService, AIService

router = APIRouter(prefix="/transactions", tags=["Transactions"])

@router.get("/", response_model=list[TransactionResponse])
async def list_transactions(
    account_id: int | None = None,
    category: TransactionCategory | None = None,
    direction: TransactionDirection | None = None,
    current_user: User = Depends(get_current_user),
    transaction_service: TransactionService = Depends(get_transaction_service),
) -> list[Transaction]:
    """
    List transactions across every account owned by the authenticated user,
    optionally narrowed to one account and/or filtered by category or direction.
    """
    try:
        if account_id is not None:
            transactions = await transaction_service.get_account_transactions(current_user.id, account_id)
        else:
            transactions = await transaction_service.get_user_transactions(current_user.id)
    except ValueError as e:
        if str(e) == "Account not found":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Account not found",
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    if category is not None:
        transactions = [t for t in transactions if t.category == category]
    if direction is not None:
        transactions = [t for t in transactions if t.direction == direction]

    return transactions

@router.post("/", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
async def create_transaction(
    transaction_in: TransactionCreate,
    current_user: User = Depends(get_current_user),
    transaction_service: TransactionService = Depends(get_transaction_service),
) -> Transaction:
    """
    Create a new transaction.
    """
    try:
        return await transaction_service.create_transaction(current_user.id, transaction_in)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

@router.get("/{transaction_id}", response_model=TransactionResponse)
async def get_transaction(
    transaction_id: int,
    current_user: User = Depends(get_current_user),
    transaction_service: TransactionService = Depends(get_transaction_service),
) -> Transaction:
    """
    Get a single transaction by ID.
    """
    try:
        return await transaction_service.get_user_transaction(current_user.id, transaction_id)
    except ValueError as e:
        if str(e) == "Transaction not found":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Transaction not found",
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

@router.put("/{transaction_id}", response_model=TransactionResponse)
async def update_transaction(
    transaction_id: int,
    transaction_in: TransactionUpdate,
    current_user: User = Depends(get_current_user),
    transaction_service: TransactionService = Depends(get_transaction_service),
) -> Transaction:
    """
    Update a transaction by ID.
    """
    try:
        return await transaction_service.update_transaction(current_user.id, transaction_id, transaction_in)
    except ValueError as e:
        if str(e) == "Transaction not found":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Transaction not found",
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transaction(
    transaction_id: int,
    current_user: User = Depends(get_current_user),
    transaction_service: TransactionService = Depends(get_transaction_service),
) -> None:
    """
    Delete a transaction by ID.
    """
    try:
        await transaction_service.delete_transaction(current_user.id, transaction_id)
    except ValueError as e:
        if str(e) == "Transaction not found":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Transaction not found",
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

@router.get("/account/{account_id}", response_model=list[TransactionResponse])
async def get_account_transactions(
    account_id: int,
    current_user: User = Depends(get_current_user),
    transaction_service: TransactionService = Depends(get_transaction_service),
) -> list[Transaction]:
    """
    Get all transactions belonging to a specific account owned by the user.
    """
    try:
        return await transaction_service.get_account_transactions(current_user.id, account_id)
    except ValueError as e:
        if str(e) == "Account not found":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Account not found",
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

@router.get("/{transaction_id}/explain", response_model=TransactionExplainResponse)
async def explain_transaction(
    transaction_id: int,
    current_user: User = Depends(get_current_user),
    transaction_service: TransactionService = Depends(get_transaction_service),
    ai_service: AIService = Depends(get_ai_service),
) -> TransactionExplainResponse:
    """
    Get AI-generated explanation of the transaction's category classification and alternative suggestions.
    """
    try:
        # Verify transaction ownership
        tx = await transaction_service.get_user_transaction(current_user.id, transaction_id)
        
        # Call explain_transaction
        explanation_data = ai_service.explain_transaction(
            amount=tx.amount,
            direction=tx.direction.value,
            narrative=tx.narrative,
            selected_category=tx.category.value,
            confidence=float(tx.ai_confidence) if tx.ai_confidence is not None else None,
        )
        return TransactionExplainResponse.model_validate(explanation_data)
    except ValueError as e:
        if str(e) == "Transaction not found":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Transaction not found",
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

@router.post("/{transaction_id}/reclassify", response_model=TransactionReclassifyResponse)
async def reclassify_transaction(
    transaction_id: int,
    current_user: User = Depends(get_current_user),
    transaction_service: TransactionService = Depends(get_transaction_service),
    ai_service: AIService = Depends(get_ai_service),
) -> TransactionReclassifyResponse:
    """
    Trigger manual AI re-evaluation of the transaction categorization.
    Returns the newly predicted category and confidence without modifying the stored record.
    """
    try:
        # Verify transaction ownership
        tx = await transaction_service.get_user_transaction(current_user.id, transaction_id)
        
        # Call categorize_transaction
        prediction = ai_service.categorize_transaction(
            amount=tx.amount,
            direction=tx.direction.value,
            fee=tx.fee,
            narrative=tx.narrative,
            tx_id_external=tx.tx_id_external,
            timestamp=tx.timestamp.isoformat() if tx.timestamp else None,
        )
        return TransactionReclassifyResponse(
            predicted_category=prediction.get("category", "EXPENSE_FOOD"),
            confidence=prediction.get("confidence", 0.50),
        )
    except ValueError as e:
        if str(e) == "Transaction not found":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Transaction not found",
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

