from datetime import datetime, timedelta, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.core.database import get_db
from app.core.security import generate_token
from app.models.user import User
from app.models.account import Account, AccountMember, UserProfile, InviteToken, JointFormation
from app.schemas.account import (
    AccountCreate, AccountOut, MemberOut, InviteCreate,
    UserProfileCreate, UserProfileOut, AccountMembershipOut,
)
from app.api.deps import get_current_user, get_account_member, require_full_member
from app.core.config import settings
from app.core.email import joint_invite_email, joint_formed_email
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
    member = AccountMember(account_id=account.id, user_id=current_user.id, role="member", status="active")
    db.add(member)
    profile = UserProfile(user_id=current_user.id, account_id=account.id)
    db.add(profile)
    await db.commit()
    await db.refresh(account)
    return account


@router.get("/mine", response_model=list[AccountMembershipOut])
async def list_my_accounts(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(AccountMember, Account)
        .join(Account, Account.id == AccountMember.account_id)
        .where(
            AccountMember.user_id == current_user.id,
            AccountMember.status == "active",
            Account.status == "active",
        )
        .order_by(Account.type == "joint", AccountMember.joined_at)
    )
    return [
        {
            "account": account,
            "role": membership.role,
            "status": membership.status,
            "joined_at": membership.joined_at,
        }
        for membership, account in result.all()
    ]


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
    if account.type != "joint":
        raise HTTPException(status_code=400, detail="Invitations can only be sent for joint accounts")

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


