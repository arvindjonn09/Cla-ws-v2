from typing import Annotated, Optional
from uuid import UUID
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.core.database import get_db
from app.models.transaction import Transaction
from app.models.account import AccountMember
from app.schemas.transaction import TransactionCreate, TransactionUpdate, TransactionOut
from app.api.deps import get_current_user, get_account_member, require_full_member
from app.models.user import User

router = APIRouter(prefix="/api/accounts/{account_id}/transactions", tags=["transactions"])


@router.get("", response_model=list[TransactionOut])
async def list_transactions(
    account_id: UUID,
    member: Annotated[AccountMember, Depends(get_account_member)],
    db: Annotated[AsyncSession, Depends(get_db)],
    category: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    limit: int = Query(100, le=500),
    offset: int = Query(0),
):
    query = select(Transaction).where(Transaction.account_id == account_id)
    if category:
        query = query.where(Transaction.category == category)
    if type:
        query = query.where(Transaction.type == type)
    if from_date:
        query = query.where(Transaction.transaction_date >= from_date)
    if to_date:
        query = query.where(Transaction.transaction_date <= to_date)
    query = query.order_by(Transaction.transaction_date.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("", response_model=TransactionOut, status_code=201)
async def create_transaction(
    account_id: UUID,
    body: TransactionCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    member: Annotated[AccountMember, Depends(require_full_member)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    tx = Transaction(account_id=account_id, user_id=current_user.id, **body.model_dump())
    db.add(tx)
    await db.commit()
    await db.refresh(tx)
    return tx


@router.patch("/{transaction_id}", response_model=TransactionOut)
async def update_transaction(
    account_id: UUID,
    transaction_id: UUID,
    body: TransactionUpdate,
    member: Annotated[AccountMember, Depends(require_full_member)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Transaction).where(
            and_(Transaction.id == transaction_id, Transaction.account_id == account_id)
        )
    )
    tx = result.scalar_one_or_none()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(tx, field, value)
    await db.commit()
    await db.refresh(tx)
    return tx


@router.delete("/{transaction_id}", status_code=204)
async def delete_transaction(
    account_id: UUID,
    transaction_id: UUID,
    member: Annotated[AccountMember, Depends(require_full_member)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Transaction).where(
            and_(Transaction.id == transaction_id, Transaction.account_id == account_id)
        )
    )
    tx = result.scalar_one_or_none()
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
    await db.delete(tx)
    await db.commit()
