from typing import Optional


def compute_baseline(m1: Optional[float], m2: Optional[float], m3: Optional[float]) -> dict:
    """
    Given 3 months of income, compute baseline, lowest, and safe_baseline.
    safe_baseline is used for debt calculations (conservative).
    """
    values = [v for v in [m1, m2, m3] if v is not None and v > 0]
    if not values:
        return {"baseline": 0, "lowest": 0, "safe_baseline": 0}

    baseline = sum(values) / len(values)
    lowest = min(values)

    return {
        "baseline": round(baseline, 2),
        "lowest": round(lowest, 2),
        "safe_baseline": round(lowest, 2),
    }


def tier_allocation(deposit: float, cushion_current: float, cushion_target: float) -> dict:
    """
    Irregular earner tier allocation:
    Survival → Cushion → Debt → Living
    Returns allocation per tier.
    """
    remaining = deposit
    allocation = {}

    # Cushion fill first (after survival needs are already accounted for)
    cushion_needed = max(0, cushion_target - cushion_current)
    cushion_fill = min(remaining, cushion_needed)
    allocation["cushion"] = round(cushion_fill, 2)
    remaining -= cushion_fill

    allocation["available_for_debt_and_living"] = round(remaining, 2)
    return allocation


def bare_minimum_check(income: float, fixed_expenses: float, minimum_debt_payments: float) -> dict:
    """
    Determine if this is a bare minimum month and calculate the deficit.
    """
    required = fixed_expenses + minimum_debt_payments
    surplus = income - required
    is_bare_minimum = surplus < 0

    return {
        "is_bare_minimum": is_bare_minimum,
        "required": round(required, 2),
        "surplus": round(surplus, 2),
        "deficit": round(abs(min(0, surplus)), 2),
    }


def payday_allocation(income: float, debts_payment: float, fixed_bills: float, cushion_top_up: float = 0) -> dict:
    """
    Payday mode — allocate salary on receipt.
    """
    allocated = {}
    remaining = income

    allocated["debt_payments"] = round(min(remaining, debts_payment), 2)
    remaining -= allocated["debt_payments"]

    allocated["fixed_bills"] = round(min(remaining, fixed_bills), 2)
    remaining -= allocated["fixed_bills"]

    allocated["cushion_top_up"] = round(min(remaining, cushion_top_up), 2)
    remaining -= allocated["cushion_top_up"]

    allocated["discretionary"] = round(max(0, remaining), 2)

    return allocated


def detect_income_trend(history: list[float], baseline: float) -> str:
    """
    Given last N months of income vs baseline, return trend signal.
    """
    if len(history) < 3:
        return "insufficient_data"

    last_3 = history[-3:]
    all_low = all(v < baseline * 0.9 for v in last_3)
    all_high = all(v > baseline * 1.1 for v in last_3)

    if all_low:
        return "consistently_low"
    if all_high:
        return "consistently_high"
    return "normal"
