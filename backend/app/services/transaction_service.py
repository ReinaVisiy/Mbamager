"""
Mbamager Transaction Service

This module contains Transaction-related business logic and repository coordination.
"""

from datetime import date, datetime, timezone
from decimal import Decimal

from app.models.transaction import Transaction, TransactionCategory, TransactionDirection
from app.repositories import TransactionRepository, AccountRepository
from app.schemas.transaction import TransactionCreate, TransactionUpdate
from app.services.base_service import BaseService
from app.services.ai_service import AIService

class TransactionService(BaseService[Transaction]):
    """
    Service handling Transaction-related business logic and repository coordination.
    """

    def __init__(
        self,
        repository: TransactionRepository,
        account_repository: AccountRepository | None = None,
        ai_service: AIService | None = None,
    ) -> None:
        """
        Initialize the TransactionService with a TransactionRepository and optional AccountRepository.
        """
        super().__init__(repository)
        self.account_repository = account_repository
        self.ai_service = ai_service

    async def get_by_account_id(self, account_id: int) -> list[Transaction]:
        """
        Retrieve all transactions belonging to an account.
        """
        return await self.repository.get_by_account_id(account_id)

    async def exists_duplicate(
        self,
        account_ids: list[int],
        tx_id_external: str,
        amount: Decimal,
        timestamp: datetime,
    ) -> bool:
        return await self.repository.exists_duplicate(
            account_ids, tx_id_external, amount, timestamp
        )

    async def get_by_category(
        self, account_id: int, category: TransactionCategory
    ) -> list[Transaction]:
        """
        Retrieve all transactions of a given category for an account.
        """
        return await self.repository.get_by_category(account_id, category)

    async def get_by_direction(
        self, account_id: int, direction: TransactionDirection
    ) -> list[Transaction]:
        """
        Retrieve all CREDIT or DEBIT transactions for an account.
        """
        return await self.repository.get_by_direction(account_id, direction)

    async def get_by_date_range(
        self, account_id: int, start_date: date, end_date: date
    ) -> list[Transaction]:
        """
        Retrieve all transactions whose timestamp falls within the supplied inclusive date range.
        """
        return await self.repository.get_by_date_range(account_id, start_date, end_date)

    async def get_user_transaction(
        self,
        user_id: int,
        transaction_id: int,
    ) -> Transaction:
        """
        Retrieve transaction.
        Verify transaction exists.
        Verify transaction's account belongs to user_id.
        Raise ValueError("Transaction not found") if either check fails.
        """
        transaction = await self.repository.get_by_id(transaction_id)
        if not transaction:
            raise ValueError("Transaction not found")

        if not self.account_repository:
            raise ValueError("Account repository not available")

        account = await self.account_repository.get_by_id(transaction.account_id)
        if not account or account.user_id != user_id:
            raise ValueError("Transaction not found")

        return transaction

    async def create_transaction(
        self,
        user_id: int,
        transaction_data: TransactionCreate,
    ) -> Transaction:
        """
        Verify the supplied account belongs to the authenticated user.
        Create Transaction model.
        Persist via repository.
        Return created transaction.
        """
        if not self.account_repository:
            raise ValueError("Account repository not available")

        account = await self.account_repository.get_by_id(transaction_data.account_id)
        if not account or account.user_id != user_id:
            raise ValueError("Account not found")

        timestamp = transaction_data.timestamp
        if timestamp is None:
            timestamp = datetime.now(timezone.utc)

        transaction = Transaction(
            account_id=transaction_data.account_id,
            amount=transaction_data.amount,
            fee=transaction_data.fee,
            direction=transaction_data.direction,
            category=transaction_data.category,
            narrative=transaction_data.narrative,
            tx_id_external=transaction_data.tx_id_external,
            timestamp=timestamp,
        )
        created_tx = await self.repository.create(transaction)

        if self.ai_service:
            try:
                # 1. Predict category
                prediction = self.ai_service.categorize_transaction(
                    amount=created_tx.amount,
                    direction=created_tx.direction.value,
                    fee=created_tx.fee,
                    narrative=created_tx.narrative,
                    tx_id_external=created_tx.tx_id_external,
                    timestamp=created_tx.timestamp.isoformat() if created_tx.timestamp else None,
                )
                category_str = prediction.get("category")
                confidence = prediction.get("confidence", 0.0)

                created_tx.ai_confidence = Decimal(str(confidence))

                # If confidence is high, replace the category
                if confidence >= 0.70 and category_str:
                    try:
                        created_tx.category = TransactionCategory(category_str)
                    except ValueError:
                        pass

                # 2. Generate clean narrative
                clean_narrative = self.ai_service.generate_clean_narrative(
                    narrative=created_tx.narrative,
                    amount=created_tx.amount,
                    direction=created_tx.direction.value,
                    tx_id_external=created_tx.tx_id_external,
                )
                if clean_narrative:
                    created_tx.narrative = clean_narrative

                created_tx = await self.repository.update(created_tx)
            except Exception:
                pass

        return created_tx

    async def update_transaction(
        self,
        user_id: int,
        transaction_id: int,
        transaction_data: TransactionUpdate,
    ) -> Transaction:
        """
        Retrieve using get_user_transaction().
        Update only supplied fields.
        Persist.
        Return updated object.
        """
        transaction = await self.get_user_transaction(user_id, transaction_id)

        update_dict = transaction_data.model_dump(exclude_unset=True)
        for key, value in update_dict.items():
            setattr(transaction, key, value)

        return await self.repository.update(transaction)

    async def delete_transaction(
        self,
        user_id: int,
        transaction_id: int,
    ) -> None:
        """
        Retrieve using get_user_transaction().
        Delete using repository.
        """
        transaction = await self.get_user_transaction(user_id, transaction_id)
        await self.repository.delete(transaction)

    async def get_account_transactions(
        self,
        user_id: int,
        account_id: int,
    ) -> list[Transaction]:
        """
        Verify the supplied account belongs to the user.
        Retrieve all transactions belonging to the account.
        """
        if not self.account_repository:
            raise ValueError("Account repository not available")

        account = await self.account_repository.get_by_id(account_id)
        if not account or account.user_id != user_id:
            raise ValueError("Account not found")

        return await self.repository.get_by_account_id(account_id)

    async def get_user_transactions(self, user_id: int) -> list[Transaction]:
        """
        Retrieve all transactions across all accounts belonging to the user.
        """
        if not self.account_repository:
            raise ValueError("Account repository not available")
        accounts = await self.account_repository.get_by_user_id(user_id)
        all_txs = []
        for account in accounts:
            txs = await self.repository.get_by_account_id(account.id)
            all_txs.extend(txs)
        return all_txs

    async def calculate_account_balance(self, account_id: int) -> Decimal:
        """
        Calculate and return the dynamic balance of the given account based on transaction ledger.
        """
        transactions = await self.get_by_account_id(account_id)
        balance = Decimal("0.00")
        for tx in transactions:
            if tx.direction == TransactionDirection.CREDIT:
                balance += tx.amount
            elif tx.direction == TransactionDirection.DEBIT:
                balance -= tx.amount
                balance -= tx.fee
        return balance

    async def calculate_user_net_worth(self, user_id: int) -> Decimal:
        """
        Calculate total net worth across all accounts of the user.
        """
        if not self.account_repository:
            raise ValueError("Account repository not available")
        accounts = await self.account_repository.get_by_user_id(user_id)
        total = Decimal("0.00")
        for account in accounts:
            balance = await self.calculate_account_balance(account.id)
            total += balance
        return total

    async def calculate_spending_by_category(
        self,
        user_id: int,
        start_date: date,
        end_date: date,
    ) -> dict[TransactionCategory, Decimal]:
        """
        Calculate total debit spending (amount + fee) by category for a user within a date range.
        """
        if not self.account_repository:
            raise ValueError("Account repository not available")
        accounts = await self.account_repository.get_by_user_id(user_id)
        
        spending: dict[TransactionCategory, Decimal] = {}
        for account in accounts:
            txs = await self.repository.get_by_date_range(account.id, start_date, end_date)
            for tx in txs:
                if tx.direction == TransactionDirection.DEBIT:
                    total_spent = tx.amount + tx.fee
                    spending[tx.category] = spending.get(tx.category, Decimal("0.00")) + total_spent
        return spending

    async def calculate_total_income(
        self,
        user_id: int,
        start_date: date,
        end_date: date,
    ) -> Decimal:
        """
        Sum total income (CREDIT transactions) for a user within a date range.
        """
        if not self.account_repository:
            raise ValueError("Account repository not available")
        accounts = await self.account_repository.get_by_user_id(user_id)
        
        total_income = Decimal("0.00")
        for account in accounts:
            txs = await self.repository.get_by_date_range(account.id, start_date, end_date)
            for tx in txs:
                if tx.direction == TransactionDirection.CREDIT:
                    total_income += tx.amount
        return total_income

    async def calculate_total_expenses(
        self,
        user_id: int,
        start_date: date,
        end_date: date,
    ) -> Decimal:
        """
        Sum total expenses (DEBIT amount + fee) for a user within a date range.
        """
        if not self.account_repository:
            raise ValueError("Account repository not available")
        accounts = await self.account_repository.get_by_user_id(user_id)
        
        total_expenses = Decimal("0.00")
        for account in accounts:
            txs = await self.repository.get_by_date_range(account.id, start_date, end_date)
            for tx in txs:
                if tx.direction == TransactionDirection.DEBIT:
                    total_expenses += (tx.amount + tx.fee)
        return total_expenses
