import uuid
from datetime import datetime, date
from sqlalchemy import String, Boolean, Numeric, DateTime, Date, ForeignKey, CheckConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID

from app.core.database import Base


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    amount: Mapped[float] = mapped_column(Numeric(15, 2), nullable=False)
    type: Mapped[str] = mapped_column(String, nullable=False)
    category: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    subcategory: Mapped[str | None] = mapped_column(String, nullable=True)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    transaction_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    currency: Mapped[str] = mapped_column(String, nullable=False, default="USD")
    is_shared: Mapped[bool] = mapped_column(Boolean, default=False)
    split_type: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        CheckConstraint("type IN ('income', 'expense', 'transfer', 'debt_payment')", name="ck_transaction_type"),
        CheckConstraint("split_type IN ('shared', 'personal', 'grey')", name="ck_transaction_split"),
    )

    account: Mapped["Account"] = relationship("Account", back_populates="transactions")
