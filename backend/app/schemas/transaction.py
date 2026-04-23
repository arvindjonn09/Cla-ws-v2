from uuid import UUID
from datetime import datetime, date
from typing import Optional, Literal
from pydantic import BaseModel


class TransactionCreate(BaseModel):
    amount: float
    type: Literal["income", "expense", "transfer", "debt_payment"]
    category: Optional[str] = None
    subcategory: Optional[str] = None
    description: Optional[str] = None
    transaction_date: date
    currency: str = "ZAR"
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
