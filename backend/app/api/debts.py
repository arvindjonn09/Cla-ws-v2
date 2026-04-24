from datetime import date
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.core.database import get_db
from app.models.debt import Debt, DebtPayment
from app.models.account import Account, AccountMember, UserProfile
from app.schemas.debt import (
    DebtCreate, DebtUpdate, DebtOut,
    DebtPaymentCreate, DebtPaymentOut,
    DebtShareToJointOut, FreedomDateResponse, ExtraPaymentSimulation,
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


MIRRORED_FIELDS = (
    "name",
    "debt_type",
    "payment_type",
    "original_balance",
    "current_balance",
    "minimum_payment",
    "actual_payment",
    "payment_frequency",
    "payment_day",
    "has_interest",
    "interest_rate",
    "months_remaining",
    "status",
    "cleared_at",
    "currency",
    "is_shared",
)


def _copy_debt_fields(source: Debt, target: Debt) -> None:
    for field in MIRRORED_FIELDS:
        setattr(target, field, getattr(source, field))


async def _sync_source_debt(db: AsyncSession, joint_debt: Debt) -> None:
    if not joint_debt.shared_from_debt_id:
        return
    result = await db.execute(select(Debt).where(Debt.id == joint_debt.shared_from_debt_id))
    source = result.scalar_one_or_none()
    if source:
        _copy_debt_fields(joint_debt, source)
        source.is_locked = True
        source.shared_to_account_id = joint_debt.account_id
        source.shared_to_debt_id = joint_debt.id


def _ensure_not_locked_source(debt: Debt) -> None:
    if debt.is_locked and debt.shared_to_debt_id:
        raise HTTPException(
            status_code=400,
            detail="This debt is locked because it is shared to a joint account. Edit it from Shared Debts.",
        )


async def _get_user_joint_account(db: AsyncSession, user_id: UUID) -> Account:
    result = await db.execute(
        select(Account)
        .join(AccountMember, AccountMember.account_id == Account.id)
        .where(
            and_(
                AccountMember.user_id == user_id,
                AccountMember.role == "member",
                AccountMember.status == "active",
                Account.type == "joint",
                Account.status == "active",
            )
        )
        .limit(1)
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=400, detail="You do not have an active joint account to share this debt into")
    return account


@router.get("", response_model=list[DebtOut])
async def list_debts(
    account_id: UUID,
    member: Annotated[AccountMember, Depends(require_full_member)],
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


@router.post("/{debt_id}/share-to-joint", response_model=DebtShareToJointOut)
async def share_debt_to_joint(
    account_id: UUID,
    debt_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    member: Annotated[AccountMember, Depends(require_full_member)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    source = await _get_debt_or_404(db, account_id, debt_id)
    account_result = await db.execute(select(Account).where(Account.id == account_id))
    source_account = account_result.scalar_one_or_none()
    if not source_account or source_account.type != "personal":
        raise HTTPException(status_code=400, detail="Only personal account debts can be shared into a joint account")
    if source.added_by and source.added_by != current_user.id:
        raise HTTPException(status_code=403, detail="Only the debt owner can share this debt")
    if source.shared_to_debt_id and source.shared_to_account_id:
        return DebtShareToJointOut(
            message="Debt is already shared to your joint account.",
            source_debt_id=source.id,
            joint_account_id=source.shared_to_account_id,
            joint_debt_id=source.shared_to_debt_id,
        )

    joint_account = await _get_user_joint_account(db, current_user.id)
    joint_debt = Debt(
        account_id=joint_account.id,
        added_by=current_user.id,
        shared_from_debt_id=source.id,
    )
    _copy_debt_fields(source, joint_debt)
    joint_debt.is_shared = True
    joint_debt.is_locked = False
    db.add(joint_debt)
    await db.flush()

    source.is_shared = True
    source.is_locked = True
    source.shared_to_account_id = joint_account.id
    source.shared_to_debt_id = joint_debt.id
    await db.commit()
    await db.refresh(joint_debt)

    return DebtShareToJointOut(
        message="Debt shared to your joint account.",
        source_debt_id=source.id,
        joint_account_id=joint_account.id,
        joint_debt_id=joint_debt.id,
    )


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
    member: Annotated[AccountMember, Depends(require_full_member)],
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
    _ensure_not_locked_source(debt)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(debt, field, value)

    if body.status == "cleared" and not debt.cleared_at:
        from datetime import datetime, timezone
        debt.cleared_at = datetime.now(timezone.utc)
        debt.current_balance = 0

    await _sync_source_debt(db, debt)
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
    _ensure_not_locked_source(debt)
    if debt.shared_from_debt_id:
        source_result = await db.execute(select(Debt).where(Debt.id == debt.shared_from_debt_id))
        source = source_result.scalar_one_or_none()
        if source:
            source.is_locked = False
            source.shared_to_account_id = None
            source.shared_to_debt_id = None
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
    _ensure_not_locked_source(debt)
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

    await _sync_source_debt(db, debt)
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
