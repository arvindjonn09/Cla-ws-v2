import logging
from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.api import auth, accounts, debts, transactions, goals, investments
from app.api.joint import boundaries, scenarios, payments, members
from app.services.exchange_rate import daily_rate_job
from app.services.email_service import process_email_queue
from app.services.debt_reminder import daily_debt_reminder_job
from app.services.watchdog import get_health

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler(timezone="Asia/Kolkata")


async def _exchange_rate_task():
    async with AsyncSessionLocal() as db:
        await daily_rate_job(db)


async def _email_queue_task():
    async with AsyncSessionLocal() as db:
        await process_email_queue(db)


async def _debt_reminder_task():
    async with AsyncSessionLocal() as db:
        await daily_debt_reminder_job(db)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Daily exchange rate fetch at 09:00 IST
    scheduler.add_job(
        _exchange_rate_task,
        CronTrigger(hour=settings.EXCHANGE_RATE_FETCH_HOUR_IST, minute=settings.EXCHANGE_RATE_FETCH_MINUTE_IST),
        id="exchange_rate_daily",
        replace_existing=True,
    )
    # Email queue processor every 15 seconds
    scheduler.add_job(
        _email_queue_task,
        "interval",
        seconds=15,
        id="email_queue",
        replace_existing=True,
    )
    # Daily debt payment reminders at 08:00 IST
    scheduler.add_job(
        _debt_reminder_task,
        CronTrigger(hour=8, minute=0, timezone="Asia/Kolkata"),
        id="debt_reminders_daily",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("APScheduler started")
    yield
    scheduler.shutdown()
    logger.info("APScheduler stopped")


app = FastAPI(
    title="Financial Command Center API",
    version="1.0.0",
    description="Financial rehabilitation and elevation system",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router)
app.include_router(accounts.router)
app.include_router(debts.router)
app.include_router(transactions.router)
app.include_router(goals.router)
app.include_router(investments.router)
app.include_router(boundaries.router)
app.include_router(scenarios.router)
app.include_router(payments.router)
app.include_router(members.router)


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "version": "1.0.0"}


@app.get("/api/health/detailed")
async def health_check_detailed():
    from app.core.database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        result = await get_health(db)
    return result


@app.get("/api/exchange-rates/{from_currency}/{to_currency}")
async def exchange_rate(from_currency: str, to_currency: str):
    from app.services.exchange_rate import get_latest_rate
    from app.core.database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        return await get_latest_rate(db, from_currency.upper(), to_currency.upper())


@app.get("/api/exchange-rates/status")
async def exchange_rate_status():
    from app.services.exchange_rate import get_latest_rate
    from app.core.database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        eur = await get_latest_rate(db, "USD", "EUR")
    return {"usd_eur": eur, "scheduler_running": scheduler.running}
