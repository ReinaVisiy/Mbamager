"""
Mbamager Tontine (Njangi) Service

This module handles business logic for rotating savings/credit groups:
membership, per-cycle contribution collection, and rotation payouts.

Frozen engineering laws applied here:
  - Money uses Decimal, never float (all amounts pass through as Decimal).
  - Nothing that can be computed is stored twice: how much has been
    collected for a cycle, and whether the group is ready for payout, are
    always derived from TontineContribution rows, never cached.
  - The AI layer has no access to this module; only explicit user actions
    (recording a contribution, triggering a payout) can move money state.
"""

from decimal import Decimal
from typing import Optional

from app.models.notification import NotificationType
from app.models.tontine import (
    TontineContribution,
    TontineContributionStatus,
    TontineGroup,
    TontineGroupStatus,
    TontineMember,
    TontinePayout,
)
from app.repositories.tontine_repository import (
    TontineContributionRepository,
    TontineGroupRepository,
    TontineMemberRepository,
    TontinePayoutRepository,
)
from app.schemas.tontine import (
    TontineContributionCreate,
    TontineCycleStatusResponse,
    TontineGroupCreate,
    TontineGroupUpdate,
    TontineMemberCreate,
    TontineMemberCycleStatus,
    TontinePayoutCreate,
)
from app.services.base_service import BaseService
from app.services.notification_service import NotificationService


