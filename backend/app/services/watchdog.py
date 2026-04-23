"""
Application-level health check service.
The systemd watchdog is in scripts/watchdog.py.
This module exposes the /health endpoint data.
"""
import asyncio
import logging
import psutil
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

logger = logging.getLogger(__name__)


async def check_database(db: AsyncSession) -> dict:
    try:
        await db.execute(text("SELECT 1"))
        return {"status": "ok"}
    except Exception as exc:
        return {"status": "error", "detail": str(exc)}


def check_system() -> dict:
    try:
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage("/")
        return {
            "memory_percent": memory.percent,
            "disk_percent": disk.percent,
            "cpu_percent": psutil.cpu_percent(interval=0.1),
        }
    except Exception as exc:
        return {"error": str(exc)}


async def get_health(db: AsyncSession) -> dict:
    db_status = await check_database(db)
    system = check_system()

    all_ok = db_status["status"] == "ok"

    return {
        "status": "healthy" if all_ok else "degraded",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "database": db_status,
        "system": system,
        "version": "1.0.0",
    }
