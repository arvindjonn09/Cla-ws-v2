from datetime import datetime, timedelta, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import (
    hash_password, verify_password, create_access_token,
    create_refresh_token, decode_token, generate_token,
)
from app.core.config import settings
from app.core.email import verification_email, password_reset_email
from app.models.user import User, Session
from app.models.account import Account, AccountMember, UserProfile
from app.models.notification import NotificationPreference as NotifPref
from app.schemas.user import (
    UserSignup, UserLogin, TokenResponse, UserOut,
    PasswordResetRequest, PasswordReset, RefreshTokenRequest,
)
from app.services.email_service import queue_email

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/signup", response_model=dict, status_code=status.HTTP_201_CREATED)
async def signup(
    body: UserSignup,
    background_tasks: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    existing = await db.execute(select(User).where(User.email == body.email.lower()))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    verification_token = generate_token()
    expires = datetime.now(timezone.utc) + timedelta(minutes=15)

    user = User(
        email=body.email.lower(),
        password_hash=hash_password(body.password),
        full_name=body.full_name,
        is_verified=False,
        verification_token=verification_token,
        verification_expires_at=expires,
    )
    db.add(user)
    await db.flush()

    # Create personal account
    account = Account(type="personal", base_currency="ZAR")
    db.add(account)
    await db.flush()

    member = AccountMember(account_id=account.id, user_id=user.id, role="member", status="active")
    db.add(member)

    profile = UserProfile(user_id=user.id, account_id=account.id)
    db.add(profile)

    notif = NotifPref(user_id=user.id, account_id=account.id)
    db.add(notif)

    await db.commit()

    verify_url = f"{settings.FRONTEND_URL}/verify?token={verification_token}"
    subject, html = verification_email(user.full_name, verify_url)
    background_tasks.add_task(queue_email, db, user.email, subject, html, "signup", str(account.id), str(user.id))

    return {"message": "Account created. Check your email to verify."}


@router.post("/verify-email")
async def verify_email(token: str, db: Annotated[AsyncSession, Depends(get_db)]):
    result = await db.execute(select(User).where(User.verification_token == token))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid verification token")
    if user.verification_expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Verification token expired")

    user.is_verified = True
    user.verification_token = None
    user.verification_expires_at = None
    await db.commit()
    return {"message": "Email verified. You may now log in."}


@router.post("/login", response_model=TokenResponse)
async def login(body: UserLogin, db: Annotated[AsyncSession, Depends(get_db)]):
    result = await db.execute(select(User).where(User.email == body.email.lower()))
    user = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.is_verified:
        raise HTTPException(status_code=403, detail="Email not verified")

    # Get primary account
    acc_result = await db.execute(
        select(AccountMember).where(
            AccountMember.user_id == user.id,
            AccountMember.status == "active",
        ).limit(1)
    )
    membership = acc_result.scalar_one_or_none()

    payload = {
        "sub": str(user.id),
        "account_id": str(membership.account_id) if membership else None,
        "role": membership.role if membership else "member",
    }

    access_token = create_access_token(payload)
    refresh_token = create_refresh_token(payload)

    session = Session(
        user_id=user.id,
        token=refresh_token,
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(session)
    await db.commit()

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserOut.model_validate(user),
    )


@router.post("/logout")
async def logout(body: RefreshTokenRequest, db: Annotated[AsyncSession, Depends(get_db)]):
    result = await db.execute(select(Session).where(Session.token == body.refresh_token))
    session = result.scalar_one_or_none()
    if session:
        await db.delete(session)
        await db.commit()
    return {"message": "Logged out"}


@router.post("/refresh", response_model=TokenResponse)
async def refresh(body: RefreshTokenRequest, db: Annotated[AsyncSession, Depends(get_db)]):
    payload = decode_token(body.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    result = await db.execute(select(Session).where(Session.token == body.refresh_token))
    session = result.scalar_one_or_none()
    if not session or session.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Refresh token expired")

    user_result = await db.execute(select(User).where(User.id == UUID(payload["sub"])))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    new_payload = {k: v for k, v in payload.items() if k not in ("exp", "type")}
    new_access = create_access_token(new_payload)
    new_refresh = create_refresh_token(new_payload)

    session.token = new_refresh
    session.expires_at = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    await db.commit()

    return TokenResponse(
        access_token=new_access,
        refresh_token=new_refresh,
        user=UserOut.model_validate(user),
    )


@router.post("/forgot-password")
async def forgot_password(
    body: PasswordResetRequest,
    background_tasks: BackgroundTasks,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(User).where(User.email == body.email.lower()))
    user = result.scalar_one_or_none()
    if user:
        token = generate_token()
        user.reset_token = token
        user.reset_token_expires_at = datetime.now(timezone.utc) + timedelta(minutes=15)
        await db.commit()
        reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"
        subject, html = password_reset_email(user.full_name, reset_url)
        background_tasks.add_task(queue_email, db, user.email, subject, html, "password_reset", None, str(user.id))
    # Always return 200 to prevent email enumeration
    return {"message": "If that email exists, a reset link has been sent."}


@router.post("/reset-password")
async def reset_password(body: PasswordReset, db: Annotated[AsyncSession, Depends(get_db)]):
    result = await db.execute(select(User).where(User.reset_token == body.token))
    user = result.scalar_one_or_none()
    if not user or user.reset_token_expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")

    user.password_hash = hash_password(body.new_password)
    user.reset_token = None
    user.reset_token_expires_at = None
    await db.commit()
    return {"message": "Password reset successful"}
