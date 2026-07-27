"""
Tests for BudgetService.classify_risk_level — a deterministic, pure function
kept in the service layer specifically so the AI layer only ever narrates a
risk level someone else already decided (Frozen Engineering Rule #1: AI
never owns money, never owns the calculation either).
"""

from decimal import Decimal

from app.services.budget_service import BudgetService


def test_zero_percent_is_safe():
    assert BudgetService.classify_risk_level(Decimal("0.00")) == "SAFE"


def test_just_under_warning_threshold_is_safe():
    assert BudgetService.classify_risk_level(Decimal("79.99")) == "SAFE"


def test_warning_threshold_boundary_is_warning():
    assert BudgetService.classify_risk_level(Decimal("80.00")) == "WARNING"


def test_just_under_exceeded_threshold_is_warning():
    assert BudgetService.classify_risk_level(Decimal("100.00")) == "WARNING"


def test_just_over_100_percent_is_exceeded():
    assert BudgetService.classify_risk_level(Decimal("100.01")) == "EXCEEDED"


def test_far_over_budget_is_exceeded():
    assert BudgetService.classify_risk_level(Decimal("250.00")) == "EXCEEDED"
