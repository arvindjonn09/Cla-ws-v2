"""
Daily job — checks active monthly debts and queues payment reminder emails,
and creates PaymentWarning records for joint account debts.

Email reminder schedule:
  7 days before  → email
  3 days before  → email
  payment day    → email
  3 days after   → email (missed payment check)

In-app warning schedule (joint accounts only):
  30, 7, 4, 3, 1 days before + payment day + 3 days after

Deduplication: trigger_type encodes debt_id + due_date + warning type,
so the same reminder is never queued or created twice per payment cycle.
"""
import calendar
import logging
from datetime import date

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.debt import Debt
from app.models.account import Account, AccountMember
from app.models.user import User
from app.models.notification import EmailLog, PaymentWarning
from app.core.email import debt_payment_reminder_email
from app.services.email_service import queue_email

logger = logging.getLogger(__name__)

# Days relative to due_date → (warning_type, label shown in email)
REMINDER_SCHEDULE = [
    (7,  "7_day",        "in 7 days"),
    (3,  "3_day",        "in 3 days"),
    (0,  "payment_day",  "today"),
    (-3, "3_day_after",  "3 days ago — did you pay?"),
]

# In-app warning schedule for joint accounts (days before/after due_date → warning_type)
WARNING_SCHEDULE = [
    (30, "30_day"),
    (7,  "7_day"),
    (4,  "4_day"),
    (3,  "3_day"),
    (1,  "1_day"),
    (0,  "payment_day"),
    (-3, "3_day_after"),
]


def _next_due_date(payment_day: int) -> date:
    """Return the upcoming (or current) due date for a monthly debt."""
    today = date.today()
    last_day_this_month = calendar.monthrange(today.year, today.month)[1]
    clamped = min(payment_day, last_day_this_month)
    candidate = today.replace(day=clamped)

    if candidate >= today:
        return candidate

    # Candidate is in the past — move to next month
    if today.month == 12:
        next_year, next_month = today.year + 1, 1
    else:
        next_year, next_month = today.year, today.month + 1

    last_day_next = calendar.monthrange(next_year, next_month)[1]
    return date(next_year, next_month, min(payment_day, last_day_next))


def _trigger_key(debt_id: str, due_date: date, warning_type: str) -> str:
    return f"debt_reminder:{debt_id}:{due_date.isoformat()}:{warning_type}"


async def _already_queued(db: AsyncSession, trigger_key: str, recipient: str) -> bool:
    result = await db.execute(
        select(EmailLog).where(
            and_(
                EmailLog.trigger_type == trigger_key,
                EmailLog.recipient == recipient,
            )
        ).limit(1)
    )
    return result.scalar_one_or_none() is not None


async def daily_debt_reminder_job(db: AsyncSession) -> None:
    """APScheduler job — run once daily to queue payment reminder emails."""
    today = date.today()

    # Fetch all active monthly debts that have a payment_day set
    result = await db.execute(
        select(Debt).where(
            and_(
                Debt.status == "active",
                Debt.payment_frequency == "monthly",
                Debt.payment_day.isnot(None),
            )
        )
    )
    debts = result.scalars().all()

    queued_count = 0

    for debt in debts:
        try:
            payment_day = int(debt.payment_day)
        except (ValueError, TypeError):
            continue

        due_date = _next_due_date(payment_day)
        days_until = (due_date - today).days

        for trigger_days, warning_type, days_label in REMINDER_SCHEDULE:
            if days_until != trigger_days:
                continue

            # Fetch all active members for this account
            members_result = await db.execute(
                select(AccountMember, User)
                .join(User, User.id == AccountMember.user_id)
                .where(
                    and_(
                        AccountMember.account_id == debt.account_id,
                        AccountMember.status == "active",
                        AccountMember.role == "member",
                    )
                )
            )
            rows = members_result.all()

            for member, user in rows:
                trigger_key = _trigger_key(str(debt.id), due_date, warning_type)

                if await _already_queued(db, trigger_key, user.email):
                    continue

                payment = debt.actual_payment or debt.minimum_payment or 0
                amount_str = f"{debt.currency} {payment:,.2f}"
                balance_str = f"{debt.current_balance:,.2f}"
                due_str = due_date.strftime("%d %b %Y")

                subject, html = debt_payment_reminder_email(
                    full_name=user.full_name,
                    debt_name=debt.name,
                    amount=amount_str,
                    due_date=due_str,
                    days_label=days_label,
                    balance_remaining=balance_str,
                    currency=debt.currency,
                )

                await queue_email(
                    db=db,
                    recipient=user.email,
                    subject=subject,
                    html_body=html,
                    trigger_type=trigger_key,
                    account_id=str(debt.account_id),
                    user_id=str(user.id),
                )
                queued_count += 1

    if queued_count:
        logger.info("Debt reminders: queued %d emails for %s", queued_count, today)


async def daily_payment_warning_job(db: AsyncSession) -> None:
    """Create PaymentWarning rows for joint-account debts so the in-app
    /payment-warnings page shows upcoming and missed payment alerts."""
    today = date.today()

    # Active monthly debts with payment_day set, belonging to active joint accounts
    result = await db.execute(
        select(Debt)
        .join(Account, Account.id == Debt.account_id)
        .where(
            and_(
                Debt.status == "active",
                Debt.payment_frequency == "monthly",
                Debt.payment_day.isnot(None),
                Account.type == "joint",
                Account.status == "active",
            )
        )
    )
    debts = result.scalars().all()

    created_count = 0

    for debt in debts:
        try:
            payment_day = int(debt.payment_day)
        except (ValueError, TypeError):
            continue

        due_date = _next_due_date(payment_day)
        days_until = (due_date - today).days

        for trigger_days, warning_type in WARNING_SCHEDULE:
            if days_until != trigger_days:
                continue

            existing = await db.execute(
                select(PaymentWarning).where(
                    and_(
                        PaymentWarning.account_id == debt.account_id,
                        PaymentWarning.debt_id == debt.id,
                        PaymentWarning.due_date == due_date,
                        PaymentWarning.warning_type == warning_type,
                    )
                ).limit(1)
            )
            if existing.scalar_one_or_none():
                continue

            db.add(PaymentWarning(
                account_id=debt.account_id,
                debt_id=debt.id,
                due_date=due_date,
                warning_type=warning_type,
            ))
            created_count += 1

    if created_count:
        await db.commit()
        logger.info("Payment warnings: created %d records for %s", created_count, today)
