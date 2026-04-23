from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.core.database import get_db
from app.models.notification import SafeSpaceMessage
from app.models.account import AccountMember
from app.api.deps import get_current_user, get_account_member, require_full_member
from app.models.user import User
from pydantic import BaseModel

router = APIRouter(prefix="/api/accounts/{account_id}", tags=["joint"])


class SafeSpaceCreate(BaseModel):
    message: str


@router.get("/safe-space")
async def get_messages(
    account_id: UUID,
    member: Annotated[AccountMember, Depends(require_full_member)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(SafeSpaceMessage).where(SafeSpaceMessage.account_id == account_id).order_by(SafeSpaceMessage.sent_at.desc()).limit(50)
    )
    return result.scalars().all()


@router.post("/safe-space", status_code=201)
async def send_message(
    account_id: UUID,
    body: SafeSpaceCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    member: Annotated[AccountMember, Depends(require_full_member)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    msg = SafeSpaceMessage(account_id=account_id, sender_id=current_user.id, message=body.message)
    db.add(msg)
    await db.commit()
    return {"message": "Sent"}
