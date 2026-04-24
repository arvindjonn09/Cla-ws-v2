from typing import Annotated
from datetime import datetime, timedelta, timezone
import secrets
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_

from app.core.database import get_db
from app.core.crypto import decrypt_json, encrypt_json
from app.core.email import investment_secure_code_email
from app.core.security import hash_password, verify_password
from app.models.investment import (
    Investment,
    InvestmentSecureAccessLog,
    InvestmentSecureCode,
    InvestmentSecureDetails,
)
from app.models.account import Account, AccountMember
from app.schemas.investment import (
    InvestmentCreate,
    InvestmentSecureDetailsOut,
    InvestmentUpdate,
    InvestmentOut,
    PortfolioSummary,
    SecureCodeRequestOut,
    SecureCodeVerifyIn,
)
from app.api.deps import get_current_user, get_account_member, require_full_member
from app.models.user import User
from app.services.email_service import queue_email

router = APIRouter(prefix="/api/accounts/{account_id}/investments", tags=["investments"])


SECURE_FIELDS = ("account_email", "account_number", "login_id", "secure_notes")


def _visible_investment_filter(account_id: UUID, user_id: UUID):
    return and_(
        Investment.account_id == account_id,
        Investment.status == "active",
        or_(Investment.visibility == "shared", Investment.added_by == user_id, Investment.added_by.is_(None)),
    )


def _secure_payload(raw: object) -> dict[str, str]:
    if raw is None:
        return {}
    data = raw.model_dump() if hasattr(raw, "model_dump") else {}
    return {key: value for key, value in data.items() if key in SECURE_FIELDS and value}


async def _upsert_secure_details(
    db: AsyncSession,
    investment: Investment,
    current_user: User,
    raw_secure_details: object,
) -> None:
    payload = _secure_payload(raw_secure_details)
    if not payload:
        return

    nonce, ciphertext = encrypt_json(payload)
    result = await db.execute(
        select(InvestmentSecureDetails).where(InvestmentSecureDetails.investment_id == investment.id)
    )
    details = result.scalar_one_or_none()
    if details:
        details.nonce = nonce
        details.ciphertext = ciphertext
        details.updated_by = current_user.id
    else:
        db.add(
            InvestmentSecureDetails(
                investment_id=investment.id,
                nonce=nonce,
                ciphertext=ciphertext,
                updated_by=current_user.id,
            )
        )
    investment.has_secure_details = True


async def _get_visible_investment(
    db: AsyncSession,
    account_id: UUID,
    investment_id: UUID,
    user_id: UUID,
) -> Investment:
    result = await db.execute(
        select(Investment).where(
            and_(
                Investment.id == investment_id,
                _visible_investment_filter(account_id, user_id),
            )
        )
    )
    investment = result.scalar_one_or_none()
    if not investment:
        raise HTTPException(status_code=404, detail="Investment not found")
    return investment


