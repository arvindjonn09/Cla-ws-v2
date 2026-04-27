import uuid
from datetime import datetime, date
from sqlalchemy import String, Boolean, Numeric, DateTime, Date, Integer, ForeignKey, CheckConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


class Debt(Base):
    __tablename__ = "debts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    added_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    debt_type: Mapped[str] = mapped_column(String, nullable=False)
    payment_type: Mapped[str | None] = mapped_column(String, nullable=True)
    original_balance: Mapped[float] = mapped_column(Numeric(15, 2), nullable=False)
    current_balance: Mapped[float] = mapped_column(Numeric(15, 2), nullable=False)
    minimum_payment: Mapped[float | None] = mapped_column(Numeric(15, 2), nullable=True)
    actual_payment: Mapped[float | None] = mapped_column(Numeric(15, 2), nullable=True)
    payment_frequency: Mapped[str | None] = mapped_column(String, nullable=True)
    payment_day: Mapped[str | None] = mapped_column(String, nullable=True)
    has_interest: Mapped[bool] = mapped_column(Boolean, default=False)
    interest_rate: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    months_remaining: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String, default="active")
    cleared_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    currency: Mapped[str] = mapped_column(String, nullable=False, default="USD")
    is_shared: Mapped[bool] = mapped_column(Boolean, default=False)
    is_locked: Mapped[bool] = mapped_column(Boolean, default=False)
    shared_from_debt_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("debts.id"), nullable=True)
    shared_to_account_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("accounts.id"), nullable=True)
    shared_to_debt_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("debts.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint(
            "debt_type IN ('credit_card','personal_loan','car_finance','student_loan','home_loan','store_account','personal','other')",
            name="ck_debt_type",
        ),
        CheckConstraint("payment_type IN ('fixed', 'variable', 'app_decided')", name="ck_debt_payment_type"),
        CheckConstraint("payment_frequency IN ('weekly', 'biweekly', 'monthly')", name="ck_debt_pay_freq"),
        CheckConstraint("status IN ('active', 'cleared', 'paused')", name="ck_debt_status"),
    )

    account: Mapped["Account"] = relationship("Account", back_populates="debts", foreign_keys=[account_id])
    payments: Mapped[list["DebtPayment"]] = relationship("DebtPayment", back_populates="debt", cascade="all, delete-orphan")


class DebtPayment(Base):
    __tablename__ = "debt_payments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    debt_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("debts.id", ondelete="CASCADE"), nullable=False, index=True)
    account_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("accounts.id"), nullable=True)
    paid_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    amount: Mapped[float] = mapped_column(Numeric(15, 2), nullable=False)
    extra_amount: Mapped[float] = mapped_column(Numeric(15, 2), default=0)
    payment_date: Mapped[date] = mapped_column(Date, nullable=False)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String, default="pending")
    extension_requested: Mapped[bool] = mapped_column(Boolean, default=False)
    extension_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    extension_reason: Mapped[str | None] = mapped_column(String, nullable=True)
    extension_due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    member_b_amount: Mapped[float | None] = mapped_column(Numeric(15, 2), nullable=True)
    member_b_confirmed: Mapped[bool] = mapped_column(Boolean, default=False)
    team_option_used: Mapped[str | None] = mapped_column(String, nullable=True)
    notes: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        CheckConstraint("status IN ('pending', 'confirmed', 'late', 'extended')", name="ck_debt_payment_status"),
    )

    debt: Mapped["Debt"] = relationship("Debt", back_populates="payments")
