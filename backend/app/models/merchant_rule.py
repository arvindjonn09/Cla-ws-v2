import datetime
from sqlalchemy import String, Integer, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class MerchantRule(Base):
    __tablename__ = "merchant_rules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    keyword: Mapped[str] = mapped_column(String(200), nullable=False, unique=True, index=True)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    hit_count: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    created_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime.datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