async def _log_secure_access(
    db: AsyncSession,
    investment_id: UUID,
    user_id: UUID,
    action: str,
    status: str,
    request: Request,
) -> None:
    db.add(
        InvestmentSecureAccessLog(
            investment_id=investment_id,
            user_id=user_id,
            action=action,
            status=status,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
    )


@router.get("", response_model=list[InvestmentOut])
async def list_investments(
    account_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    member: Annotated[AccountMember, Depends(require_full_member)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Investment).where(_visible_investment_filter(account_id, current_user.id))
    )
    return result.scalars().all()


@router.post("", response_model=InvestmentOut, status_code=201)
async def create_investment(
    account_id: UUID,
    body: InvestmentCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    member: Annotated[AccountMember, Depends(require_full_member)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    data = body.model_dump(exclude={"secure_details"})
    inv = Investment(account_id=account_id, added_by=current_user.id, **data)
    db.add(inv)
    await db.flush()
    await _upsert_secure_details(db, inv, current_user, body.secure_details)
    await db.commit()
    await db.refresh(inv)
    return inv


@router.patch("/{investment_id}", response_model=InvestmentOut)
async def update_investment(
    account_id: UUID,
    investment_id: UUID,
    body: InvestmentUpdate,
    current_user: Annotated[User, Depends(get_current_user)],
    member: Annotated[AccountMember, Depends(require_full_member)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    inv = await _get_visible_investment(db, account_id, investment_id, current_user.id)
    for field, value in body.model_dump(exclude_unset=True, exclude={"secure_details"}).items():
        setattr(inv, field, value)
    if "secure_details" in body.model_fields_set:
        await _upsert_secure_details(db, inv, current_user, body.secure_details)
    await db.commit()
    await db.refresh(inv)
    return inv


@router.delete("/{investment_id}", status_code=204)
async def delete_investment(
    account_id: UUID,
    investment_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    member: Annotated[AccountMember, Depends(require_full_member)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    inv = await _get_visible_investment(db, account_id, investment_id, current_user.id)
    await db.delete(inv)
    await db.commit()


@router.get("/portfolio", response_model=PortfolioSummary)
async def portfolio_summary(
    account_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    member: Annotated[AccountMember, Depends(require_full_member)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Investment).where(_visible_investment_filter(account_id, current_user.id))
    )
    investments = result.scalars().all()

    account_result = await db.execute(select(Account).where(Account.id == account_id))
    account = account_result.scalar_one()

    total = sum(float(i.base_currency_value or i.current_value or 0) for i in investments)
    by_type: dict[str, float] = {}
    by_country: dict[str, float] = {}

    for inv in investments:
        val = float(inv.base_currency_value or inv.current_value or 0)
        by_type[inv.asset_type] = round(by_type.get(inv.asset_type, 0) + val, 2)
        if inv.country:
            by_country[inv.country] = round(by_country.get(inv.country, 0) + val, 2)

    return PortfolioSummary(
        total_base_currency_value=round(total, 2),
        by_type=by_type,
        by_country=by_country,
        base_currency=account.base_currency,
    )


@router.post("/{investment_id}/secure/request-code", response_model=SecureCodeRequestOut)
async def request_secure_details_code(
    account_id: UUID,
    investment_id: UUID,
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    member: Annotated[AccountMember, Depends(require_full_member)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    investment = await _get_visible_investment(db, account_id, investment_id, current_user.id)
    if not investment.has_secure_details:
        raise HTTPException(status_code=404, detail="Secure details not found")

    code = f"{secrets.randbelow(1_000_000):06d}"
    db.add(
        InvestmentSecureCode(
            investment_id=investment.id,
            user_id=current_user.id,
            code_hash=hash_password(code),
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=10),
        )
    )
    await _log_secure_access(db, investment.id, current_user.id, "request_code", "success", request)

    subject, html = investment_secure_code_email(current_user.full_name, investment.name, code)
    await queue_email(
        db,
        current_user.email,
        subject,
        html,
        "investment_secure_code",
        str(account_id),
        str(current_user.id),
    )
    return SecureCodeRequestOut(message="Verification code sent to your email.")


@router.post("/{investment_id}/secure/verify", response_model=InvestmentSecureDetailsOut)
async def verify_secure_details_code(
    account_id: UUID,
    investment_id: UUID,
    body: SecureCodeVerifyIn,
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
    member: Annotated[AccountMember, Depends(require_full_member)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    investment = await _get_visible_investment(db, account_id, investment_id, current_user.id)
    now = datetime.now(timezone.utc)
    code_result = await db.execute(
        select(InvestmentSecureCode)
        .where(
            and_(
                InvestmentSecureCode.investment_id == investment.id,
                InvestmentSecureCode.user_id == current_user.id,
                InvestmentSecureCode.used_at.is_(None),
                InvestmentSecureCode.expires_at > now,
            )
        )
        .order_by(InvestmentSecureCode.created_at.desc())
    )
    codes = code_result.scalars().all()
    matched = next((code for code in codes if verify_password(body.code, code.code_hash)), None)
    if not matched:
        await _log_secure_access(db, investment.id, current_user.id, "view_secure_details", "failed", request)
        await db.commit()
        raise HTTPException(status_code=400, detail="Invalid or expired verification code")

    details_result = await db.execute(
        select(InvestmentSecureDetails).where(InvestmentSecureDetails.investment_id == investment.id)
    )
    details = details_result.scalar_one_or_none()
    if not details:
        await _log_secure_access(db, investment.id, current_user.id, "view_secure_details", "failed", request)
        await db.commit()
        raise HTTPException(status_code=404, detail="Secure details not found")

    matched.used_at = now
    await _log_secure_access(db, investment.id, current_user.id, "view_secure_details", "success", request)
    payload = decrypt_json(details.nonce, details.ciphertext)
    await db.commit()

    return InvestmentSecureDetailsOut(
        account_email=payload.get("account_email"),
        account_number=payload.get("account_number"),
        login_id=payload.get("login_id"),
        secure_notes=payload.get("secure_notes"),
        revealed_until=now + timedelta(minutes=2),
    )