@router.get("/{account_id}/members", response_model=list[MemberOut])
async def list_members(
    account_id: UUID,
    member: Annotated[AccountMember, Depends(get_account_member)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(AccountMember, User)
        .join(User, User.id == AccountMember.user_id)
        .where(
            AccountMember.account_id == account_id,
            AccountMember.status.in_(["active", "pending"]),
        )
        .order_by(AccountMember.joined_at)
    )
    return [
        {
            "id": membership.id,
            "user_id": membership.user_id,
            "email": user.email,
            "full_name": user.full_name,
            "role": membership.role,
            "status": membership.status,
            "joined_at": membership.joined_at,
        }
        for membership, user in result.all()
    ]


@router.post("/accept-invite")
async def accept_invite(
    token: str,
    background_tasks: BackgroundTasks,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(InviteToken).where(InviteToken.token == token))
    invite = result.scalar_one_or_none()
    if not invite:
        raise HTTPException(status_code=400, detail="Invalid invite token")
    if invite.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Invite token has expired")
    if invite.status != "pending":
        raise HTTPException(status_code=400, detail="Invite already used or cancelled")
    if invite.email.lower() != current_user.email.lower():
        raise HTTPException(status_code=403, detail="This invite was sent to a different email address")

    # Viewer rule: viewers can never become members (business rule)
    if invite.role == "member":
        existing_viewer = await db.execute(
            select(AccountMember).where(
                AccountMember.account_id == invite.account_id,
                AccountMember.user_id == current_user.id,
                AccountMember.role == "viewer",
            )
        )
        if existing_viewer.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Viewers cannot become members (Business Rule #7)")

    # Check not already a member
    existing = await db.execute(
        select(AccountMember).where(
            AccountMember.account_id == invite.account_id,
            AccountMember.user_id == current_user.id,
            AccountMember.status == "active",
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="You are already a member of this account")

    # Verify the target account is a joint account
    acc_result = await db.execute(select(Account).where(Account.id == invite.account_id))
    account = acc_result.scalar_one_or_none()
    if not account or account.type != "joint":
        raise HTTPException(status_code=400, detail="This invite is for an account that is no longer valid")

    # Enforce one joint per user (business rule)
    if invite.role == "member":
        existing_joint = await db.execute(
            select(AccountMember)
            .join(Account, Account.id == AccountMember.account_id)
            .where(
                AccountMember.user_id == current_user.id,
                AccountMember.role == "member",
                AccountMember.status == "active",
                Account.type == "joint",
                Account.status == "active",
            )
        )
        if existing_joint.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="You already have an active joint account")

    new_member = AccountMember(
        account_id=invite.account_id,
        user_id=current_user.id,
        role=invite.role,
        status="active",
    )
    db.add(new_member)
    db.add(UserProfile(user_id=current_user.id, account_id=invite.account_id))
    invite.status = "accepted"

    # When a full member joins, lock in the formation record and notify both members
    if invite.role == "member":
        db.add(JointFormation(
            account_id=invite.account_id,
            member_1_id=invite.invited_by,
            member_2_id=current_user.id,
        ))
        # Fetch inviter to get their name/email for the notification
        inviter_result = await db.execute(select(User).where(User.id == invite.invited_by))
        inviter = inviter_result.scalar_one_or_none()
        if inviter:
            account_id_str = str(invite.account_id)
            app_url = settings.FRONTEND_URL
            # Email to the inviter (member 1)
            subj1, html1 = joint_formed_email(inviter.full_name, current_user.email, account_id_str, app_url)
            background_tasks.add_task(
                queue_email, db, inviter.email, subj1, html1, "joint_formed", account_id_str, str(inviter.id)
            )
            # Email to the acceptor (member 2)
            subj2, html2 = joint_formed_email(current_user.full_name, inviter.email, account_id_str, app_url)
            background_tasks.add_task(
                queue_email, db, current_user.email, subj2, html2, "joint_formed", account_id_str, str(current_user.id)
            )

    await db.commit()
    await db.refresh(new_member)

    return {"message": "Invite accepted", "account_id": str(invite.account_id), "role": invite.role}


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
    current_user: Annotated[User, Depends(get_current_user)],
    member: Annotated[AccountMember, Depends(require_full_member)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Account).where(Account.id == account_id))
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    if account.type == "joint":
        if account.close_requested_by is None:
            # First member requests close
            account.close_requested_by = current_user.id
            await db.commit()
            return {"message": "Close request submitted. The other member must also confirm to close the account.", "pending": True}

        if account.close_requested_by == current_user.id:
            # Same member calling again — cancel the request
            account.close_requested_by = None
            await db.commit()
            return {"message": "Close request cancelled.", "pending": False}

        # Second member confirms — close the account
        account.status = "closed"
        account.close_requested_by = None
        await db.commit()
        return {"message": "Joint account closed.", "pending": False}

    # Personal account — close immediately
    account.status = "closed"
    await db.commit()
    return {"message": "Account closed.", "pending": False}


# ── Joint repair ──────────────────────────────────────────────────────────────

@router.post("/{account_id}/repair-joint")
async def repair_joint_account(
    account_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Restore account_members from joint_formations when records go missing or corrupt."""
    result = await db.execute(
        select(JointFormation).where(JointFormation.account_id == account_id)
    )
    formation = result.scalar_one_or_none()
    if not formation:
        raise HTTPException(status_code=404, detail="No formation record found — only works for accounts formed after this feature was deployed")

    if current_user.id not in (formation.member_1_id, formation.member_2_id):
        raise HTTPException(status_code=403, detail="Not authorised to repair this account")

    repaired: list[str] = []
    for user_id in [formation.member_1_id, formation.member_2_id]:
        # Fix or create account_members row
        existing = await db.execute(
            select(AccountMember).where(
                AccountMember.account_id == account_id,
                AccountMember.user_id == user_id,
            )
        )
        member = existing.scalar_one_or_none()
        if member:
            if member.status != "active" or member.role != "member":
                member.status = "active"
                member.role = "member"
                repaired.append(f"{user_id} fixed")
        else:
            db.add(AccountMember(account_id=account_id, user_id=user_id, role="member", status="active"))
            repaired.append(f"{user_id} created")

        # Create UserProfile if missing
        profile_result = await db.execute(
            select(UserProfile).where(
                UserProfile.account_id == account_id,
                UserProfile.user_id == user_id,
            )
        )
        if not profile_result.scalar_one_or_none():
            db.add(UserProfile(user_id=user_id, account_id=account_id))

    await db.commit()
    return {"account_id": str(account_id), "repaired": repaired or ["nothing to fix — already healthy"]}


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
