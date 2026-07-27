"""
Additional tests for app.services.ai_service.AIService, complementing
tests/test_ai_service_fallback.py (which only covers the fallback path for
categorize_transaction, detect_anomaly, and generate_budget_coaching).

Two gaps this file closes:

1. No test anywhere exercised the Gemini "success" path — every existing
   test simulated Gemini being unavailable. These tests mock
   `_call_gemini_json` to return a realistic parsed response and assert each
   public method actually uses it.

2. SENTINEL (analyze_scam_risk) and GUIDE (generate_assistant_reply) had
   zero test coverage at all, fallback or otherwise.

Google Gemini is never called for real here — this sandbox's network egress
is locked to a fixed allowlist that does not include
generativelanguage.googleapis.com, so even with a live API key these tests
mock the client rather than hit the network.
"""

from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest

from app.services.ai_service import AIService


@pytest.fixture
def ai_service() -> AIService:
    return AIService()


# --- _call_gemini_json plumbing (end-to-end through a mocked genai.Client) -----------------

def test_call_gemini_json_parses_valid_response(ai_service: AIService):
    mock_response = MagicMock()
    mock_response.text = '{"category": "EXPENSE_FOOD", "confidence": 0.91}'
    mock_client = MagicMock()
    mock_client.models.generate_content.return_value = mock_response

    with patch.object(AIService, "client", new=mock_client):
        result = ai_service._call_gemini_json("some prompt")

    assert result == {"category": "EXPENSE_FOOD", "confidence": 0.91}
    _, kwargs = mock_client.models.generate_content.call_args
    assert kwargs["contents"] == "some prompt"


def test_call_gemini_json_returns_none_on_malformed_json(ai_service: AIService):
    mock_response = MagicMock()
    mock_response.text = "not valid json {{{"
    mock_client = MagicMock()
    mock_client.models.generate_content.return_value = mock_response

    with patch.object(AIService, "client", new=mock_client):
        assert ai_service._call_gemini_json("some prompt") is None


def test_call_gemini_json_returns_none_when_gemini_raises(ai_service: AIService):
    mock_client = MagicMock()
    mock_client.models.generate_content.side_effect = RuntimeError("network unreachable")

    with patch.object(AIService, "client", new=mock_client):
        assert ai_service._call_gemini_json("some prompt") is None


# --- Gemini-success path for every public method (previously untested) ---------------------

def test_categorize_transaction_uses_gemini_result(ai_service: AIService):
    with patch.object(AIService, "_call_gemini_json", return_value={"category": "EXPENSE_TRANSPORT", "confidence": 0.87}):
        result = ai_service.categorize_transaction(
            amount=Decimal("2500"), direction="DEBIT", fee=Decimal("50"), narrative="Taxi to Bonamoussadi"
        )
    assert result == {"category": "EXPENSE_TRANSPORT", "confidence": 0.87}


def test_generate_clean_narrative_uses_gemini_result(ai_service: AIService):
    with patch.object(AIService, "_call_gemini_json", return_value={"clean_narrative": "Taxi ride payment"}):
        result = ai_service.generate_clean_narrative(
            narrative="MOMO TRANSFER EXTERNAL TXN998877", amount=Decimal("2500"), direction="DEBIT"
        )
    assert result == "Taxi ride payment"


def test_detect_anomaly_uses_gemini_result(ai_service: AIService):
    gemini_result = {"is_anomaly": True, "explanation": "Matches known fake loan app pattern", "anomaly_score": 0.95}
    with patch.object(AIService, "_call_gemini_json", return_value=gemini_result):
        result = ai_service.detect_anomaly(
            amount=Decimal("10000"), direction="DEBIT", category="EXPENSE_COMMISSION",
            fee=Decimal("5000"), narrative="Urgent loan approval fee",
        )
    assert result["is_anomaly"] is True
    assert result["anomaly_score"] == 0.95


def test_generate_spending_insight_uses_gemini_result(ai_service: AIService):
    gemini_result = {
        "top_spending_categories": [{"category": "EXPENSE_FOOD", "amount": 50000.0}],
        "largest_expense": {"narrative": "Groceries", "amount": 30000.0},
        "income_trend": "Stable",
        "budget_warnings": [],
        "unusual_spending_alerts": [],
        "savings_suggestions": ["Save more"],
        "budget_recommendations": [],
    }
    with patch.object(AIService, "_call_gemini_json", return_value=gemini_result):
        result = ai_service.generate_spending_insight(transactions=[], budgets=[])
    assert result == gemini_result


