from __future__ import annotations
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP
import math
from typing import Optional


@dataclass
class DebtSnapshot:
    id: str
    name: str
    current_balance: float
    monthly_payment: float
    interest_rate: float  # annual %
    currency: str = "ZAR"

    @property
    def monthly_rate(self) -> float:
        return self.interest_rate / 100 / 12

    def months_to_clear(self, extra: float = 0) -> int:
        payment = self.monthly_payment + extra
        if payment <= 0:
            return 9999
        balance = self.current_balance
        r = self.monthly_rate
        if r == 0:
            return math.ceil(balance / payment)
        # standard amortisation formula
        if payment <= balance * r:
            return 9999  # payment doesn't cover interest
        months = math.log(payment / (payment - balance * r)) / math.log(1 + r)
        return math.ceil(months)

    def total_interest(self, extra: float = 0) -> float:
        payment = self.monthly_payment + extra
        balance = self.current_balance
        r = self.monthly_rate
        total = 0.0
        months = self.months_to_clear(extra)
        if months >= 9999:
            return 0.0
        for _ in range(months):
            interest = balance * r
            total += interest
            balance = balance + interest - payment
            if balance <= 0:
                break
        return round(total, 2)

    def freedom_date(self, from_date: date, extra: float = 0) -> Optional[date]:
        months = self.months_to_clear(extra)
        if months >= 9999:
            return None
        result = from_date
        for _ in range(months):
            # advance by one month
            month = result.month + 1
            year = result.year + (month - 1) // 12
            month = ((month - 1) % 12) + 1
            result = result.replace(year=year, month=month)
        return result


@dataclass
class DebtPlan:
    order: list[str]  # debt IDs in payment priority
    freedom_date: Optional[date]
    total_months: int
    total_interest: float
    method: str


def _simulate_plan(
    debts: list[DebtSnapshot],
    order: list[str],
    from_date: date,
    extra_monthly: float = 0,
) -> DebtPlan:
    """Simulate snowball / avalanche with debt roll-over."""
    balances = {d.id: d.current_balance for d in debts}
    payments = {d.id: d.monthly_payment for d in debts}
    rates = {d.id: d.monthly_rate for d in debts}
    debt_map = {d.id: d for d in debts}

    active = [did for did in order if balances.get(did, 0) > 0]
    cleared_order = []
    total_interest = 0.0
    month = 0
    freed_up = 0.0

    while active and month < 600:
        month += 1
        # apply interest and minimum payments to all
        for did in active:
            r = rates[did]
            interest = balances[did] * r
            total_interest += interest
            balances[did] = balances[did] + interest - payments[did]

        # apply freed-up + extra to first in order
        target = active[0]
        balances[target] -= freed_up + extra_monthly

        # clear any that hit zero
        newly_cleared = []
        for did in active:
            if balances[did] <= 0.01:
                freed_up += payments[did]
                balances[did] = 0
                newly_cleared.append(did)

        for did in newly_cleared:
            active.remove(did)
            cleared_order.append(did)

    if active:
        return DebtPlan(order=order, freedom_date=None, total_months=600, total_interest=total_interest, method="")

    result_date = from_date
    for _ in range(month):
        m = result_date.month + 1
        y = result_date.year + (m - 1) // 12
        m = ((m - 1) % 12) + 1
        result_date = result_date.replace(year=y, month=m)

    return DebtPlan(
        order=cleared_order,
        freedom_date=result_date,
        total_months=month,
        total_interest=round(total_interest, 2),
        method="",
    )


def snowball_plan(debts: list[DebtSnapshot], from_date: date, extra: float = 0) -> DebtPlan:
    ordered = sorted(debts, key=lambda d: d.current_balance)
    plan = _simulate_plan(debts, [d.id for d in ordered], from_date, extra)
    plan.method = "snowball"
    return plan


def avalanche_plan(debts: list[DebtSnapshot], from_date: date, extra: float = 0) -> DebtPlan:
    ordered = sorted(debts, key=lambda d: d.interest_rate, reverse=True)
    plan = _simulate_plan(debts, [d.id for d in ordered], from_date, extra)
    plan.method = "avalanche"
    return plan


def custom_plan(debts: list[DebtSnapshot], custom_order: list[str], from_date: date, extra: float = 0) -> DebtPlan:
    plan = _simulate_plan(debts, custom_order, from_date, extra)
    plan.method = "custom"
    return plan


def simulate_extra_payment(
    debts: list[DebtSnapshot],
    method: str,
    current_freedom_date: Optional[date],
    extra_monthly: float,
    from_date: date,
) -> dict:
    if method == "snowball":
        baseline = snowball_plan(debts, from_date, 0)
        with_extra = snowball_plan(debts, from_date, extra_monthly)
    elif method == "avalanche":
        baseline = avalanche_plan(debts, from_date, 0)
        with_extra = avalanche_plan(debts, from_date, extra_monthly)
    else:
        baseline = snowball_plan(debts, from_date, 0)
        with_extra = snowball_plan(debts, from_date, extra_monthly)

    months_saved = baseline.total_months - with_extra.total_months
    interest_saved = baseline.total_interest - with_extra.total_interest

    return {
        "extra_monthly": extra_monthly,
        "new_freedom_date": with_extra.freedom_date,
        "months_saved": max(0, months_saved),
        "interest_saved": round(max(0, interest_saved), 2),
    }
