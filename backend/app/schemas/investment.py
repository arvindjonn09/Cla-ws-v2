from uuid import UUID
from datetime import datetime, date
from typing import Optional, Literal
from pydantic import BaseModel, field_validator

ALLOWED_CURRENCIES = {"EUR", "USD", "INR", "AUD"}


class InvestmentSecureDetailsIn(BaseModel):
    account_email: Optional[str] = None
    account_number: Optional[str] = None
    login_id: Optional[str] = None
    secure_notes: Optional[str] = None


class InvestmentCreate(BaseModel):
    name: str
    asset_type: Literal[
        "stocks", "bonds", "mutual_funds", "property", "crypto",
        "fixed_deposit", "retirement", "foreign_cash", "other"
    ]
    currency: str

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, v: str) -> str:
        if v.upper() not in ALLOWED_CURRENCIES:
            raise ValueError(f"Currency must be one of {sorted(ALLOWED_CURRENCIES)}")
        return v.upper()
    units: Optional[float] = None
    purchase_price: Optional[float] = None
    current_price: Optional[float] = None
    current_value: Optional[float] = None
    country: Optional[str] = None
    purchased_at: Optional[date] = None
    visibility: Literal["personal", "shared"] = "personal"
    secure_details: Optional[InvestmentSecureDetailsIn] = None


class InvestmentUpdate(BaseModel):
    name: Optional[str] = None
    asset_type: Optional[Literal[
        "stocks", "bonds", "mutual_funds", "property", "crypto",
        "fixed_deposit", "retirement", "foreign_cash", "other"
    ]] = None
    currency: Optional[str] = None
    current_price: Optional[float] = None
    current_value: Optional[float] = None
    purchase_price: Optional[float] = None
    units: Optional[float] = None
    country: Optional[str] = None
    purchased_at: Optional[date] = None
    visibility: Optional[Literal["personal", "shared"]] = None
    status: Optional[Literal["active", "sold"]] = None
    secure_details: Optional[InvestmentSecureDetailsIn] = None

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, v: str | None) -> str | None:
        if v is None:
            return None
        if v.upper() not in ALLOWED_CURRENCIES:
            raise ValueError(f"Currency must be one of {sorted(ALLOWED_CURRENCIES)}")
        return v.upper()


class InvestmentOut(BaseModel):
    id: UUID
    account_id: UUID
    name: str
    asset_type: str
    currency: str
    units: Optional[float]
    purchase_price: Optional[float]
    current_price: Optional[float]
    current_value: Optional[float]
    base_currency_value: Optional[float]
    country: Optional[str]
    purchased_at: Optional[date]
    visibility: str
    has_secure_details: bool
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PortfolioSummary(BaseModel):
    total_base_currency_value: float
    by_type: dict[str, float]
    by_country: dict[str, float]
    base_currency: str


class SecureCodeRequestOut(BaseModel):
    message: str


class SecureCodeVerifyIn(BaseModel):
    code: str


class InvestmentSecureDetailsOut(InvestmentSecureDetailsIn):
    revealed_until: datetime
