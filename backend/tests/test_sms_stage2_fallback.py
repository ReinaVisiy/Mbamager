"""
Tests for the Stage 2 (M-PARSE) Gemini fallback: SMSService.extract_transaction()
falling back to AIService.extract_sms_transaction() when the deterministic
regex parser (Stage 1) fails, plus AIService.extract_sms_transaction() itself.

Before this, there was no Stage 2 at all — any message the regex parser
didn't recognize just failed outright with "could not be parsed". Google
Gemini is never called for real here (see test_ai_service_gemini_success.py
for why); everything is mocked.
"""

from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import patch

import pytest

from app.models.account import AccountProvider
from app.models.sms_message import SMSMessage
from app.models.transaction import TransactionDirection
from app.services.ai_service import AIService
from app.services.sms_service import SMSService

RECEIVED_AT = datetime(2026, 7, 1, 12, 0, tzinfo=timezone.utc)


def make_sms(body: str, sender: str = "MobileMoney") -> SMSMessage:
    return SMSMessage(
        id=1, user_id=1, sender=sender, message_body=body, received_at=RECEIVED_AT, processed=False
    )


# --- AIService.extract_sms_transaction ------------------------------------------------------

def test_extract_sms_transaction_uses_gemini_result():
    ai_service = AIService()
    gemini_result = {
        "is_transaction": True, "amount": 5000, "fee": 50, "direction": "DEBIT",
        "provider": "MTN_MOMO", "reference": "TXN123", "confidence": 0.85,
    }
    with patch.object(AIService, "_call_gemini_json", return_value=gemini_result):
        result = ai_service.extract_sms_transaction("some unusual SMS text", sender="MobileMoney")

    assert result["amount"] == Decimal("5000")
    assert result["fee"] == Decimal("50")
    assert result["direction"] == "DEBIT"
    assert result["provider"] == "MTN_MOMO"
    assert result["ref"] == "TXN123"


def test_extract_sms_transaction_returns_none_when_not_a_transaction():
    ai_service = AIService()
    gemini_result = {"is_transaction": False}
    with patch.object(AIService, "_call_gemini_json", return_value=gemini_result):
        result = ai_service.extract_sms_transaction("Enjoy 20% cashback this week!", sender="MTN")

    assert result is None


def test_extract_sms_transaction_returns_none_when_gemini_unavailable():
    """
    No rule-based fallback here by design — Stage 2 is itself the fallback.
    If Gemini can't help, this must return None (clean failure for manual
    review), never fabricate a transaction from unstructured text.
    """
    ai_service = AIService()
    with patch.object(AIService, "_call_gemini_json", return_value=None):
        result = ai_service.extract_sms_transaction("some ambiguous text", sender="Unknown")

    assert result is None


def test_extract_sms_transaction_rejects_missing_required_fields():
    ai_service = AIService()
    gemini_result = {"is_transaction": True, "amount": 5000, "direction": "DEBIT", "reference": None}
    with patch.object(AIService, "_call_gemini_json", return_value=gemini_result):
        result = ai_service.extract_sms_transaction("text", sender="MTN")

    assert result is None


def test_extract_sms_transaction_rejects_zero_or_negative_amount():
    ai_service = AIService()
    gemini_result = {
        "is_transaction": True, "amount": 0, "fee": 0, "direction": "DEBIT",
        "provider": "MTN_MOMO", "reference": "TXN123",
    }
    with patch.object(AIService, "_call_gemini_json", return_value=gemini_result):
        result = ai_service.extract_sms_transaction("text", sender="MTN")

    assert result is None


def test_extract_sms_transaction_defaults_unknown_provider_to_other():
    ai_service = AIService()
    gemini_result = {
        "is_transaction": True, "amount": 1000, "fee": 0, "direction": "CREDIT",
        "provider": "SOME_NEW_BANK", "reference": "TXN1",
    }
    with patch.object(AIService, "_call_gemini_json", return_value=gemini_result):
        result = ai_service.extract_sms_transaction("text", sender="Bank")

    assert result["provider"] == "OTHER"


# --- SMSService.extract_transaction wiring (Stage 1 -> Stage 2) -----------------------------

def test_extract_transaction_uses_stage1_regex_when_it_matches():
    """Stage 1 succeeding must short-circuit — Stage 2 (Gemini) never gets called."""
    service = SMSService(repository=None, transaction_service=None, account_service=None, ai_service=None)
    sms = make_sms("You have transferred 5000 XAF fee: 50 ref: ABC123 to 677000000", sender="MTN")

    result = service.extract_transaction(sms)

    assert result is not None
    assert result["amount"] == Decimal("5000")
    assert "ai_extracted" not in result


def test_extract_transaction_falls_back_to_stage2_when_stage1_fails():
    ai_service = AIService()
    service = SMSService(
        repository=None, transaction_service=None, account_service=None, ai_service=ai_service
    )
    # Unusual French phrasing Stage 1's regex doesn't recognize.
    sms = make_sms("Vous avez envoye 3000 XAF a 655112233. Frais: 30 XAF. Reference: OM4471122.")

    gemini_result = {
        "is_transaction": True, "amount": 3000, "fee": 30, "direction": "DEBIT",
        "provider": "ORANGE_MONEY", "reference": "OM4471122", "confidence": 0.8,
    }
    with patch.object(AIService, "_call_gemini_json", return_value=gemini_result):
        result = service.extract_transaction(sms)

    assert result is not None
    assert result["amount"] == Decimal("3000")
    assert result["provider"] == AccountProvider.ORANGE_MONEY
    assert result["direction"] == TransactionDirection.DEBIT
    assert result["ai_extracted"] is True


def test_extract_transaction_returns_none_without_ai_service_when_stage1_fails():
    """No AIService configured -> Stage 1 failure is final, no crash."""
    service = SMSService(repository=None, transaction_service=None, account_service=None, ai_service=None)
    sms = make_sms("Hey, are we still meeting for lunch tomorrow?")

    assert service.extract_transaction(sms) is None


def test_extract_transaction_returns_none_when_both_stages_fail():
    ai_service = AIService()
    service = SMSService(
        repository=None, transaction_service=None, account_service=None, ai_service=ai_service
    )
    sms = make_sms("Get 2GB extra data this weekend! Dial *128# now.")

    with patch.object(AIService, "_call_gemini_json", return_value=None):
        result = service.extract_transaction(sms)

    assert result is None
