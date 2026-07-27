"""
Mbamager Global Search Service

This module coordinates a single server-side search across a user's
accounts, transactions, savings goals, recurring transactions,
notifications, and tontine groups.

Replaces the previous approach (fetch every collection to the client,
filter with .includes() in the browser): every repository query here
filters and LIMITs at the SQL level, scoped to the requesting user, so
response time and payload size stay flat as data volume grows instead of
degrading with it.
"""

from app.repositories.account_repository import AccountRepository
from app.repositories.notification_repository import NotificationRepository
from app.repositories.recurring_transaction_repository import RecurringTransactionRepository
from app.repositories.savings_goal_repository import SavingsGoalRepository
from app.repositories.tontine_repository import TontineGroupRepository
from app.repositories.transaction_repository import TransactionRepository
from app.schemas.search import SearchResultItem


class SearchService:
    """
    Service aggregating scoped, limited searches across every searchable
    entity type into one ranked-by-recency result list.
    """

    def __init__(
        self,
        account_repository: AccountRepository,
        transaction_repository: TransactionRepository,
        savings_goal_repository: SavingsGoalRepository,
        recurring_repository: RecurringTransactionRepository,
        notification_repository: NotificationRepository,
        tontine_repository: TontineGroupRepository,
    ) -> None:
        self.account_repository = account_repository
        self.transaction_repository = transaction_repository
        self.savings_goal_repository = savings_goal_repository
        self.recurring_repository = recurring_repository
        self.notification_repository = notification_repository
        self.tontine_repository = tontine_repository

    async def search(
        self,
        user_id: int,
        query: str,
        limit_per_type: int = 5,
    ) -> list[SearchResultItem]:
        """
        Run one bounded search per entity type and merge the results.
        Each individual query is filtered and LIMITed in SQL, so total
        work stays proportional to `limit_per_type`, never to the size of
        the user's data.
        """
        query = query.strip()
        if not query:
            return []

        accounts = await self.account_repository.search(user_id, query, limit_per_type)
        transactions = await self.transaction_repository.search(user_id, query, limit_per_type)
        goals = await self.savings_goal_repository.search(user_id, query, limit_per_type)
        recurring = await self.recurring_repository.search(user_id, query, limit_per_type)
        notifications = await self.notification_repository.search(user_id, query, limit_per_type)
        tontine_groups = await self.tontine_repository.search_by_creator(user_id, query, limit_per_type)

        results: list[SearchResultItem] = []

        for acc in accounts:
            results.append(
                SearchResultItem(
                    id=f"acc-{acc.id}",
                    type="account",
                    title=acc.name,
                    subtitle=f"{acc.provider.value} • {acc.account_type.value}",
                    meta=None,
                    url="/accounts",
                )
            )

        for tx in transactions:
            results.append(
                SearchResultItem(
                    id=f"tx-{tx.id}",
                    type="transaction",
                    title=tx.narrative or "Transaction",
                    subtitle=f"{tx.category.value} • {tx.direction.value}",
                    meta=f"{'+' if tx.direction.value == 'CREDIT' else '-'}{tx.amount}",
                    url="/transactions",
                )
            )

        for goal in goals:
            results.append(
                SearchResultItem(
                    id=f"goal-{goal.id}",
                    type="goal",
                    title=goal.name,
                    subtitle=f"Savings Goal • Target Date: {goal.target_date.isoformat()}",
                    meta=f"{goal.current_amount} / {goal.target_amount}",
                    url="/goals",
                )
            )

        for rec in recurring:
            results.append(
                SearchResultItem(
                    id=f"rec-{rec.id}",
                    type="recurring",
                    title=rec.narrative or f"Recurring {rec.category.value}",
                    subtitle=f"{rec.frequency.value} • {rec.category.value}",
                    meta=str(rec.amount),
                    url="/recurring",
                )
            )

        for notif in notifications:
            results.append(
                SearchResultItem(
                    id=f"notif-{notif.id}",
                    type="notification",
                    title=notif.title,
                    subtitle=notif.message,
                    meta=notif.type.value,
                    url="/notifications",
                )
            )

        for group in tontine_groups:
            results.append(
                SearchResultItem(
                    id=f"tontine-{group.id}",
                    type="tontine",
                    title=group.name,
                    subtitle=f"Tontine • Cycle {group.current_cycle} • {group.status.value}",
                    meta=str(group.contribution_amount),
                    url="/tontine",
                )
            )

        return results
