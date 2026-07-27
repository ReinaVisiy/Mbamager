"""
Mbamager SMS Service

This module implements the automatic SMS message import pipeline and parsing engine.
It uses deterministic regex rules to identify transacting parameters,
prevents duplicates, and triggers corresponding transaction creations.
"""

import re
from datetime import datetime
from decimal import Decimal
from typing import Optional

from app.models.sms_message import SMSMessage
from app.models.transaction import TransactionDirection, TransactionCategory
from app.models.account import AccountProvider
from app.repositories import SMSMessageRepository
from app.schemas.sms import SMSImportRequest
from app.schemas.transaction import TransactionCreate
from app.services.ai_service import AIService
from app.services.base_service import BaseService
from app.services.transaction_service import TransactionService
from app.services.account_service import AccountService

class SMSService(BaseService[SMSMessage]):
    """
    Service coordinating SMS storage, message parsing, duplicate detection,
    and automatic integration with the Transaction pipeline.
    """

    def __init__(
        self,
        repository: SMSMessageRepository,
        transaction_service: TransactionService,
        account_service: AccountService,
        ai_service: Optional[AIService] = None,
    ) -> None:
        """
        Initialize the SMSService with required repositories and sub-services.
        ai_service powers the Stage 2 (M-PARSE) fallback used when the
        deterministic regex parser below fails to match a message; it is
        optional so this service still works (Stage 1 only) without it.
        """
        super().__init__(repository)
        self.transaction_service = transaction_service
        self.account_service = account_service
        self.ai_service = ai_service

    # Shared numeric pattern: matches "5000", "5,000", or "5,000.50" and is
    # captured as a single group so callers can strip commas before
    # Decimal() conversion. A bare \d+ here would silently truncate
    # comma-formatted amounts (e.g. "5,000" would match just "000" as if it
    # were the whole amount) instead of failing loudly - that's a silent
    # ledger-corruption bug, worse than a clean parse failure.
    _NUM = r"(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?"

    @staticmethod
    def _to_decimal(raw: str) -> Decimal:
        """Strip thousands-separator commas before converting to Decimal."""
        return Decimal(raw.replace(",", ""))

    def parse_sms(self, text: str, sender: str, received_at: datetime) -> dict | None:
        """
        Deterministic regex-based parsing engine.
        Recognizes MTN Mobile Money, Orange Money, Cash Deposit, Cash Withdrawal,
        Bank Credit, and Bank Debit messages.
        Returns extracted transaction data dictionary or None if parsing fails.
        """
        clean_text = text.strip()
        sender_upper = sender.upper()
        text_upper = clean_text.upper()
        sender_compact = sender_upper.replace(" ", "").replace("-", "")

        # Flags for provider classification.
        #
        # Real MTN MoMo Cameroon confirmation SMS come from a sender ID of
        # "MobileMoney" (or a numeric shortcode) and frequently never contain
        # the literal substring "MTN" anywhere in the sender or body - so
        # matching on "MTN" alone missed most real messages. "MobileMoney" as
        # a sender is only ambiguous if Orange is also mentioned, hence the
        # is_orange exclusion below.
        is_orange = "ORANGE" in sender_upper or "ORANGE" in text_upper
        is_mtn = (
            "MTN" in sender_upper
            or "MTN" in text_upper
            or "MOBILEMONEY" in sender_compact
        ) and not is_orange

        # 1. MTN Mobile Money Debit
        if is_mtn and any(kw in text_upper for kw in ("TRANSFER", "SENT", "TRANSFERRED", "PAY", "PAID")):
            m = re.search(
                rf"(?i)(?:transfer|sent|transferred|pay|paid).*?(?P<amount>{self._NUM})\s*(?:XAF|FCFA).*?fee:\s*(?P<fee>{self._NUM}).*?(?:ref|reference|txid|id):\s*(?P<ref>\w+)",
                clean_text
            )
            if m:
                return {
                    "amount": self._to_decimal(m.group("amount")),
                    "fee": self._to_decimal(m.group("fee")),
                    "ref": m.group("ref"),
                    "direction": TransactionDirection.DEBIT,
                    "provider": AccountProvider.MTN_MOMO,
                    "category": TransactionCategory.EXPENSE_UTILITIES,
                    "narrative": f"MTN MoMo Debit - Ref: {m.group('ref')}",
                    "date": received_at,
                }

        # 2. MTN Mobile Money Credit
        if is_mtn and any(kw in text_upper for kw in ("RECEIVED", "DEPOSIT", "CREDITED")):
            m = re.search(
                rf"(?i)(?:received|deposit|credited).*?(?P<amount>{self._NUM})\s*(?:XAF|FCFA).*?fee:\s*(?P<fee>{self._NUM}).*?(?:ref|reference|txid|id):\s*(?P<ref>\w+)",
                clean_text
            )
            if m:
                return {
                    "amount": self._to_decimal(m.group("amount")),
                    "fee": self._to_decimal(m.group("fee")),
                    "ref": m.group("ref"),
                    "direction": TransactionDirection.CREDIT,
                    "provider": AccountProvider.MTN_MOMO,
                    "category": TransactionCategory.INCOME_REMITTANCE,
                    "narrative": f"MTN MoMo Credit - Ref: {m.group('ref')}",
                    "date": received_at,
                }

        # 3. Orange Money Debit
        if is_orange and any(kw in text_upper for kw in ("TRANSFER", "SENT", "TRANSFERRED", "PAY", "PAID")):
            m = re.search(
                rf"(?i)(?:transfer|sent|transferred|pay|paid).*?(?P<amount>{self._NUM})\s*(?:XAF|FCFA).*?fee:\s*(?P<fee>{self._NUM}).*?(?:ref|reference|txid|id):\s*(?P<ref>\w+)",
                clean_text
            )
            if m:
                return {
                    "amount": self._to_decimal(m.group("amount")),
                    "fee": self._to_decimal(m.group("fee")),
                    "ref": m.group("ref"),
                    "direction": TransactionDirection.DEBIT,
                    "provider": AccountProvider.ORANGE_MONEY,
                    "category": TransactionCategory.EXPENSE_UTILITIES,
                    "narrative": f"Orange Money Debit - Ref: {m.group('ref')}",
                    "date": received_at,
                }

        # 4. Orange Money Credit
        if is_orange and any(kw in text_upper for kw in ("RECEIVED", "DEPOSIT", "CREDITED")):
            m = re.search(
                rf"(?i)(?:received|deposit|credited).*?(?P<amount>{self._NUM})\s*(?:XAF|FCFA).*?fee:\s*(?P<fee>{self._NUM}).*?(?:ref|reference|txid|id):\s*(?P<ref>\w+)",
                clean_text
            )
            if m:
                return {
                    "amount": self._to_decimal(m.group("amount")),
                    "fee": self._to_decimal(m.group("fee")),
                    "ref": m.group("ref"),
                    "direction": TransactionDirection.CREDIT,
                    "provider": AccountProvider.ORANGE_MONEY,
                    "category": TransactionCategory.INCOME_REMITTANCE,
                    "narrative": f"Orange Money Credit - Ref: {m.group('ref')}",
                    "date": received_at,
                }

        # 5. Cash Deposit (Credit)
        if "CASH DEPOSIT" in text_upper:
            m = re.search(
                rf"(?i)Cash Deposit of (?P<amount>{self._NUM})\s*(?:XAF|FCFA).*?fee:\s*(?P<fee>{self._NUM}).*?(?:ref|reference|txid|id):\s*(?P<ref>\w+)",
                clean_text
            )
            if m:
                return {
                    "amount": self._to_decimal(m.group("amount")),
                    "fee": self._to_decimal(m.group("fee")),
                    "ref": m.group("ref"),
                    "direction": TransactionDirection.CREDIT,
                    "provider": AccountProvider.CASH,
                    "category": TransactionCategory.INCOME_REMITTANCE,
                    "narrative": f"Cash Deposit - Ref: {m.group('ref')}",
                    "date": received_at,
                }

        # 6. Cash Withdrawal (Debit)
        if "CASH WITHDRAWAL" in text_upper:
            m = re.search(
                rf"(?i)Cash Withdrawal of (?P<amount>{self._NUM})\s*(?:XAF|FCFA).*?fee:\s*(?P<fee>{self._NUM}).*?(?:ref|reference|txid|id):\s*(?P<ref>\w+)",
                clean_text
            )
            if m:
                return {
                    "amount": self._to_decimal(m.group("amount")),
                    "fee": self._to_decimal(m.group("fee")),
                    "ref": m.group("ref"),
                    "direction": TransactionDirection.DEBIT,
                    "provider": AccountProvider.CASH,
                    "category": TransactionCategory.EXPENSE_UTILITIES,
                    "narrative": f"Cash Withdrawal - Ref: {m.group('ref')}",
                    "date": received_at,
                }

        # 7. Bank Credit (Credit)
        if "BANK CREDIT" in text_upper:
            m = re.search(
                rf"(?i)Bank Credit of (?P<amount>{self._NUM})\s*(?:XAF|FCFA).*?fee:\s*(?P<fee>{self._NUM}).*?(?:ref|reference|txid|id):\s*(?P<ref>\w+)",
                clean_text
            )
            if m:
                return {
                    "amount": self._to_decimal(m.group("amount")),
                    "fee": self._to_decimal(m.group("fee")),
                    "ref": m.group("ref"),
                    "direction": TransactionDirection.CREDIT,
                    "provider": AccountProvider.BANK,
                    "category": TransactionCategory.INCOME_REMITTANCE,
                    "narrative": f"Bank Credit - Ref: {m.group('ref')}",
                    "date": received_at,
                }

        # 8. Bank Debit (Debit)
        if "BANK DEBIT" in text_upper:
            m = re.search(
                rf"(?i)Bank Debit of (?P<amount>{self._NUM})\s*(?:XAF|FCFA).*?fee:\s*(?P<fee>{self._NUM}).*?(?:ref|reference|txid|id):\s*(?P<ref>\w+)",
                clean_text
            )
            if m:
                return {
                    "amount": self._to_decimal(m.group("amount")),
                    "fee": self._to_decimal(m.group("fee")),
                    "ref": m.group("ref"),
                    "direction": TransactionDirection.DEBIT,
                    "provider": AccountProvider.BANK,
                    "category": TransactionCategory.EXPENSE_UTILITIES,
                    "narrative": f"Bank Debit - Ref: {m.group('ref')}",
                    "date": received_at,
                }

        return None

    def extract_transaction(self, sms: SMSMessage) -> dict | None:
        """
        Extract transaction data from a stored SMSMessage object.

        Tries the deterministic regex parser first (Stage 1 - fast, free,
        fully local). Only if that fails to match, and an AIService is
        configured, falls back to Gemini-based extraction (Stage 2 /
        M-PARSE) for messages with unusual phrasing, a new operator
        template, or French wording that Stage 1 doesn't recognize.
        """
        parsed = self.parse_sms(sms.message_body, sms.sender, sms.received_at)
        if parsed:
            return parsed

        if not self.ai_service:
            return None

        ai_result = self.ai_service.extract_sms_transaction(sms.message_body, sms.sender)
        if not ai_result:
            return None

        try:
            provider = AccountProvider(ai_result["provider"])
        except ValueError:
            provider = AccountProvider.OTHER

        direction = (
            TransactionDirection.CREDIT
            if ai_result["direction"] == "CREDIT"
            else TransactionDirection.DEBIT
        )
        category = (
            TransactionCategory.INCOME_REMITTANCE
            if direction == TransactionDirection.CREDIT
            else TransactionCategory.EXPENSE_UTILITIES
        )

        return {
            "amount": ai_result["amount"],
            "fee": ai_result["fee"],
            "ref": ai_result["ref"],
            "direction": direction,
            "provider": provider,
            "category": category,
            "narrative": f"AI-extracted transaction (M-PARSE) - Ref: {ai_result['ref']}",
            "date": sms.received_at,
            "ai_extracted": True,
        }

    async def check_duplicate(
        self,
        user_id: int,
        provider: AccountProvider,
        tx_id_external: str,
        amount: Decimal,
        timestamp: datetime
    ) -> bool:
        """
        Query the database to check if a duplicate transaction already exists.
        Matches by provider, external reference, amount, and timestamp.
        """
        # Get active accounts for this user
        accounts = await self.account_service.get_by_user_id(user_id)
        matching_accs = [acc for acc in accounts if acc.provider == provider and acc.is_active]
        if not matching_accs:
            return False

        # Query transactions belonging to these accounts that match the metadata
        from sqlalchemy import select
        from app.models.transaction import Transaction

        stmt = select(Transaction).where(
            Transaction.account_id.in_([acc.id for acc in matching_accs]),
            Transaction.tx_id_external == tx_id_external,
            Transaction.amount == amount,
            Transaction.timestamp == timestamp
        )
        res = await self.repository.db.execute(stmt)
        return res.first() is not None

    async def import_sms(self, user_id: int, sms_data: SMSImportRequest) -> SMSMessage:
        """
        Imports SMS, stores it, parses it, triggers automatic transaction creation
        upon successful extraction, and marks it processed.
        """
        # Store SMS
        sms = SMSMessage(
            user_id=user_id,
            sender=sms_data.sender,
            message_body=sms_data.message_body,
            received_at=sms_data.received_at,
            processed=False,
        )
        sms = await self.repository.create(sms)

        # Parse SMS
        parsed = self.extract_transaction(sms)
        if parsed:
            # Check for duplicate
            is_dup = await self.check_duplicate(
                user_id=user_id,
                provider=parsed["provider"],
                tx_id_external=parsed["ref"],
                amount=parsed["amount"],
                timestamp=parsed["date"]
            )
            if is_dup:
                # Mark processed but skip transaction creation
                await self.mark_processed(sms.id)
                return sms

            # Find matching account
            accounts = await self.account_service.get_by_user_id(user_id)
            matching_account = None
            for acc in accounts:
                if acc.provider == parsed["provider"] and acc.is_active:
                    matching_account = acc
                    break

            if not matching_account:
                # Raise ValueError: Do NOT create accounts automatically.
                raise ValueError(f"No active account found for provider: {parsed['provider'].value}")

            # Automatically create a Transaction
            tx_create = TransactionCreate(
                account_id=matching_account.id,
                amount=parsed["amount"],
                fee=parsed["fee"],
                direction=parsed["direction"],
                category=parsed["category"],
                narrative=parsed["narrative"],
                tx_id_external=parsed["ref"],
                timestamp=parsed["date"],
            )
            await self.transaction_service.create_transaction(user_id, tx_create)

            # Mark SMS as processed
            await self.mark_processed(sms.id)

        return sms

    async def mark_processed(self, message_id: int) -> SMSMessage | None:
        """
        Mark SMS message as processed.
        """
        return await self.repository.mark_processed(message_id)

    async def get_unprocessed(self, user_id: int) -> list[SMSMessage]:
        """
        Retrieve all unprocessed SMS messages for a given user.
        """
        return await self.repository.get_unprocessed(user_id)

    async def process_stored_sms(self, user_id: int, message_id: int) -> SMSMessage:
        """
        Manually trigger parsing and transaction creation for an existing SMS message.
        """
        sms = await self.get_by_id(message_id)
        if not sms or sms.user_id != user_id:
            raise ValueError("SMS message not found")

        if sms.processed:
            raise ValueError("SMS message is already processed")

        parsed = self.extract_transaction(sms)
        if not parsed:
            raise ValueError("SMS message body could not be parsed as a valid financial transaction")

        # Check duplicate
        is_dup = await self.check_duplicate(
            user_id=user_id,
            provider=parsed["provider"],
            tx_id_external=parsed["ref"],
            amount=parsed["amount"],
            timestamp=parsed["date"]
        )
        if is_dup:
            await self.mark_processed(sms.id)
            sms.processed = True
            return sms

        # Find matching account
        accounts = await self.account_service.get_by_user_id(user_id)
        matching_account = None
        for acc in accounts:
            if acc.provider == parsed["provider"] and acc.is_active:
                matching_account = acc
                break

        if not matching_account:
            raise ValueError(f"No active account found for provider: {parsed['provider'].value}")

        # Create transaction
        tx_create = TransactionCreate(
            account_id=matching_account.id,
            amount=parsed["amount"],
            fee=parsed["fee"],
            direction=parsed["direction"],
            category=parsed["category"],
            narrative=parsed["narrative"],
            tx_id_external=parsed["ref"],
            timestamp=parsed["date"],
        )
        await self.transaction_service.create_transaction(user_id, tx_create)

        # Mark SMS as processed
        updated_sms = await self.mark_processed(sms.id)
        if updated_sms:
            return updated_sms
        sms.processed = True
        return sms

