from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.core.database import get_db
from app.models.notification import JointScenario
from app.models.account import AccountMember
from app.api.deps import get_current_user, get_account_member, require_full_member
from app.models.user import User

router = APIRouter(prefix="/api/accounts/{account_id}/scenarios", tags=["joint"])


class ScenarioCreate(BaseModel):
    title: str
    description: str | None = None
    scenario_data: dict[str, Any] | None = None


class ScenarioOut(ScenarioCreate):
    id: UUID
    account_id: UUID
    status: str

    model_config = {"from_attributes": True}


@router.get("", response_model=list[ScenarioOut])
async def list_scenarios(
    account_id: UUID,
    member: Annotated[AccountMember, Depends(get_account_member)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(JointScenario).where(JointScenario.account_id == account_id))
    return result.scalars().all()


@router.post("", response_model=ScenarioOut, status_code=201)
async def create_scenario(
    account_id: UUID,
    body: ScenarioCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    member: Annotated[AccountMember, Depends(require_full_member)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    scenario = JointScenario(account_id=account_id, created_by=current_user.id, **body.model_dump())
    db.add(scenario)
    await db.commit()
    await db.refresh(scenario)
    return scenario
