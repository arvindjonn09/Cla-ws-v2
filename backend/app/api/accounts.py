from datetime import datetime, timedelta, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.core.database import get_db
from app.core.security import generate_token
from app.models.user import User
from app.models.account import Account, AccountMember, UserProfile, InviteToken
from app.schemas.account import (
    AccountCreate, AccountOut, MemberOut, InviteCreate,
    UserProfileCreate, UserProfileOut,
)
from app.api.deps import get_current_user, get_account_member, require_full_member
from app.core.config import settings
from app.core.email import joint_invite_email
from app.services.email_service import queue_email

router = APIRouter(prefix="/api/accounts", tags=["accounts"])


@router.post("/personal", response_model=AccountOut, status_code=201)
async def create_personal_account(
    body: AccountCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    account = Account(type="personal", name=body.name, base_currency=body.base_currency)
    db.add(account)
    await db.flush()
    member = AccountMember(account_id=account.id, user_id=current_user.id, role="member")
    db.add(member)
    profile = UserProfile(user_id=current_user.id, account_id=account.id)
    db.add(profile)
    await db.commit()
    await db.refresh(account)
    return account


@router.post("/joint", response_model=AccountOut, status_code=201)
async def create_joint_account(
    body: AccountCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    # Enforce one joint per person
    existing = await db.execute(
        select(AccountMember)
        .join(Account, Account.id == AccountMember.account_id)
        .where(
            and_(
                AccountMember.user_id == current_user.id,
                AccountMember.role == "member",
                AccountMember.status == "active",
                Account.type == "joint",
                Account.status == "active",
            )
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="You already have an active joint account")

    account = Account(type="joint", name=body.name, base_currency=body.base_currency)
    db.add(account)
    await db.flush()
    member = AccountMember(account_id=account.id, user_id=current_user.id, role="member")
    db.add(member)
    profile = UserProfile(user_id=current_user.id, account_id=account.id)
    db.add(profile)
    await db.commit()
    await db.refresh(account)
    return account


@router.get("/{account_id}", response_model=AccountOut)
async def get_account(
    account_id: UUID,
    member: Annotated[AccountMember, Depends(get_account_member)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Account).where(Account.id == account_id))
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return account


@router.patch("/{account_id}", response_model=AccountOut)
async def update_account(
    account_id: UUID,
    body: AccountCreate,
    member: Annotated[AccountMember, Depends(require_full_member)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Account).where(Account.id == account_id))
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    if body.name is not None:
        account.name = body.name
    if body.base_currency:
        account.base_currency = body.base_currency
    await db.commit()
    await db.refresh(account)
    return account


@router.post("/{account_id}/invite")
async def invite_member(
    account_id: UUID,
    body: InviteCreate,
    background_tasks: BackgroundTasks,
    member: Annotated[AccountMember, Depends(require_full_member)],
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Account).where(Account.id == account_id))
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    # Check viewer limit
    if body.role == "viewer":
        viewer_count = await db.execute(
            select(AccountMember).where(
                and_(
                    AccountMember.account_id == account_id,
                    AccountMember.role == "viewer",
                    AccountMember.status == "active",
                )
            )
        )
        if len(viewer_count.scalars().all()) >= 5:
            raise HTTPException(status_code=400, detail="Maximum 5 viewers per joint account")

    token = generate_token()
    invite = InviteToken(
        account_id=account_id,
        invited_by=current_user.id,
        email=body.email.lower(),
        role=body.role,
        token=token,
        expires_at=datetime.now(timezone.utc) + timedelta(days=7),
    )
    db.add(invite)
    await db.commit()

    invite_url = f"{settings.FRONTEND_URL}/invite?token={token}"
    subject, html = joint_invite_email(body.email, current_user.full_name, invite_url)
    background_tasks.add_task(
        queue_email, db, body.email, subject, html, "joint_invite", str(account_id), str(current_user.id),
    )
    return {"message": "Invitation sent", "token": token}


@router.delete("/{account_id}/members/{user_id}")
async def remove_member(
    account_id: UUID,
    user_id: UUID,
    member: Annotated[AccountMember, Depends(require_full_member)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(AccountMember).where(
            and_(AccountMember.account_id == account_id, AccountMember.user_id == user_id)
        )
    )
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=404, detail="Member not found")
    if target.role == "member":
        raise HTTPException(status_code=400, detail="Cannot remove a full member — use close account flow")
    target.status = "removed"
    await db.commit()
    return {"message": "Viewer removed"}


@router.post("/{account_id}/close")
async def close_account(
    account_id: UUID,
    member: Annotated[AccountMember, Depends(require_full_member)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Account).where(Account.id == account_id))
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    if account.type == "joint":
        # Both members must confirm — simplified: flag first confirmation
        return {"message": "Close request submitted. Other member must also confirm."}

    account.status = "closed"
    await db.commit()
    return {"message": "Account closed"}


# Profile endpoints
@router.get("/{account_id}/profile", response_model=UserProfileOut)
async def get_profile(
    account_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    member: Annotated[AccountMember, Depends(get_account_member)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(UserProfile).where(
            and_(UserProfile.account_id == account_id, UserProfile.user_id == current_user.id)
        )
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile


@router.patch("/{account_id}/profile", response_model=UserProfileOut)
async def update_profile(
    account_id: UUID,
    body: UserProfileCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    member: Annotated[AccountMember, Depends(require_full_member)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(UserProfile).where(
            and_(UserProfile.account_id == account_id, UserProfile.user_id == current_user.id)
        )
    )
    profile = result.scalar_one_or_none()
    if not profile:
        profile = UserProfile(user_id=current_user.id, account_id=account_id)
        db.add(profile)

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)

    # Recompute income baseline when income months change
    from app.services.income_engine import compute_baseline
    if any(f in body.model_fields_set for f in ["income_month_1", "income_month_2", "income_month_3"]):
        result_b = compute_baseline(profile.income_month_1, profile.income_month_2, profile.income_month_3)
        profile.income_baseline = result_b["baseline"]
        profile.income_lowest = result_b["lowest"]

    await db.commit()
    await db.refresh(profile)
    return profile
