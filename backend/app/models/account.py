import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, Numeric, DateTime, ForeignKey, UniqueConstraint, func, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    type: Mapped[str] = mapped_column(String, nullable=False)
    name: Mapped[str | None] = mapped_column(String, nullable=True)
    base_currency: Mapped[str] = mapped_column(String, nullable=False, default="USD")
    status: Mapped[str] = mapped_column(String, nullable=False, default="active")
    close_requested_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint("type IN ('personal', 'joint')", name="ck_accounts_type"),
        CheckConstraint("status IN ('active', 'closed')", name="ck_accounts_status"),
    )

    members: Mapped[list["AccountMember"]] = relationship("AccountMember", back_populates="account", cascade="all, delete-orphan")
    profiles: Mapped[list["UserProfile"]] = relationship("UserProfile", back_populates="account", cascade="all, delete-orphan")
    debts: Mapped[list["Debt"]] = relationship(
        "Debt",
        back_populates="account",
        cascade="all, delete-orphan",
        foreign_keys="Debt.account_id",
    )
    transactions: Mapped[list["Transaction"]] = relationship("Transaction", back_populates="account", cascade="all, delete-orphan")
    goals: Mapped[list["Goal"]] = relationship("Goal", back_populates="account", cascade="all, delete-orphan")
    investments: Mapped[list["Investment"]] = relationship("Investment", back_populates="account", cascade="all, delete-orphan")
    invite_tokens: Mapped[list["InviteToken"]] = relationship("InviteToken", back_populates="account", cascade="all, delete-orphan")


class AccountMember(Base):
    __tablename__ = "account_members"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default="active")
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("account_id", "user_id", name="uq_account_members"),
        CheckConstraint("role IN ('member', 'viewer')", name="ck_account_members_role"),
        CheckConstraint("status IN ('active', 'pending', 'removed')", name="ck_account_members_status"),
    )

    account: Mapped["Account"] = relationship("Account", back_populates="members")
    user: Mapped["User"] = relationship("User", back_populates="account_memberships")


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    account_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False)

    # Location
    country: Mapped[str | None] = mapped_column(String, nullable=True)
    city: Mapped[str | None] = mapped_column(String, nullable=True)
    local_currency: Mapped[str | None] = mapped_column(String, nullable=True)

    # Income
    income_type: Mapped[str | None] = mapped_column(String, nullable=True)
    pay_frequency: Mapped[str | None] = mapped_column(String, nullable=True)
    pay_day: Mapped[str | None] = mapped_column(String, nullable=True)
    income_month_1: Mapped[float | None] = mapped_column(Numeric(15, 2), nullable=True)
    income_month_2: Mapped[float | None] = mapped_column(Numeric(15, 2), nullable=True)
    income_month_3: Mapped[float | None] = mapped_column(Numeric(15, 2), nullable=True)
    income_baseline: Mapped[float | None] = mapped_column(Numeric(15, 2), nullable=True)
    income_lowest: Mapped[float | None] = mapped_column(Numeric(15, 2), nullable=True)

    # Situation
    financial_situation: Mapped[str | None] = mapped_column(String, nullable=True)
    primary_goal: Mapped[str | None] = mapped_column(String, nullable=True)
    debt_method: Mapped[str] = mapped_column(String, default="snowball")
    motivation_style: Mapped[str | None] = mapped_column(String, nullable=True)
    spending_personality: Mapped[str | None] = mapped_column(String, nullable=True)
    onboarding_complete: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint("income_type IN ('fixed', 'casual', 'variable', 'multiple')", name="ck_profile_income_type"),
        CheckConstraint("pay_frequency IN ('weekly', 'biweekly', 'monthly', 'irregular')", name="ck_profile_pay_freq"),
        CheckConstraint("debt_method IN ('snowball', 'avalanche', 'custom')", name="ck_profile_debt_method"),
    )

    user: Mapped["User"] = relationship("User", back_populates="profiles")
    account: Mapped["Account"] = relationship("Account", back_populates="profiles")


class InviteToken(Base):
    __tablename__ = "invite_tokens"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False)
    invited_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    email: Mapped[str] = mapped_column(String, nullable=False)
    role: Mapped[str] = mapped_column(String, nullable=False, default="member")
    token: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default="pending")
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        CheckConstraint("role IN ('member', 'viewer')", name="ck_invite_role"),
        CheckConstraint("status IN ('pending', 'accepted', 'declined', 'expired')", name="ck_invite_status"),
    )

    account: Mapped["Account"] = relationship("Account", back_populates="invite_tokens")
