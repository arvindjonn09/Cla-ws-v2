from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.core.database import get_db
from app.models.notification import PaymentWarning
from app.models.account import AccountMember
from app.api.deps import get_current_user, get_account_member, require_full_member
from app.models.user import User

router = APIRouter(prefix="/api/accounts/{account_id}/payment-warnings", tags=["joint"])


@router.get("")
async def list_warnings(
    account_id: UUID,
    member: Annotated[AccountMember, Depends(get_account_member)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(PaymentWarning).where(PaymentWarning.account_id == account_id).order_by(PaymentWarning.due_date)
    )
    return result.scalars().all()


@router.post("/{warning_id}/confirm")
async def confirm_warning(
    account_id: UUID,
    warning_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    member: Annotated[AccountMember, Depends(require_full_member)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(PaymentWarning).where(
            and_(PaymentWarning.id == warning_id, PaymentWarning.account_id == account_id)
        )
    )
    warning = result.scalar_one_or_none()
    if not warning:
        raise HTTPException(status_code=404, detail="Warning not found")

    # Determine which member position this user holds
    members_result = await db.execute(
        select(AccountMember).where(
            and_(AccountMember.account_id == account_id, AccountMember.role == "member", AccountMember.status == "active")
        ).order_by(AccountMember.joined_at)
    )
    members = members_result.scalars().all()

    if members and members[0].user_id == current_user.id:
        warning.member_a_confirmed = True
    else:
        warning.member_b_confirmed = True

    await db.commit()
    return {"member_a_confirmed": warning.member_a_confirmed, "member_b_confirmed": warning.member_b_confirmed}
