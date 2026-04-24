from uuid import UUID
from datetime import datetime, date
from typing import Optional, Literal
from pydantic import BaseModel, field_validator

ALLOWED_CURRENCIES = {"EUR", "USD", "INR", "AUD"}


def _validate_currency(v: str) -> str:
    if v.upper() not in ALLOWED_CURRENCIES:
        raise ValueError(f"Currency must be one of {sorted(ALLOWED_CURRENCIES)}")
    return v.upper()


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
    currency: str = "USD"
    is_shared: bool = False

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, v: str) -> str:
        return _validate_currency(v)


class DebtUpdate(BaseModel):
    name: Optional[str] = None
    debt_type: Optional[Literal[
        "credit_card", "personal_loan", "car_finance", "student_loan",
        "home_loan", "store_account", "personal", "other"
    ]] = None
    payment_type: Optional[Literal["fixed", "variable", "app_decided"]] = None
    original_balance: Optional[float] = None
    current_balance: Optional[float] = None
    minimum_payment: Optional[float] = None
    actual_payment: Optional[float] = None
    payment_frequency: Optional[Literal["weekly", "biweekly", "monthly"]] = None
    has_interest: Optional[bool] = None
    interest_rate: Optional[float] = None
    months_remaining: Optional[int] = None
    payment_day: Optional[str] = None
    currency: Optional[str] = None
    is_shared: Optional[bool] = None
    status: Optional[Literal["active", "cleared", "paused"]] = None

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, v: str | None) -> str | None:
        return _validate_currency(v) if v is not None else None


class DebtOut(DebtCreate):
    id: UUID
    account_id: UUID
    is_locked: bool = False
    shared_from_debt_id: Optional[UUID] = None
    shared_to_account_id: Optional[UUID] = None
    shared_to_debt_id: Optional[UUID] = None
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


class DebtShareToJointOut(BaseModel):
    message: str
    source_debt_id: UUID
    joint_account_id: UUID
    joint_debt_id: UUID
