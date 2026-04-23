from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func

from app.core.database import get_db
from app.models.investment import Investment, ExchangeRate
from app.models.account import Account, AccountMember
from app.schemas.investment import InvestmentCreate, InvestmentUpdate, InvestmentOut, PortfolioSummary
from app.api.deps import get_current_user, get_account_member, require_full_member
from app.models.user import User

router = APIRouter(prefix="/api/accounts/{account_id}/investments", tags=["investments"])


@router.get("", response_model=list[InvestmentOut])
async def list_investments(
    account_id: UUID,
    member: Annotated[AccountMember, Depends(get_account_member)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Investment).where(and_(Investment.account_id == account_id, Investment.status == "active"))
    )
    return result.scalars().all()


@router.post("", response_model=InvestmentOut, status_code=201)
async def create_investment(
    account_id: UUID,
    body: InvestmentCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    member: Annotated[AccountMember, Depends(require_full_member)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    inv = Investment(account_id=account_id, added_by=current_user.id, **body.model_dump())
    db.add(inv)
    await db.commit()
    await db.refresh(inv)
    return inv


@router.patch("/{investment_id}", response_model=InvestmentOut)
async def update_investment(
    account_id: UUID,
    investment_id: UUID,
    body: InvestmentUpdate,
    member: Annotated[AccountMember, Depends(require_full_member)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Investment).where(and_(Investment.id == investment_id, Investment.account_id == account_id))
    )
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Investment not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(inv, field, value)
    await db.commit()
    await db.refresh(inv)
    return inv


@router.delete("/{investment_id}", status_code=204)
async def delete_investment(
    account_id: UUID,
    investment_id: UUID,
    member: Annotated[AccountMember, Depends(require_full_member)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Investment).where(and_(Investment.id == investment_id, Investment.account_id == account_id))
    )
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Investment not found")
    await db.delete(inv)
    await db.commit()


@router.get("/portfolio", response_model=PortfolioSummary)
async def portfolio_summary(
    account_id: UUID,
    member: Annotated[AccountMember, Depends(get_account_member)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Investment).where(and_(Investment.account_id == account_id, Investment.status == "active"))
    )
    investments = result.scalars().all()

    account_result = await db.execute(select(Account).where(Account.id == account_id))
    account = account_result.scalar_one()

    total = sum(float(i.base_currency_value or i.current_value or 0) for i in investments)
    by_type: dict[str, float] = {}
    by_country: dict[str, float] = {}

    for inv in investments:
        val = float(inv.base_currency_value or inv.current_value or 0)
        by_type[inv.asset_type] = round(by_type.get(inv.asset_type, 0) + val, 2)
        if inv.country:
            by_country[inv.country] = round(by_country.get(inv.country, 0) + val, 2)

    return PortfolioSummary(
        total_base_currency_value=round(total, 2),
        by_type=by_type,
        by_country=by_country,
        base_currency=account.base_currency,
    )
