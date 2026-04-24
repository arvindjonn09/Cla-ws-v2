from uuid import UUID
from datetime import datetime, date
from typing import Optional, Literal
from pydantic import BaseModel, field_validator

ALLOWED_CURRENCIES = {"EUR", "USD", "INR", "AUD"}


class TransactionCreate(BaseModel):
    amount: float
    type: Literal["income", "expense", "transfer", "debt_payment"]
    category: Optional[str] = None
    subcategory: Optional[str] = None
    description: Optional[str] = None
    transaction_date: date
    currency: str = "USD"

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, v: str) -> str:
        if v.upper() not in ALLOWED_CURRENCIES:
            raise ValueError(f"Currency must be one of {sorted(ALLOWED_CURRENCIES)}")
        return v.upper()
    is_shared: bool = False
    split_type: Optional[Literal["shared", "personal", "grey"]] = None


class TransactionUpdate(BaseModel):
    amount: Optional[float] = None
    category: Optional[str] = None
    description: Optional[str] = None
    transaction_date: Optional[date] = None


class TransactionOut(TransactionCreate):
    id: UUID
    account_id: UUID
    user_id: Optional[UUID]
    created_at: datetime

    model_config = {"from_attributes": True}