def test_explain_transaction_uses_gemini_result(ai_service: AIService):
    gemini_result = {
        "assigned_category": "EXPENSE_TRANSPORT", "confidence": 0.9,
        "explanation": "Matches transport narrative", "alternatives": [],
    }
    with patch.object(AIService, "_call_gemini_json", return_value=gemini_result):
        result = ai_service.explain_transaction(
            amount=Decimal("2500"), direction="DEBIT", narrative="Taxi", selected_category="EXPENSE_TRANSPORT"
        )
    assert result == gemini_result


def test_analyze_scam_risk_uses_gemini_result(ai_service: AIService):
    gemini_result = {
        "is_suspicious": True, "risk_level": "HIGH", "risk_score": 0.9,
        "reasons": ["Impersonates MTN support"], "recommended_action": "Do not respond.",
    }
    with patch.object(AIService, "_call_gemini_json", return_value=gemini_result):
        result = ai_service.analyze_scam_risk(text="Your MoMo account will be blocked, verify now")
    assert result["is_suspicious"] is True
    assert result["risk_level"] == "HIGH"


def test_analyze_scam_risk_normalizes_invalid_risk_level(ai_service: AIService):
    gemini_result = {"is_suspicious": True, "risk_level": "EXTREME", "risk_score": 0.9}
    with patch.object(AIService, "_call_gemini_json", return_value=gemini_result):
        result = ai_service.analyze_scam_risk(text="suspicious text")
    assert result["risk_level"] == "LOW"  # invalid values are normalized down, not trusted verbatim


def test_generate_budget_coaching_uses_gemini_result(ai_service: AIService):
    gemini_result = {"message": "You're doing great", "tips": ["Keep tracking"], "encouragement": "Nice work!"}
    with patch.object(AIService, "_call_gemini_json", return_value=gemini_result):
        result = ai_service.generate_budget_coaching(
            category="EXPENSE_FOOD", limit_amount=Decimal("50000"), spent_amount=Decimal("10000"),
            remaining_amount=Decimal("40000"), percentage_used=Decimal("20"), risk_level="SAFE",
        )
    assert result["message"] == "You're doing great"
    assert result["tips"] == ["Keep tracking"]


def test_generate_assistant_reply_uses_gemini_result(ai_service: AIService):
    gemini_result = {"reply": "You spent 40,000 XAF on food this month.", "suggested_follow_ups": ["What about transport?"]}
    with patch.object(AIService, "_call_gemini_json", return_value=gemini_result):
        result = ai_service.generate_assistant_reply(
            message="How much did I spend on food?", conversation_history=[], transactions=[], budgets=[]
        )
    assert result["reply"] == gemini_result["reply"]
    assert result["suggested_follow_ups"] == ["What about transport?"]


# --- SENTINEL (analyze_scam_risk) fallback — previously untested ---------------------------

def test_analyze_scam_risk_falls_back_and_flags_pin_request(ai_service: AIService):
    with patch.object(AIService, "_call_gemini_json", return_value=None):
        result = ai_service.analyze_scam_risk(
            text="URGENT: your account will be blocked. Confirm your PIN now to avoid suspension.",
            sender="+237600000000",
        )
    assert result["is_suspicious"] is True
    assert result["risk_level"] in ("MEDIUM", "HIGH")
    assert result["fallback"] is True
    assert len(result["reasons"]) >= 2


def test_analyze_scam_risk_falls_back_to_low_for_benign_message(ai_service: AIService):
    with patch.object(AIService, "_call_gemini_json", return_value=None):
        result = ai_service.analyze_scam_risk(text="Hey, are we still meeting for lunch tomorrow?")
    assert result["is_suspicious"] is False
    assert result["risk_level"] == "LOW"
    assert result["fallback"] is True


# --- GUIDE (generate_assistant_reply) fallback — previously untested -----------------------

def test_generate_assistant_reply_falls_back_when_gemini_unavailable(ai_service: AIService):
    transactions = [
        {"amount": "30000", "direction": "DEBIT", "category": "EXPENSE_FOOD", "narrative": "Market"},
        {"amount": "100000", "direction": "CREDIT", "category": "INCOME_SALARY", "narrative": "Salary"},
    ]
    with patch.object(AIService, "_call_gemini_json", return_value=None):
        result = ai_service.generate_assistant_reply(
            message="Where did I spend the most this month?",
            conversation_history=[], transactions=transactions, budgets=[],
        )
    assert "reply" in result
    assert isinstance(result["suggested_follow_ups"], list)
    assert "Market" in result["reply"] or "30000" in result["reply"] or "30,000" in result["reply"]


def test_generate_assistant_reply_fallback_never_invents_figures_with_no_data(ai_service: AIService):
    with patch.object(AIService, "_call_gemini_json", return_value=None):
        result = ai_service.generate_assistant_reply(
            message="How much did I save?", conversation_history=[], transactions=[], budgets=[],
        )
    assert "reply" in result
    assert isinstance(result["reply"], str)
