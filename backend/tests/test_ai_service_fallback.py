"""
Tests for AIService's deterministic fallback logic — the rule-based paths
that run whenever Gemini is unavailable (no API key in this test
environment). Per Frozen Engineering Law 1, the AI layer never owns money;
these fallbacks are the guaranteed floor of behavior when the AI layer
can't reach the model at all, so they must stay correct and crash-free.
"""

from decimal import Decimal

from app.services.ai_service import AIService


def _service() -> AIService:
    return AIService()


def test_categorize_transaction_falls_back_without_api_key():
    service = _service()
    result = service.categorize_transaction(
        amount=Decimal("5000.00"),
        direction="DEBIT",
        fee=Decimal("50.00"),
        narrative="Taxi to work",
    )
    assert result["fallback"] is True
    assert result["category"] == "EXPENSE_TRANSPORT"
    assert result["confidence"] == 0.50


def test_categorize_transaction_fallback_defaults_credit_to_salary():
    service = _service()
    result = service.categorize_transaction(
        amount=Decimal("150000.00"),
        direction="CREDIT",
        fee=Decimal("0.00"),
        narrative="Monthly payment received",
    )
    assert result["category"] == "INCOME_SALARY"


def test_categorize_transaction_fallback_defaults_debit_to_food():
    service = _service()
    result = service.categorize_transaction(
        amount=Decimal("2000.00"),
        direction="DEBIT",
        fee=Decimal("0.00"),
        narrative="Unlabelled payment",
    )
    assert result["category"] == "EXPENSE_FOOD"


def test_detect_anomaly_flags_disproportionate_fee():
    """
    Fee > 10% of amount must be flagged, exactly at the boundary logic the
    fallback implements — this guards a real MoMo/Orange Money fraud pattern
    (inflated fees) even when Gemini is unreachable.
    """
    service = _service()
    result = service.detect_anomaly(
        amount=Decimal("1000.00"),
        direction="DEBIT",
        category="EXPENSE_FOOD",
        fee=Decimal("150.00"),  # 15% of amount
        narrative="Market purchase",
    )
    assert result["fallback"] is True
    assert result["is_anomaly"] is True
    assert result["anomaly_score"] == 0.80


def test_detect_anomaly_flags_unusually_high_amount():
    service = _service()
    result = service.detect_anomaly(
        amount=Decimal("600000.00"),
        direction="DEBIT",
        category="EXPENSE_FOOD",
        fee=Decimal("0.00"),
        narrative="Large purchase",
    )
    assert result["is_anomaly"] is True


def test_detect_anomaly_does_not_flag_typical_transaction():
    service = _service()
    result = service.detect_anomaly(
        amount=Decimal("5000.00"),
        direction="DEBIT",
        category="EXPENSE_FOOD",
        fee=Decimal("50.00"),  # 1% of amount
        narrative="Groceries",
    )
    assert result["is_anomaly"] is False
    assert result["anomaly_score"] == 0.10


def test_budget_coaching_fallback_reports_exceeded_tier_without_altering_numbers():
    """
    The AI layer must only narrate the numbers it's handed — never
    recompute or override them. Confirm the fallback message reflects the
    inputs verbatim rather than deriving new ones.
    """
    service = _service()
    result = service.generate_budget_coaching(
        category="EXPENSE_FOOD",
        limit_amount=Decimal("100000.00"),
        spent_amount=Decimal("120000.00"),
        remaining_amount=Decimal("0.00"),
        percentage_used=Decimal("120.00"),
        risk_level="EXCEEDED",
    )
    assert result["fallback"] is True
    assert "100000.00" in result["message"]
    assert "120.00" in result["message"]
    assert len(result["tips"]) == 3


def test_budget_coaching_fallback_reports_safe_tier():
    service = _service()
    result = service.generate_budget_coaching(
        category="EXPENSE_TRANSPORT",
        limit_amount=Decimal("50000.00"),
        spent_amount=Decimal("10000.00"),
        remaining_amount=Decimal("40000.00"),
        percentage_used=Decimal("20.00"),
        risk_level="SAFE",
    )
    assert result["fallback"] is True
    assert "40000.00" in result["message"]
