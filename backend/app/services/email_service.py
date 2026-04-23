"""
Email queue service — emails are never sent inline.
All sends go through the email_log table and are picked up by APScheduler every 60s.
"""
import logging
import uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.models.notification import EmailLog
from app.core.email import send_email

logger = logging.getLogger(__name__)

MAX_RETRIES = 3


async def queue_email(
    db: AsyncSession,
    recipient: str,
    subject: str,
    html_body: str,
    trigger_type: str,
    account_id: str | None = None,
    user_id: str | None = None,
) -> None:
    """Insert an email job into email_log for async dispatch."""
    entry = EmailLog(
        recipient=recipient,
        subject=subject,
        html_body=html_body,
        trigger_type=trigger_type,
        account_id=uuid.UUID(account_id) if account_id else None,
        user_id=uuid.UUID(user_id) if user_id else None,
        status="queued",
    )
    db.add(entry)
    await db.commit()


async def process_email_queue(db: AsyncSession) -> None:
    """APScheduler job — process queued emails every 60 seconds."""
    result = await db.execute(
        select(EmailLog)
        .where(
            and_(
                EmailLog.status == "queued",
                EmailLog.attempts < MAX_RETRIES,
            )
        )
        .limit(50)
    )
    pending = result.scalars().all()

    for entry in pending:
        entry.attempts += 1
        try:
            success = await send_email(
                to=entry.recipient,
                subject=entry.subject,
                html_body=entry.html_body,
            )
            if success:
                entry.status = "sent"
                entry.sent_at = datetime.now(timezone.utc)
            else:
                entry.status = "queued" if entry.attempts < MAX_RETRIES else "failed"
        except Exception as exc:
            logger.error("Email dispatch failed for %s: %s", entry.id, exc)
            entry.error_message = str(exc)
            entry.status = "queued" if entry.attempts < MAX_RETRIES else "failed"

    await db.commit()
    if pending:
        logger.info("Processed %d queued emails", len(pending))
