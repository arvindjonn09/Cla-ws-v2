from uuid import UUID
from datetime import datetime, date
from typing import Optional, Literal
from pydantic import BaseModel


class InvestmentCreate(BaseModel):
    name: str
    asset_type: Literal[
        "stocks", "bonds", "mutual_funds", "property", "crypto",
        "fixed_deposit", "retirement", "foreign_cash", "other"
    ]
    currency: str
    units: Optional[float] = None
    purchase_price: Optional[float] = None
    current_price: Optional[float] = None
    current_value: Optional[float] = None
    country: Optional[str] = None
    purchased_at: Optional[date] = None


class InvestmentUpdate(BaseModel):
    current_price: Optional[float] = None
    current_value: Optional[float] = None
    units: Optional[float] = None
    status: Optional[Literal["active", "sold"]] = None


class InvestmentOut(InvestmentCreate):
    id: UUID
    account_id: UUID
    base_currency_value: Optional[float]
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PortfolioSummary(BaseModel):
    total_base_currency_value: float
    by_type: dict[str, float]
    by_country: dict[str, float]
    base_currency: str
