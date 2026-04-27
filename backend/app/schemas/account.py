from uuid import UUID
from datetime import datetime
from typing import Optional, Literal
from pydantic import BaseModel, EmailStr, field_validator

ALLOWED_CURRENCIES = {"EUR", "USD", "INR", "AUD"}


class AccountCreate(BaseModel):
    name: Optional[str] = None
    base_currency: str = "USD"

    @field_validator("base_currency")
    @classmethod
    def validate_currency(cls, v: str) -> str:
        if v.upper() not in ALLOWED_CURRENCIES:
            raise ValueError(f"Currency must be one of {sorted(ALLOWED_CURRENCIES)}")
        return v.upper()


class AccountOut(BaseModel):
    id: UUID
    type: str
    name: Optional[str]
    base_currency: str
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class MemberOut(BaseModel):
    id: UUID
    user_id: UUID
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    role: str
    status: str
    joined_at: datetime

    model_config = {"from_attributes": True}


class AccountMembershipOut(BaseModel):
    account: AccountOut
    role: str
    status: str
    joined_at: datetime

    model_config = {"from_attributes": True}


class InviteCreate(BaseModel):
    email: EmailStr
    role: Literal["member", "viewer"] = "member"


class UserProfileCreate(BaseModel):
    country: Optional[str] = None
    city: Optional[str] = None
    local_currency: Optional[str] = None
    income_type: Optional[Literal["fixed", "casual", "variable", "multiple"]] = None
    pay_frequency: Optional[Literal["weekly", "biweekly", "monthly", "irregular"]] = None
    pay_day: Optional[str] = None
    income_month_1: Optional[float] = None
    income_month_2: Optional[float] = None
    income_month_3: Optional[float] = None
    financial_situation: Optional[str] = None
    primary_goal: Optional[str] = None
    debt_method: Optional[Literal["snowball", "avalanche", "custom"]] = "snowball"
    motivation_style: Optional[Literal["disciplined", "motivation_driven"]] = None
    spending_personality: Optional[str] = None
    onboarding_complete: Optional[bool] = None


class UserProfileOut(UserProfileCreate):
    id: UUID
    user_id: UUID
    account_id: UUID
    income_baseline: Optional[float] = None
    income_lowest: Optional[float] = None
    created_at: datetime

    model_config = {"from_attributes": True}
