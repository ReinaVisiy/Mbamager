"""
Mbamager Account Routes

This module defines FastAPI route handlers for creating, retrieving, updating, and deleting
financial accounts (Mobile Money, Bank, Cash, Other). It delegates all business logic,
including ownership verification and model mutation, to AccountService.
"""

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencies.auth import get_account_service, get_current_user
from app.models.account import Account
from app.models.user import User
from app.schemas.account import AccountCreate, AccountUpdate, AccountResponse
from app.services import AccountService

router = APIRouter(prefix="/accounts", tags=["Accounts"])

@router.get("/", response_model=list[AccountResponse])
async def get_accounts(
    current_user: User = Depends(get_current_user),
    account_service: AccountService = Depends(get_account_service),
) -> list[Account]:
    """
    Retrieve all accounts belonging to the authenticated user.
    """
    return await account_service.get_by_user_id(current_user.id)

@router.get("/active", response_model=list[AccountResponse])
async def get_active_accounts(
    current_user: User = Depends(get_current_user),
    account_service: AccountService = Depends(get_account_service),
) -> list[Account]:
    """
    Retrieve only active accounts belonging to the authenticated user.
    """
    return await account_service.get_active_accounts(current_user.id)

@router.get("/{account_id}", response_model=AccountResponse)
async def get_account(
    account_id: int,
    current_user: User = Depends(get_current_user),
    account_service: AccountService = Depends(get_account_service),
) -> Account:
    """
    Retrieve a specific account by ID.
    """
    try:
        return await account_service.get_user_account(current_user.id, account_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )

@router.post("/", response_model=AccountResponse, status_code=status.HTTP_201_CREATED)
async def create_account(
    account_in: AccountCreate,
    current_user: User = Depends(get_current_user),
    account_service: AccountService = Depends(get_account_service),
) -> Account:
    """
    Create a new financial account for the authenticated user.
    """
    try:
        return await account_service.create_account(current_user.id, account_in)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

@router.put("/{account_id}", response_model=AccountResponse)
async def update_account(
    account_id: int,
    account_in: AccountUpdate,
    current_user: User = Depends(get_current_user),
    account_service: AccountService = Depends(get_account_service),
) -> Account:
    """
    Update an existing account.
    """
    try:
        return await account_service.update_account(current_user.id, account_id, account_in)
    except ValueError as e:
        if str(e) == "Account not found":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(e),
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    account_id: int,
    current_user: User = Depends(get_current_user),
    account_service: AccountService = Depends(get_account_service),
) -> None:
    """
    Delete an existing account.
    """
    try:
        await account_service.delete_account(current_user.id, account_id)
    except ValueError as e:
        if str(e) == "Account not found":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=str(e),
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
