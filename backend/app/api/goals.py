from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.core.database import get_db
from app.models.goal import Goal
from app.models.account import AccountMember
from app.schemas.goal import GoalCreate, GoalUpdate, GoalOut
from app.api.deps import get_current_user, get_account_member, require_full_member
from app.models.user import User

router = APIRouter(prefix="/api/accounts/{account_id}/goals", tags=["goals"])


@router.get("", response_model=list[GoalOut])
async def list_goals(
    account_id: UUID,
    member: Annotated[AccountMember, Depends(require_full_member)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Goal).where(Goal.account_id == account_id).order_by(Goal.priority))
    return result.scalars().all()


@router.post("", response_model=GoalOut, status_code=201)
async def create_goal(
    account_id: UUID,
    body: GoalCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    member: Annotated[AccountMember, Depends(require_full_member)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    goal = Goal(account_id=account_id, created_by=current_user.id, **body.model_dump())
    db.add(goal)
    await db.commit()
    await db.refresh(goal)
    return goal


@router.patch("/{goal_id}", response_model=GoalOut)
async def update_goal(
    account_id: UUID,
    goal_id: UUID,
    body: GoalUpdate,
    member: Annotated[AccountMember, Depends(require_full_member)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Goal).where(and_(Goal.id == goal_id, Goal.account_id == account_id))
    )
    goal = result.scalar_one_or_none()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(goal, field, value)
    await db.commit()
    await db.refresh(goal)
    return goal


@router.delete("/{goal_id}", status_code=204)
async def delete_goal(
    account_id: UUID,
    goal_id: UUID,
    member: Annotated[AccountMember, Depends(require_full_member)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Goal).where(and_(Goal.id == goal_id, Goal.account_id == account_id))
    )
    goal = result.scalar_one_or_none()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    await db.delete(goal)
    await db.commit()
