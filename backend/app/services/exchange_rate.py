import httpx
import logging
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, and_

from app.models.investment import ExchangeRate
from app.core.config import settings

logger = logging.getLogger(__name__)

FRANKFURTER_BASE = settings.EXCHANGE_RATE_API_URL


async def fetch_rates_for_currencies(currencies: list[str], base: str = "ZAR") -> dict[str, float]:
    """Fetch live rates from frankfurter.app."""
    if not currencies:
        return {}

    symbols = ",".join(set(currencies) - {base})
    if not symbols:
        return {}

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{FRANKFURTER_BASE}/latest", params={"from": base, "to": symbols})
            resp.raise_for_status()
            data = resp.json()
            return data.get("rates", {})
    except Exception as exc:
        logger.error("Exchange rate fetch failed: %s", exc)
        return {}


async def store_exchange_rates(db: AsyncSession, rates: dict[str, float], base: str) -> None:
    """Store fetched rates in the database."""
    now = datetime.now(timezone.utc)
    for to_currency, rate in rates.items():
        record = ExchangeRate(
            from_currency=base,
            to_currency=to_currency,
            rate=rate,
            fetched_at=now,
            source="frankfurter",
            status="live",
        )
        db.add(record)
    await db.commit()


async def get_latest_rate(db: AsyncSession, from_currency: str, to_currency: str) -> dict:
    """Get the most recent stored rate, with staleness indicator."""
    result = await db.execute(
        select(ExchangeRate)
        .where(
            and_(
                ExchangeRate.from_currency == from_currency,
                ExchangeRate.to_currency == to_currency,
            )
        )
        .order_by(ExchangeRate.fetched_at.desc())
        .limit(1)
    )
    rate_row = result.scalar_one_or_none()

    if not rate_row:
        return {"rate": None, "is_stale": True, "fetched_at": None}

    now = datetime.now(timezone.utc)
    age_hours = (now - rate_row.fetched_at.replace(tzinfo=timezone.utc)).total_seconds() / 3600
    is_stale = age_hours > 25  # more than 25h old

    return {
        "rate": float(rate_row.rate),
        "is_stale": is_stale,
        "fetched_at": rate_row.fetched_at,
        "status": rate_row.status,
    }


async def daily_rate_job(db: AsyncSession) -> None:
    """APScheduler job — fetch rates for all active currencies."""
    from app.models.investment import Investment
    from sqlalchemy import distinct

    currencies_result = await db.execute(
        select(distinct(Investment.currency)).where(Investment.status == "active")
    )
    currencies = [row[0] for row in currencies_result.fetchall()]

    # default currencies to always track
    default = ["USD", "EUR", "GBP", "INR"]
    all_currencies = list(set(currencies + default))

    # fetch against ZAR as base (configurable)
    rates = await fetch_rates_for_currencies(all_currencies, base="ZAR")
    if rates:
        await store_exchange_rates(db, rates, base="ZAR")
        logger.info("Exchange rates updated: %d pairs", len(rates))

        # update investment base_currency_value
        for currency, rate in rates.items():
            await db.execute(
                update(Investment)
                .where(and_(Investment.currency == currency, Investment.status == "active"))
                .values(base_currency_value=Investment.current_value / rate if rate else None)
            )
        await db.commit()
    else:
        logger.warning("No exchange rates fetched — using stale data")
