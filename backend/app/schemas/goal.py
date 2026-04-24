from uuid import UUID
from datetime import datetime, date
from typing import Optional, Literal
from pydantic import BaseModel, field_validator

ALLOWED_CURRENCIES = {"EUR", "USD", "INR", "AUD"}


class GoalCreate(BaseModel):
    name: str
    goal_type: Literal[
        "emergency_fund", "debt_payoff", "savings",
        "house_deposit", "holiday", "education", "custom"
    ]
    target_amount: float
    current_amount: float = 0
    currency: str = "USD"

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, v: str) -> str:
        if v.upper() not in ALLOWED_CURRENCIES:
            raise ValueError(f"Currency must be one of {sorted(ALLOWED_CURRENCIES)}")
        return v.upper()
    target_date: Optional[date] = None
    priority: int = 1


class GoalUpdate(BaseModel):
    name: Optional[str] = None
    target_amount: Optional[float] = None
    current_amount: Optional[float] = None
    target_date: Optional[date] = None
    status: Optional[Literal["active", "completed", "paused"]] = None
    priority: Optional[int] = None


class GoalOut(GoalCreate):
    id: UUID
    account_id: UUID
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