class TontineService(BaseService[TontineGroup]):
    """
    Service layer coordinating Tontine/Njangi group membership, cycle
    contributions, and rotation payouts.
    """

    def __init__(
        self,
        group_repository: TontineGroupRepository,
        member_repository: TontineMemberRepository,
        contribution_repository: TontineContributionRepository,
        payout_repository: TontinePayoutRepository,
        notification_service: Optional[NotificationService] = None,
    ) -> None:
        super().__init__(group_repository)
        self.group_repository = group_repository
        self.member_repository = member_repository
        self.contribution_repository = contribution_repository
        self.payout_repository = payout_repository
        self.notification_service = notification_service

    # --- Groups -----------------------------------------------------------------------

    async def get_user_groups(self, user_id: int) -> list[TontineGroup]:
        """
        Retrieve every group a user administers or belongs to as a member.
        """
        created = await self.group_repository.get_by_creator_id(user_id)
        joined = await self.group_repository.get_for_member_user(user_id)

        seen_ids = set()
        combined: list[TontineGroup] = []
        for group in [*created, *joined]:
            if group.id not in seen_ids:
                seen_ids.add(group.id)
                combined.append(group)
        return combined

    async def get_group(self, user_id: int, group_id: int) -> TontineGroup:
        """
        Retrieve a group after verifying the requester is its creator or one
        of its linked members.
        """
        group = await self.group_repository.get_by_id(group_id)
        if not group:
            raise ValueError("Tontine group not found")
        await self._ensure_access(group, user_id)
        return group

    async def create_group(self, user_id: int, data: TontineGroupCreate) -> TontineGroup:
        """
        Create a new tontine group. The creator is automatically added as
        the first member (rotation position 1).
        """
        group = TontineGroup(
            creator_id=user_id,
            name=data.name,
            description=data.description,
            contribution_amount=data.contribution_amount,
            currency=data.currency,
            frequency=data.frequency,
            status=TontineGroupStatus.ACTIVE,
            current_cycle=1,
        )
        if data.start_date:
            group.start_date = data.start_date

        created = await self.group_repository.create(group)

        creator_member = TontineMember(
            group_id=created.id,
            user_id=user_id,
            display_name="You",
            payout_position=1,
        )
        await self.member_repository.create(creator_member)

        return created

    async def update_group(self, user_id: int, group_id: int, data: TontineGroupUpdate) -> TontineGroup:
        """
        Update a group's mutable fields. Only the creator may do this.
        """
        group = await self._get_group_as_creator(user_id, group_id)
        update_dict = data.model_dump(exclude_unset=True)
        for key, value in update_dict.items():
            setattr(group, key, value)
        return await self.group_repository.update(group)

    async def delete_group(self, user_id: int, group_id: int) -> None:
        """
        Delete a group and its members/contributions/payouts. Only the
        creator may do this.
        """
        group = await self._get_group_as_creator(user_id, group_id)
        await self.group_repository.delete(group)

    # --- Members ------------------------------------------------------------------------

    async def add_member(self, user_id: int, group_id: int, data: TontineMemberCreate) -> TontineMember:
        """
        Add a new member to the rotation at the next available position.
        Only the group's creator may add members.
        """
        group = await self._get_group_as_creator(user_id, group_id)

        next_position = await self.member_repository.get_max_position(group.id) + 1
        member = TontineMember(
            group_id=group.id,
            user_id=data.user_id,
            display_name=data.display_name,
            payout_position=next_position,
        )
        return await self.member_repository.create(member)

    async def remove_member(self, user_id: int, group_id: int, member_id: int) -> None:
        """
        Remove a member who has not yet received a payout. Only the group's
        creator may do this; a member who already collected the pot cannot
        be removed since that would break the historical rotation record.
        """
        group = await self._get_group_as_creator(user_id, group_id)
        member = await self._get_member_in_group(group.id, member_id)

        if member.has_received_payout:
            raise ValueError("Cannot remove a member who has already received a payout")

        await self.member_repository.delete(member)

    async def list_members(self, user_id: int, group_id: int) -> list[TontineMember]:
        """
        List members of a group in rotation order.
        """
        group = await self.get_group(user_id, group_id)
        return await self.member_repository.get_by_group_id(group.id)

    # --- Contributions ------------------------------------------------------------------

    async def record_contribution(
        self,
        user_id: int,
        group_id: int,
        data: TontineContributionCreate,
    ) -> TontineContribution:
        """
        Record that a member has paid into the current (or specified)
        cycle. Only the group's creator may record contributions on behalf
        of the group. Rejects duplicate contributions for the same
        member/cycle pair.
        """
        group = await self._get_group_as_creator(user_id, group_id)
        member = await self._get_member_in_group(group.id, data.member_id)

        cycle_number = data.cycle_number or group.current_cycle
        amount = data.amount if data.amount is not None else group.contribution_amount

        existing = await self.contribution_repository.get_by_member_and_cycle(member.id, cycle_number)
        if existing:
            raise ValueError(
                f"{member.display_name} has already contributed for cycle {cycle_number}"
            )

        contribution = TontineContribution(
            group_id=group.id,
            member_id=member.id,
            cycle_number=cycle_number,
            amount=amount,
            status=TontineContributionStatus.PAID,
            transaction_id=data.transaction_id,
        )
        created = await self.contribution_repository.create(contribution)

        status = await self.get_cycle_status(user_id, group.id, cycle_number)
        if status.all_members_paid and self.notification_service:
            try:
                await self.notification_service.create_notification(
                    user_id=user_id,
                    title="Tontine Cycle Fully Collected",
                    message=(
                        f"All members of '{group.name}' have contributed for cycle "
                        f"{cycle_number}. It's ready for payout."
                    ),
                    type=NotificationType.RECURRING_PAYMENT,
                )
            except Exception:
                pass  # Avoid blocking contribution recording if notification fails

        return created

    async def get_cycle_status(
        self,
        user_id: int,
        group_id: int,
        cycle_number: Optional[int] = None,
    ) -> TontineCycleStatusResponse:
        """
        Compute a full snapshot of one cycle: who has paid, the total
        collected so far, and whether it is ready for payout. Nothing here
        is read from a stored balance — it is aggregated live from
        contribution rows every time this is called.
        """
        group = await self.get_group(user_id, group_id)
        cycle_number = cycle_number or group.current_cycle

        members = await self.member_repository.get_by_group_id(group.id)
        contributions = await self.contribution_repository.get_by_group_and_cycle(group.id, cycle_number)
        paid_member_ids = {c.member_id for c in contributions}

        member_statuses = [
            TontineMemberCycleStatus(
                member_id=m.id,
                display_name=m.display_name,
                payout_position=m.payout_position,
                has_paid=m.id in paid_member_ids,
            )
            for m in members
        ]

        collected_total = sum((c.amount for c in contributions), Decimal("0.00"))
        expected_total = group.contribution_amount * Decimal(len(members))
        all_members_paid = len(members) > 0 and len(paid_member_ids) == len(members)

        recipient = await self.member_repository.get_by_position(group.id, cycle_number)
        existing_payout = await self.payout_repository.get_by_group_and_cycle(group.id, cycle_number)

        return TontineCycleStatusResponse(
            group_id=group.id,
            cycle_number=cycle_number,
            contribution_amount=group.contribution_amount,
            expected_total=expected_total,
            collected_total=collected_total,
            members=member_statuses,
            all_members_paid=all_members_paid,
            recipient_member_id=recipient.id if recipient else None,
            payout_made=existing_payout is not None,
        )

    # --- Payouts ------------------------------------------------------------------------

    async def record_payout(
        self,
        user_id: int,
        group_id: int,
        data: TontinePayoutCreate,
    ) -> TontinePayout:
        """
        Pay out the pot for a cycle to whichever member holds that
        rotation position, then advance the group to the next cycle.
        Requires every member to have contributed for that cycle first, and
        rejects a second payout for the same cycle.
        """
        group = await self._get_group_as_creator(user_id, group_id)
        cycle_number = data.cycle_number or group.current_cycle

        if cycle_number != group.current_cycle:
            raise ValueError(
                f"Only the group's current active cycle ({group.current_cycle}) can be paid out"
            )
        if group.status != TontineGroupStatus.ACTIVE:
            raise ValueError("This tontine group is not active")

        status = await self.get_cycle_status(user_id, group.id, cycle_number)
        if not status.all_members_paid:
            raise ValueError(
                f"Not all members have contributed for cycle {cycle_number} yet"
            )
        if status.payout_made:
            raise ValueError(f"Cycle {cycle_number} has already been paid out")

        recipient = await self.member_repository.get_by_position(group.id, cycle_number)
        if not recipient:
            raise ValueError("No member holds the rotation position for this cycle")

        payout = TontinePayout(
            group_id=group.id,
            member_id=recipient.id,
            cycle_number=cycle_number,
            amount=status.collected_total,
            transaction_id=data.transaction_id,
        )
        created = await self.payout_repository.create(payout)

        recipient.has_received_payout = True
        await self.member_repository.update(recipient)

        members = await self.member_repository.get_by_group_id(group.id)
        if len(members) > 0 and cycle_number >= len(members):
            group.status = TontineGroupStatus.COMPLETED
        else:
            group.current_cycle = cycle_number + 1
        await self.group_repository.update(group)

        if self.notification_service:
            try:
                await self.notification_service.create_notification(
                    user_id=user_id,
                    title="Tontine Payout Made",
                    message=(
                        f"{recipient.display_name} received the cycle {cycle_number} pot "
                        f"of {status.collected_total} from '{group.name}'."
                    ),
                    type=NotificationType.RECURRING_PAYMENT,
                )
            except Exception:
                pass

        return created

    # --- Internal helpers -----------------------------------------------------------------

    async def _ensure_access(self, group: TontineGroup, user_id: int) -> None:
        if group.creator_id == user_id:
            return
        members = await self.member_repository.get_by_group_id(group.id)
        if any(m.user_id == user_id for m in members):
            return
        raise ValueError("Tontine group not found")

    async def _get_group_as_creator(self, user_id: int, group_id: int) -> TontineGroup:
        group = await self.group_repository.get_by_id(group_id)
        if not group or group.creator_id != user_id:
            raise ValueError("Tontine group not found")
        return group

    async def _get_member_in_group(self, group_id: int, member_id: int) -> TontineMember:
        member = await self.member_repository.get_by_id(member_id)
        if not member or member.group_id != group_id:
            raise ValueError("Tontine member not found in this group")
        return member
