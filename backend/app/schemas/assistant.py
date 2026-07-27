"""
Mbamager Financial Assistant (GUIDE) Schemas

This module defines Pydantic schemas for the GUIDE conversational financial
assistant endpoint. The endpoint is advisory only — it reasons about the
user's real, already-computed transactions and budgets, and never modifies
any data itself (Engineering Law 1).
"""

from pydantic import Field

from app.schemas.common import BaseSchema


class ChatMessage(BaseSchema):
    """
    A single turn in the conversation, as displayed in the chat UI.
    """
    sender: str = Field(..., description="Either 'user' or 'assistant'")
    content: str = Field(..., min_length=1, max_length=4000, description="The message text")


class AssistantChatRequest(BaseSchema):
    """
    Schema for submitting a new chat message to GUIDE.
    """
    message: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="The user's new chat message",
    )
    conversation_history: list[ChatMessage] = Field(
        default_factory=list,
        description="Prior turns in this conversation, oldest first, for context (last ~10 recommended)",
    )


class AssistantChatResponse(BaseSchema):
    """
    Schema for a GUIDE conversational reply.
    """
    reply: str = Field(..., description="The assistant's conversational answer")
    suggested_follow_ups: list[str] = Field(
        default_factory=list,
        description="Up to 3 short follow-up questions the user might ask next",
    )
