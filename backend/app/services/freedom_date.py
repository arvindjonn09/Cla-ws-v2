from datetime import date
from typing import Optional
from app.services.debt_engine import DebtSnapshot, snowball_plan, avalanche_plan, custom_plan


def compute_freedom_date(
    debts: list[dict],
    preferred_method: str = "snowball",
    custom_order: Optional[list[str]] = None,
    from_date: Optional[date] = None,
) -> dict:
    """
    Given a list of debt dicts from the DB, compute all three freedom dates.
    Returns the full comparison plus the recommended method.
    """
    if from_date is None:
        from_date = date.today()

    snapshots = [
        DebtSnapshot(
            id=str(d["id"]),
            name=d["name"],
            current_balance=float(d["current_balance"]),
            monthly_payment=float(d.get("actual_payment") or d.get("minimum_payment") or 0),
            interest_rate=float(d.get("interest_rate") or 0),
            currency=d.get("currency", "USD"),
        )
        for d in debts
        if d.get("status") == "active" and float(d.get("current_balance", 0)) > 0
    ]

    if not snapshots:
        return {
            "snowball": {"method": "snowball", "freedom_date": None, "months_remaining": 0, "total_interest_paid": 0},
            "avalanche": {"method": "avalanche", "freedom_date": None, "months_remaining": 0, "total_interest_paid": 0},
            "custom": {"method": "custom", "freedom_date": None, "months_remaining": 0, "total_interest_paid": 0},
            "recommended_method": preferred_method,
        }

    sb = snowball_plan(snapshots, from_date)
    av = avalanche_plan(snapshots, from_date)
    co = custom_plan(snapshots, custom_order or [s.id for s in snapshots], from_date)

    return {
        "snowball": {
            "method": "snowball",
            "freedom_date": sb.freedom_date,
            "months_remaining": sb.total_months,
            "total_interest_paid": sb.total_interest,
        },
        "avalanche": {
            "method": "avalanche",
            "freedom_date": av.freedom_date,
            "months_remaining": av.total_months,
            "total_interest_paid": av.total_interest,
        },
        "custom": {
            "method": "custom",
            "freedom_date": co.freedom_date,
            "months_remaining": co.total_months,
            "total_interest_paid": co.total_interest,
        },
        "recommended_method": preferred_method,
    }
