from uuid import UUID
from datetime import datetime, date
from typing import Optional, Literal
from pydantic import BaseModel


class DebtCreate(BaseModel):
    name: str
    debt_type: Literal[
        "credit_card", "personal_loan", "car_finance", "student_loan",
        "home_loan", "store_account", "personal", "other"
    ]
    payment_type: Optional[Literal["fixed", "variable", "app_decided"]] = None
    original_balance: float
    current_balance: float
    minimum_payment: Optional[float] = None
    actual_payment: Optional[float] = None
    payment_frequency: Optional[Literal["weekly", "biweekly", "monthly"]] = None
    payment_day: Optional[str] = None
    has_interest: bool = False
    interest_rate: Optional[float] = None
    months_remaining: Optional[int] = None
    currency: str = "ZAR"
    is_shared: bool = False


class DebtUpdate(BaseModel):
    name: Optional[str] = None
    current_balance: Optional[float] = None
    actual_payment: Optional[float] = None
    interest_rate: Optional[float] = None
    months_remaining: Optional[int] = None
    status: Optional[Literal["active", "cleared", "paused"]] = None


class DebtOut(DebtCreate):
    id: UUID
    account_id: UUID
    status: str
    cleared_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DebtPaymentCreate(BaseModel):
    amount: float
    extra_amount: float = 0
    payment_date: date
    due_date: Optional[date] = None
    notes: Optional[str] = None


class DebtPaymentOut(DebtPaymentCreate):
    id: UUID
    debt_id: UUID
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class FreedomDateResult(BaseModel):
    method: str
    freedom_date: Optional[date]
    months_remaining: int
    total_interest_paid: float


class FreedomDateResponse(BaseModel):
    snowball: FreedomDateResult
    avalanche: FreedomDateResult
    custom: FreedomDateResult
    recommended_method: str


class ExtraPaymentSimulation(BaseModel):
    extra_monthly: float
    new_freedom_date: Optional[date]
    months_saved: int
    interest_saved: float
