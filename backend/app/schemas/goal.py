from uuid import UUID
from datetime import datetime, date
from typing import Optional, Literal
from pydantic import BaseModel


class GoalCreate(BaseModel):
    name: str
    goal_type: Literal[
        "emergency_fund", "debt_payoff", "savings",
        "house_deposit", "holiday", "education", "custom"
    ]
    target_amount: float
    current_amount: float = 0
    currency: str = "ZAR"
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
