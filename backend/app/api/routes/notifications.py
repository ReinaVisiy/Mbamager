"""
Mbamager Notification Router

This module defines FastAPI endpoints for viewing and dismissing system notifications.
"""

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.dependencies.auth import get_current_user, get_notification_service
from app.models.user import User
from app.schemas.notification import NotificationResponse
from app.schemas.common import SuccessResponse
from app.services.notification_service import NotificationService

router = APIRouter(prefix="/notifications", tags=["Notifications"])

@router.get("", response_model=list[NotificationResponse])
async def list_notifications(
    current_user: User = Depends(get_current_user),
    notification_service: NotificationService = Depends(get_notification_service),
) -> list[NotificationResponse]:
    """
    Retrieve all notifications belonging to the authenticated user.
    """
    return await notification_service.get_by_user_id(current_user.id)

@router.get("/unread", response_model=list[NotificationResponse])
async def list_unread_notifications(
    current_user: User = Depends(get_current_user),
    notification_service: NotificationService = Depends(get_notification_service),
) -> list[NotificationResponse]:
    """
    Retrieve only unread notifications belonging to the authenticated user.
    """
    return await notification_service.get_unread_by_user_id(current_user.id)

@router.put("/read-all", response_model=SuccessResponse)
async def mark_all_as_read(
    current_user: User = Depends(get_current_user),
    notification_service: NotificationService = Depends(get_notification_service),
) -> SuccessResponse:
    """
    Mark all unread notifications of the authenticated user as read.
    """
    await notification_service.mark_all_as_read(current_user.id)
    return SuccessResponse(message="All notifications marked as read")

@router.put("/{notification_id}/read", response_model=NotificationResponse)
async def mark_notification_as_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    notification_service: NotificationService = Depends(get_notification_service),
) -> NotificationResponse:
    """
    Mark a specific notification as read.
    """
    try:
        return await notification_service.mark_as_read(current_user.id, notification_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )

@router.delete("/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_notification(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    notification_service: NotificationService = Depends(get_notification_service),
) -> None:
    """
    Delete a specific notification.
    """
    try:
        await notification_service.delete_notification(current_user.id, notification_id)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e),
        )
