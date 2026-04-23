from datetime import date
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.core.database import get_db
from app.models.debt import Debt, DebtPayment
from app.models.account import AccountMember, UserProfile
from app.schemas.debt import (
    DebtCreate, DebtUpdate, DebtOut,
    DebtPaymentCreate, DebtPaymentOut,
    FreedomDateResponse, ExtraPaymentSimulation,
)
from app.api.deps import get_current_user, get_account_member, require_full_member
from app.models.user import User
from app.services.freedom_date import compute_freedom_date
from app.services.debt_engine import simulate_extra_payment, DebtSnapshot, snowball_plan, avalanche_plan

router = APIRouter(prefix="/api/accounts/{account_id}/debts", tags=["debts"])


async def _get_debt_or_404(db: AsyncSession, account_id: UUID, debt_id: UUID) -> Debt:
    result = await db.execute(
        select(Debt).where(and_(Debt.id == debt_id, Debt.account_id == account_id))
    )
    debt = result.scalar_one_or_none()
    if not debt:
        raise HTTPException(status_code=404, detail="Debt not found")
    return debt


@router.get("", response_model=list[DebtOut])
async def list_debts(
    account_id: UUID,
    member: Annotated[AccountMember, Depends(get_account_member)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Debt).where(Debt.account_id == account_id))
    return result.scalars().all()


@router.post("", response_model=DebtOut, status_code=201)
async def create_debt(
    account_id: UUID,
    body: DebtCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    member: Annotated[AccountMember, Depends(require_full_member)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    debt = Debt(account_id=account_id, added_by=current_user.id, **body.model_dump())
    db.add(debt)
    await db.commit()
    await db.refresh(debt)
    return debt


@router.get("/freedom-date", response_model=FreedomDateResponse)
async def freedom_date(
    account_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    member: Annotated[AccountMember, Depends(get_account_member)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Debt).where(and_(Debt.account_id == account_id, Debt.status == "active")))
    debts = result.scalars().all()

    profile_result = await db.execute(
        select(UserProfile).where(
            and_(UserProfile.account_id == account_id, UserProfile.user_id == current_user.id)
        )
    )
    profile = profile_result.scalar_one_or_none()
    preferred = (profile.debt_method if profile else "snowball") or "snowball"

    debt_dicts = [
        {
            "id": str(d.id), "name": d.name, "current_balance": float(d.current_balance),
            "actual_payment": float(d.actual_payment or d.minimum_payment or 0),
            "minimum_payment": float(d.minimum_payment or 0),
            "interest_rate": float(d.interest_rate or 0),
            "currency": d.currency, "status": d.status,
        }
        for d in debts
    ]

    return compute_freedom_date(debt_dicts, preferred)


@router.get("/{debt_id}", response_model=DebtOut)
async def get_debt(
    account_id: UUID,
    debt_id: UUID,
    member: Annotated[AccountMember, Depends(get_account_member)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return await _get_debt_or_404(db, account_id, debt_id)


@router.patch("/{debt_id}", response_model=DebtOut)
async def update_debt(
    account_id: UUID,
    debt_id: UUID,
    body: DebtUpdate,
    member: Annotated[AccountMember, Depends(require_full_member)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    debt = await _get_debt_or_404(db, account_id, debt_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(debt, field, value)

    if body.status == "cleared" and not debt.cleared_at:
        from datetime import datetime, timezone
        debt.cleared_at = datetime.now(timezone.utc)
        debt.current_balance = 0

    await db.commit()
    await db.refresh(debt)
    return debt


@router.delete("/{debt_id}", status_code=204)
async def delete_debt(
    account_id: UUID,
    debt_id: UUID,
    member: Annotated[AccountMember, Depends(require_full_member)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    debt = await _get_debt_or_404(db, account_id, debt_id)
    await db.delete(debt)
    await db.commit()


@router.post("/{debt_id}/payments", response_model=DebtPaymentOut, status_code=201)
async def log_payment(
    account_id: UUID,
    debt_id: UUID,
    body: DebtPaymentCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    member: Annotated[AccountMember, Depends(require_full_member)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    debt = await _get_debt_or_404(db, account_id, debt_id)
    payment = DebtPayment(
        debt_id=debt_id,
        account_id=account_id,
        paid_by=current_user.id,
        **body.model_dump(),
    )
    db.add(payment)

    # Update debt balance
    total_paid = body.amount + body.extra_amount
    debt.current_balance = max(0, float(debt.current_balance) - total_paid)

    if debt.current_balance <= 0.01:
        from datetime import datetime, timezone
        debt.current_balance = 0
        debt.status = "cleared"
        debt.cleared_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(payment)
    return payment


@router.post("/{debt_id}/simulate")
async def simulate_payment(
    account_id: UUID,
    debt_id: UUID,
    extra_monthly: float,
    current_user: Annotated[User, Depends(get_current_user)],
    member: Annotated[AccountMember, Depends(get_account_member)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Debt).where(and_(Debt.account_id == account_id, Debt.status == "active")))
    debts = result.scalars().all()

    snapshots = [
        DebtSnapshot(
            id=str(d.id), name=d.name,
            current_balance=float(d.current_balance),
            monthly_payment=float(d.actual_payment or d.minimum_payment or 0),
            interest_rate=float(d.interest_rate or 0),
        )
        for d in debts
    ]

    profile_result = await db.execute(
        select(UserProfile).where(and_(UserProfile.account_id == account_id, UserProfile.user_id == current_user.id))
    )
    profile = profile_result.scalar_one_or_none()
    method = (profile.debt_method if profile else "snowball") or "snowball"

    return simulate_extra_payment(snapshots, method, None, extra_monthly, date.today())
