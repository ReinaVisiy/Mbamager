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


def test_mtn_detected_from_realistic_sender_id_without_literal_mtn_keyword():
    """
    Regression test: real MTN MoMo Cameroon SMS come from a sender ID of
    "MobileMoney" (or a numeric shortcode) and frequently never contain the
    literal word "MTN" anywhere in the sender or body. The original
    detection (`"MTN" in sender_upper or "MTN" in text_upper`) silently
    failed on every such message.
    """
    service = make_service()
    text = (
        "You have transferred 5000 XAF to 677123456. Fee: 50 XAF. "
        "New balance: 12450 XAF. Financial Transaction Id: 812736451."
    )
    result = service.parse_sms(text, sender="MobileMoney", received_at=RECEIVED_AT)

    assert result is not None
    assert result["provider"] == AccountProvider.MTN_MOMO
    assert result["amount"] == Decimal("5000")


def test_orange_message_not_misclassified_as_mtn_via_mobilemoney_heuristic():
    """
    The "MobileMoney" sender heuristic must not fire when the message is
    actually an Orange transaction (Orange mentioned anywhere wins).
    """
    service = make_service()
    text = "Orange Money: you have sent 3000 XAF fee: 30 ref: OR123 to 655000000"
    result = service.parse_sms(text, sender="MobileMoney", received_at=RECEIVED_AT)

    assert result is not None
    assert result["provider"] == AccountProvider.ORANGE_MONEY


def test_comma_formatted_amount_parses_correctly_not_silently_truncated():
    """
    Regression test for a silent ledger-corruption bug: real SMS format
    amounts with thousands-separator commas (e.g. "5,000 XAF"). The original
    regex used a bare \\d+, which can't cross a comma — it would backtrack
    and match just the "000" fragment as if it were the whole amount,
    silently creating a transaction with amount=0 instead of failing.
    """
    service = make_service()
    text = (
        "You have transferred 5,000 XAF to 677123456. Fee: 50 XAF. "
        "New balance: 12,450 XAF. Financial Transaction Id: 812736451."
    )
    result = service.parse_sms(text, sender="MobileMoney", received_at=RECEIVED_AT)

    assert result is not None
    assert result["amount"] == Decimal("5000")  # NOT Decimal("0")
    assert result["fee"] == Decimal("50")


def test_comma_formatted_credit_amount_parses_correctly():
    service = make_service()
    text = "Cash Deposit of 1,250,000 XAF fee: 0 ref: DEP999"
    result = service.parse_sms(text, sender="BANKAPP", received_at=RECEIVED_AT)

    assert result is not None
    assert result["amount"] == Decimal("1250000")


def test_real_orange_cashin_success_template_parses():
    """
    Regression test using an actual Orange Money Cameroon confirmation SMS
    that failed to parse in production. This is a completely different
    template from the "sent/received X fee: Y ref: Z" ones above - labeled
    fields ("transaction amount:", "charges:", "transaction id:") instead of
    inline phrasing, no "sent"/"received" trigger keyword at all, and a
    dotted reference ID that a bare \\w+ can't match.
    """
    service = make_service()
    text = (
        "CashIn Success by 695721562 JEANNETTE to 688882492 WIRBA. The details are as follows: "
        "transaction amount: 4000 FCFA, transaction id: CI260721.1748.A80666, charges: 0 FCFA, "
        "commission: 0 FCFA, net credit amount : 4000 FCFA, new balance: 17837.9 FCFA."
    )
    result = service.parse_sms(text, sender="OrangeMoney", received_at=RECEIVED_AT)

    assert result is not None
    assert result["amount"] == Decimal("4000")
    assert result["fee"] == Decimal("0")
    assert result["ref"] == "CI260721.1748.A80666"
    assert result["direction"] == TransactionDirection.CREDIT
    assert result["provider"] == AccountProvider.ORANGE_MONEY


