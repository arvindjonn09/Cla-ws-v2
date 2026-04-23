import uuid
from datetime import datetime, date
from sqlalchemy import String, Numeric, DateTime, Date, ForeignKey, CheckConstraint, UniqueConstraint, func
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
    status: Mapped[str] = mapped_column(String, default="active")
    purchased_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        CheckConstraint(
            "asset_type IN ('stocks','bonds','mutual_funds','property','crypto','fixed_deposit','retirement','foreign_cash','other')",
            name="ck_investment_asset_type",
        ),
        CheckConstraint("status IN ('active', 'sold')", name="ck_investment_status"),
    )

    account: Mapped["Account"] = relationship("Account", back_populates="investments")


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
