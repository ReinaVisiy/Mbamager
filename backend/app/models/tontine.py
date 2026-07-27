"""
Mbamager Tontine (Njangi) Domain Models

This module defines the SQLAlchemy 2.0 models for rotating savings and credit
groups (known as "Njangi" or "Tontine" in Cameroon). A group has an ordered
list of members; each cycle every member contributes a fixed amount, and the
full pot is paid out to whichever member holds that cycle's rotation
position.

Follows the same engineering laws as the rest of the ledger:
  - Money uses Decimal, never float.
  - Nothing that can be computed is stored twice: how much a group has
    collected for a given cycle, and whether it is ready for payout, are
    derived from TontineContribution rows in the service layer rather than
    cached on the group. The only "stateful" fields stored here are workflow
    position (whose turn it is, which cycle is open) and status flags —
    those describe process state, not a monetary balance.
"""

import enum
from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum as SQLEnum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database.base import Base


class TontineFrequency(str, enum.Enum):
    WEEKLY = "WEEKLY"
    BIWEEKLY = "BIWEEKLY"
    MONTHLY = "MONTHLY"


class TontineGroupStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class TontineContributionStatus(str, enum.Enum):
    PAID = "PAID"
    LATE = "LATE"


class TontineGroup(Base):
    """
    TontineGroup entity representing one rotating savings circle
    (Njangi/Tontine) owned/administered by its creator.
    """
    __tablename__ = "tontine_groups"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    creator_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True,
        nullable=False
    )

    name: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    contribution_amount: Mapped[Decimal] = mapped_column(
        Numeric(precision=18, scale=2, asdecimal=True),
        nullable=False
    )
    currency: Mapped[str] = mapped_column(String(3), default="XAF", nullable=False)
    frequency: Mapped[TontineFrequency] = mapped_column(
        SQLEnum(TontineFrequency, name="tontinefrequency_enum"),
        nullable=False
    )
    status: Mapped[TontineGroupStatus] = mapped_column(
        SQLEnum(TontineGroupStatus, name="tontinegroupstatus_enum"),
        default=TontineGroupStatus.ACTIVE,
        nullable=False
    )

    # Workflow position: which rotation cycle is currently collecting
    # contributions and awaiting payout. Not a monetary value.
    current_cycle: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    start_date: Mapped[date] = mapped_column(Date, server_default=func.current_date(), nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )

    # Relationships
    members: Mapped[List["TontineMember"]] = relationship(
        "TontineMember",
        back_populates="group",
        cascade="all, delete-orphan",
        order_by="TontineMember.payout_position",
    )

    def __repr__(self) -> str:
        return f"<TontineGroup(id={self.id}, name='{self.name}', cycle={self.current_cycle})>"


class TontineMember(Base):
    """
    TontineMember entity representing one participant's seat in the
    rotation. A member may optionally be linked to a registered Mbamager
    user (user_id), or may simply be a named participant tracked manually
    by the group creator (e.g. a relative not on the platform).
    """
    __tablename__ = "tontine_members"

    __table_args__ = (
        UniqueConstraint("group_id", "payout_position", name="uq_tontine_member_position"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    group_id: Mapped[int] = mapped_column(
        ForeignKey("tontine_groups.id", ondelete="CASCADE"),
        index=True,
        nullable=False
    )
    user_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        index=True,
        nullable=True
    )

    display_name: Mapped[str] = mapped_column(String(128), nullable=False)
    payout_position: Mapped[int] = mapped_column(Integer, nullable=False)
    has_received_payout: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )

    # Relationships
    group: Mapped["TontineGroup"] = relationship("TontineGroup", back_populates="members")

    def __repr__(self) -> str:
        return f"<TontineMember(id={self.id}, group_id={self.group_id}, position={self.payout_position})>"


class TontineContribution(Base):
    """
    TontineContribution entity recording one member's payment into one
    rotation cycle. Immutable ledger row — amount collected for a cycle is
    always summed from these rows, never cached on the group or member.
    """
    __tablename__ = "tontine_contributions"

    __table_args__ = (
        UniqueConstraint("member_id", "cycle_number", name="uq_tontine_contribution_member_cycle"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    group_id: Mapped[int] = mapped_column(
        ForeignKey("tontine_groups.id", ondelete="CASCADE"),
        index=True,
        nullable=False
    )
    member_id: Mapped[int] = mapped_column(
        ForeignKey("tontine_members.id", ondelete="CASCADE"),
        index=True,
        nullable=False
    )
    cycle_number: Mapped[int] = mapped_column(Integer, nullable=False)

    amount: Mapped[Decimal] = mapped_column(
        Numeric(precision=18, scale=2, asdecimal=True),
        nullable=False
    )
    status: Mapped[TontineContributionStatus] = mapped_column(
        SQLEnum(TontineContributionStatus, name="tontinecontributionstatus_enum"),
        default=TontineContributionStatus.PAID,
        nullable=False
    )

    # Optional link to the real ledger movement (e.g. a MoMo transfer into
    # the group's collection account) that funded this contribution.
    transaction_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("transactions.id", ondelete="SET NULL"),
        nullable=True
    )

    paid_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )

    def __repr__(self) -> str:
        return f"<TontineContribution(member_id={self.member_id}, cycle={self.cycle_number}, amount={self.amount})>"


class TontinePayout(Base):
    """
    TontinePayout entity recording the pot handed to the member whose turn
    it was for a given cycle. One payout per (group, cycle).
    """
    __tablename__ = "tontine_payouts"

    __table_args__ = (
        UniqueConstraint("group_id", "cycle_number", name="uq_tontine_payout_group_cycle"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    group_id: Mapped[int] = mapped_column(
        ForeignKey("tontine_groups.id", ondelete="CASCADE"),
        index=True,
        nullable=False
    )
    member_id: Mapped[int] = mapped_column(
        ForeignKey("tontine_members.id", ondelete="CASCADE"),
        index=True,
        nullable=False
    )
    cycle_number: Mapped[int] = mapped_column(Integer, nullable=False)

    amount: Mapped[Decimal] = mapped_column(
        Numeric(precision=18, scale=2, asdecimal=True),
        nullable=False
    )

    # Optional link to the real ledger movement paying the pot out to the
    # recipient's account.
    transaction_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("transactions.id", ondelete="SET NULL"),
        nullable=True
    )

    paid_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )

    def __repr__(self) -> str:
        return f"<TontinePayout(group_id={self.group_id}, cycle={self.cycle_number}, member_id={self.member_id})>"
