import uuid
from datetime import datetime, date
from sqlalchemy import String, Boolean, Numeric, DateTime, Date, ForeignKey, CheckConstraint, UniqueConstraint, func, LargeBinary, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


class Investment(Base):
    __tablename__ = "investments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    added_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    asset_type: Mapped[str] = mapped_column(String, nullable=False)
    currency: Mapped[str] = mapped_column(String, nullable=False)
    units: Mapped[float | None] = mapped_column(Numeric(15, 6), nullable=True)
    purchase_price: Mapped[float | None] = mapped_column(Numeric(15, 2), nullable=True)
    current_price: Mapped[float | None] = mapped_column(Numeric(15, 2), nullable=True)
    current_value: Mapped[float | None] = mapped_column(Numeric(15, 2), nullable=True)
    base_currency_value: Mapped[float | None] = mapped_column(Numeric(15, 2), nullable=True)
    country: Mapped[str | None] = mapped_column(String, nullable=True)
    visibility: Mapped[str] = mapped_column(String, default="personal")
    has_secure_details: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String, default="active")
    purchased_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint(
            "asset_type IN ('stocks','bonds','mutual_funds','property','crypto','fixed_deposit','retirement','foreign_cash','other')",
            name="ck_investment_asset_type",
        ),
        CheckConstraint("visibility IN ('personal', 'shared')", name="ck_investment_visibility"),
        CheckConstraint("status IN ('active', 'sold')", name="ck_investment_status"),
    )

    account: Mapped["Account"] = relationship("Account", back_populates="investments")
    secure_details: Mapped["InvestmentSecureDetails | None"] = relationship(
        "InvestmentSecureDetails",
        back_populates="investment",
        cascade="all, delete-orphan",
        uselist=False,
    )


class InvestmentSecureDetails(Base):
    __tablename__ = "investment_secure_details"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    investment_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("investments.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    nonce: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    ciphertext: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    updated_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    investment: Mapped["Investment"] = relationship("Investment", back_populates="secure_details")


class InvestmentSecureCode(Base):
    __tablename__ = "investment_secure_codes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    investment_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("investments.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    code_hash: Mapped[str] = mapped_column(String, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class InvestmentSecureAccessLog(Base):
    __tablename__ = "investment_secure_access_log"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    investment_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("investments.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    action: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False)
    ip_address: Mapped[str | None] = mapped_column(String, nullable=True)
    user_agent: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        CheckConstraint("action IN ('request_code', 'view_secure_details')", name="ck_investment_secure_log_action"),
        CheckConstraint("status IN ('success', 'failed')", name="ck_investment_secure_log_status"),
    )


class ExchangeRate(Base):
    __tablename__ = "exchange_rates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    from_currency: Mapped[str] = mapped_column(String, nullable=False)
    to_currency: Mapped[str] = mapped_column(String, nullable=False)
    rate: Mapped[float] = mapped_column(Numeric(20, 8), nullable=False)
    fetched_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    source: Mapped[str] = mapped_column(String, default="frankfurter")
    status: Mapped[str] = mapped_column(String, default="live")

    __table_args__ = (
        CheckConstraint("status IN ('live', 'stale', 'error')", name="ck_exchange_rate_status"),
    )