def test_cashout_success_template_is_debit_and_sums_charges_plus_commission():
    service = make_service()
    text = (
        "CashOut Success by 695721562 JEANNETTE to 688882492 WIRBA. The details are as follows: "
        "transaction amount: 10,000 FCFA, transaction id: CO260721.1748.B99777, charges: 150 FCFA, "
        "commission: 25 FCFA, net debit amount : 10150 FCFA, new balance: 7837.9 FCFA."
    )
    result = service.parse_sms(text, sender="OrangeMoney", received_at=RECEIVED_AT)

    assert result is not None
    assert result["amount"] == Decimal("10000")
    assert result["fee"] == Decimal("175")  # charges (150) + commission (25)
    assert result["direction"] == TransactionDirection.DEBIT


def test_cashin_success_template_routes_provider_from_sender_not_body():
    """The message body doesn't name a provider at all - provider must come
    from the sender field, and the same body text should route differently
    depending on which sender it arrived from."""
    service = make_service()
    text = (
        "CashIn Success by 695721562 JEANNETTE to 688882492 WIRBA. "
        "transaction amount: 4000 FCFA, transaction id: CI999, charges: 0 FCFA."
    )
    orange_result = service.parse_sms(text, sender="OrangeMoney", received_at=RECEIVED_AT)
    mtn_result = service.parse_sms(text, sender="MTN_MoMo", received_at=RECEIVED_AT)

    assert orange_result["provider"] == AccountProvider.ORANGE_MONEY
    assert mtn_result["provider"] == AccountProvider.MTN_MOMO


def test_real_successful_transfer_template_parses_as_debit_with_decimal_fee():
    """
    Regression test using an actual Orange Money P2P transfer confirmation
    SMS. Distinct from the CashIn/CashOut templates: "Transaction ID:" comes
    before the amount here, and Charges can be a decimal (12.1 FCFA) rather
    than a whole number.
    """
    service = make_service()
    text = (
        "Successful transfer from 688882492 WIRBA to 692304978 ASSONFACK. "
        "Transaction ID: PP260715.1129.A71039, Transaction amount: 4054 FCFA, "
        "Charges: 12.1 FCFA, Commission: 0 FCFA, Net debit amount: 4066.1 FCFA, "
        "New balance: 18037.9 FCFA."
    )
    result = service.parse_sms(text, sender="OrangeMoney", received_at=RECEIVED_AT)

    assert result is not None
    assert result["amount"] == Decimal("4054")
    assert result["fee"] == Decimal("12.1")
    assert result["ref"] == "PP260715.1129.A71039"
    assert result["direction"] == TransactionDirection.DEBIT


def test_real_cashout_success_alt_fields_template_parses():
    """
    Regression test using a real CashOut confirmation with a different field
    vocabulary (Amount:/Fees:/Transaction ID:) than the other CashOut
    template, and no space before "FCFA" in one figure (13160FCFA).
    """
    service = make_service()
    text = (
        "CashOut success by 656142339 with the Code : 221300. Detailed information : "
        "Amount: 13000 FCFA, Fees: 160 FCFA, Transaction ID: CO260722.1229.B60008, "
        "Net amount debited 13160FCFA, New balance: 3277.9 FCFA."
    )
    result = service.parse_sms(text, sender="OrangeMoney", received_at=RECEIVED_AT)

    assert result is not None
    assert result["amount"] == Decimal("13000")
    assert result["fee"] == Decimal("160")
    assert result["ref"] == "CO260722.1229.B60008"
    assert result["direction"] == TransactionDirection.DEBIT


def test_real_data_bundle_purchase_template_parses_with_zero_fee():
    """
    Regression test using a real airtime/data bundle purchase confirmation.
    No separate fee is quoted in this template. Also verifies the reference
    doesn't swallow the sentence-ending period after it.
    """
    service = make_service()
    text = (
        "Congratulations, you have just made a payment of 1400 FCFA for 1400U = "
        "1.59Go/7D + 2.32Go/7D. Transaction number: MP260721.2012.A18755. "
        "New balance: 16437.9 FCFA. More service at #150#"
    )
    result = service.parse_sms(text, sender="OrangeMoney", received_at=RECEIVED_AT)

    assert result is not None
    assert result["amount"] == Decimal("1400")
    assert result["fee"] == Decimal("0")
    assert result["ref"] == "MP260721.2012.A18755"  # NOT "MP260721.2012.A18755."
    assert result["direction"] == TransactionDirection.DEBIT
