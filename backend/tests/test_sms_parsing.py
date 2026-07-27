"""
Tests for SMSService.parse_sms — the Stage 1 (regex) half of the two-stage
SMS parsing pipeline (Frozen Engineering Rule #3: regex first, Gemini only
falls back when regex confidence is zero).

parse_sms() reads no repository/service state, so these are pure unit
tests with no database fixture required.
"""

from datetime import datetime, timezone
from decimal import Decimal

from app.models.account import AccountProvider
from app.models.transaction import TransactionDirection
from app.services.sms_service import SMSService

RECEIVED_AT = datetime(2026, 7, 1, 12, 0, tzinfo=timezone.utc)


def make_service() -> SMSService:
    # parse_sms is a pure function of its arguments — it never touches
    # self.repository / self.transaction_service / self.account_service —
    # so it's safe to construct the service with no real dependencies.
    return SMSService(repository=None, transaction_service=None, account_service=None)


def test_mtn_debit_parses_amount_fee_and_reference():
    service = make_service()
    text = "You have transferred 5000 XAF fee: 50 ref: ABC123 to 677000000"
    result = service.parse_sms(text, sender="MTN", received_at=RECEIVED_AT)

    assert result is not None
    assert result["amount"] == Decimal("5000")
    assert result["fee"] == Decimal("50")
    assert result["direction"] == TransactionDirection.DEBIT
    assert result["provider"] == AccountProvider.MTN_MOMO


def test_mtn_credit_parses_correctly():
    service = make_service()
    text = "You have received 12000.50 XAF fee: 0 ref: XYZ999 from 677111111"
    result = service.parse_sms(text, sender="MTN", received_at=RECEIVED_AT)

    assert result is not None
    assert result["amount"] == Decimal("12000.50")
    assert result["direction"] == TransactionDirection.CREDIT
    assert result["provider"] == AccountProvider.MTN_MOMO


def test_orange_debit_parses_correctly():
    service = make_service()
    text = "You have paid 3000 XAF fee: 25 ref: OR555 to merchant"
    result = service.parse_sms(text, sender="ORANGE", received_at=RECEIVED_AT)

    assert result is not None
    assert result["amount"] == Decimal("3000")
    assert result["direction"] == TransactionDirection.DEBIT
    assert result["provider"] == AccountProvider.ORANGE_MONEY


def test_orange_credit_parses_correctly():
    service = make_service()
    text = "You have received 8000 XAF fee: 0 ref: OR777"
    result = service.parse_sms(text, sender="ORANGE", received_at=RECEIVED_AT)

    assert result is not None
    assert result["direction"] == TransactionDirection.CREDIT
    assert result["provider"] == AccountProvider.ORANGE_MONEY


def test_cash_deposit_parses_as_credit():
    service = make_service()
    text = "Cash Deposit of 25000 XAF fee: 0 ref: DEP001"
    result = service.parse_sms(text, sender="BANKAPP", received_at=RECEIVED_AT)

    assert result is not None
    assert result["direction"] == TransactionDirection.CREDIT
    assert result["provider"] == AccountProvider.CASH
    assert result["amount"] == Decimal("25000")


def test_cash_withdrawal_parses_as_debit():
    service = make_service()
    text = "Cash Withdrawal of 15000 XAF fee: 200 ref: WD002"
    result = service.parse_sms(text, sender="BANKAPP", received_at=RECEIVED_AT)

    assert result is not None
    assert result["direction"] == TransactionDirection.DEBIT
    assert result["provider"] == AccountProvider.CASH
    assert result["fee"] == Decimal("200")


def test_bank_credit_parses_correctly():
    service = make_service()
    text = "Bank Credit of 100000 XAF fee: 0 ref: BNK001"
    result = service.parse_sms(text, sender="BANK", received_at=RECEIVED_AT)

    assert result is not None
    assert result["direction"] == TransactionDirection.CREDIT
    assert result["provider"] == AccountProvider.BANK


def test_bank_debit_parses_correctly():
    service = make_service()
    text = "Bank Debit of 45000 XAF fee: 500 ref: BNK002"
    result = service.parse_sms(text, sender="BANK", received_at=RECEIVED_AT)

    assert result is not None
    assert result["direction"] == TransactionDirection.DEBIT
    assert result["provider"] == AccountProvider.BANK


def test_amount_is_always_decimal_never_float():
    """
    Frozen Engineering Rule #2: float is banned for money. Guards against a
    future regression where someone "simplifies" parse_sms with float(...).
    """
    service = make_service()
    text = "You have transferred 999.99 XAF fee: 1.01 ref: DEC001 to 677000000"
    result = service.parse_sms(text, sender="MTN", received_at=RECEIVED_AT)

    assert result is not None
    assert isinstance(result["amount"], Decimal)
    assert isinstance(result["fee"], Decimal)
    assert result["amount"] == Decimal("999.99")


def test_unrecognized_message_returns_none_for_gemini_fallback():
    """
    Rule #3: regex is Stage 1 and MUST return None (not raise, not guess) on
    anything it doesn't recognize, so the caller knows to fall back to Gemini.
    """
    service = make_service()
    text = "Hey, are we still meeting for lunch tomorrow?"
    result = service.parse_sms(text, sender="+237600000000", received_at=RECEIVED_AT)

    assert result is None


def test_provider_keyword_without_matching_pattern_still_returns_none():
    """
    Sender/body mentions a known provider but the message shape doesn't match
    any known template (e.g. a promotional MTN SMS) — must still fail closed.
    """
    service = make_service()
    text = "MTN: Enjoy 20% cashback this week on all your MoMo transactions!"
    result = service.parse_sms(text, sender="MTN", received_at=RECEIVED_AT)

    assert result is None
