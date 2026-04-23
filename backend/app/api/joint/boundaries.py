from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.core.database import get_db
from app.models.notification import SpendingBoundary
from app.models.account import AccountMember
from app.api.deps import get_account_member, require_full_member

router = APIRouter(prefix="/api/accounts/{account_id}/boundaries", tags=["joint"])


class BoundaryCreate(BaseModel):
    category: str
    classification: str
    split_method: str | None = None
    member_a_percentage: float | None = None
    member_b_percentage: float | None = None
    notes: str | None = None


class BoundaryOut(BoundaryCreate):
    id: UUID
    account_id: UUID

    model_config = {"from_attributes": True}


@router.get("", response_model=list[BoundaryOut])
async def list_boundaries(
    account_id: UUID,
    member: Annotated[AccountMember, Depends(get_account_member)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(SpendingBoundary).where(SpendingBoundary.account_id == account_id))
    return result.scalars().all()


@router.post("", response_model=BoundaryOut, status_code=201)
async def create_boundary(
    account_id: UUID,
    body: BoundaryCreate,
    member: Annotated[AccountMember, Depends(require_full_member)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    boundary = SpendingBoundary(account_id=account_id, **body.model_dump())
    db.add(boundary)
    await db.commit()
    await db.refresh(boundary)
    return boundary
