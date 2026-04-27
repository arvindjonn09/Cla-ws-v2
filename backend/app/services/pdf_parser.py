"""
PDF bank statement parser — Australian focus.

Categorisation priority:
  1. Learned merchant rules (DB — built from user corrections, shared globally)
  2. Built-in keyword arrays (mirrors frontend STMT_CATEGORIES + AU extras)
  3. "uncategorized" fallback

Extraction strategies (in order per page):
  1. Word-coordinate grouping  — groups positioned words by y into rows, detects
     date/desc/amount columns by x.  Works on all text-based bank PDFs.
  2. extract_tables()          — for PDFs with real table markup.
  3. Raw-text regex            — last resort.
"""

import re
import uuid
from collections import defaultdict
from datetime import date, datetime
from typing import Optional

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.transaction import Transaction as DBTransaction
from app.models.merchant_rule import MerchantRule


# ─────────────────────────────────────────────────────────────────────────────
# Built-in category keyword map
# ─────────────────────────────────────────────────────────────────────────────

CATEGORIES: list[dict] = [
    # ── BNPL (Buy Now, Pay Later) ─────────────────────────────────────────────
    # These show their own entity name, not the original merchant, so catch them first.
    {
        "id": "bnpl",
        "keywords": [
            "afterpay", "after pay", "after-pay",
            "zip ", "zippay", "zip pay", "zipmoney", "zip money", "zip co",
            "humm ", "shophumm", "humm australia",
            "latitude pay", "latitudepay", "gem visa", "latitude financial",
            "sezzle", "laybuy", "paright", "payright", "openpay", "open pay",
            "splitit", "split it", "bundll", "klarna",
        ],
    },
    # ── Government / ATO / Tax (checked before Income so ATO refunds go here) ─
    {
        "id": "government",
        "keywords": [
            "ato ", "ato refund", "tax refund", "australian tax", "tax office",
            "medicare levy", "council rates", "water rates", "land tax",
            "stamp duty", "transport for nsw", "transport for vic",
            "vic roads", "service nsw", "service vic",
        ],
    },
    # ── Salary / Income ───────────────────────────────────────────────────────
    # Salary appears as a credit; description is employer-specific but usually
    # contains SALARY, WAGES, PAYROLL, or the employer name + one of those words.
    {
        "id": "income",
        "keywords": [
            "salary", "wages ", "payroll", "stp payment", "pay slip",
            "centrelink", "services australia", "jobseeker", "jobkeeper",
            # common AU employer salary keywords (add more as users teach us)
            "coles salary", "woolworths salary", "wesfarmers salary",
            "reddy salary", "company salary",
        ],
    },
    # ── Transfers / P2P ──────────────────────────────────────────────────────
    # OSKO / PayID / BSB transfers — shown in a special IOU UI, not auto-saved.
    {
        "id": "transfer",
        "keywords": [
            "osko ", "osko to", "osko from", "osko payment",
            "payid ", "pay id", "payid to", "payid from",
            "npp payment", "faster payment",
            "transfer to ", "transfer from ", "tfr to ", "tfr from ",
            "internet transfer", "online transfer",
            "bpay ", "b-pay", "bpay ref",          # BPAY = bill payment via bank
        ],
    },
    # ── Fuel / Petrol ─────────────────────────────────────────────────────────
    {
        "id": "fuel",
        "keywords": [
            "bp ", "shell", "caltex", "ampol", "7-eleven", "7eleven",
            "united petro", "puma ", "petrol", "diesel", "fuel ",
            "servo", "service station", "liberty oil", "bpme", "ez fuel",
            "budget fuel", "viva energy",
        ],
    },
    # ── Food / Cafes ──────────────────────────────────────────────────────────
    {
        "id": "food",
        "keywords": [
            "mcdonald", "kfc ", "domino", "hungry jack", "subway", "pizza",
            "uber eat", "doordash", "menulog", "deliveroo",
            "cafe ", "coffee", "starbucks", "gloria jean", "nando",
            "grill'd", "zambreros", "oporto", "red rooster",
            "sushi", "thai ", "chinese ", "restaurant", "eatery", "bistro",
            "bakery", "bakers delight", "roll'd", "guzman", "foodco",
            "gelato", "dim sum", "dumplings", "burrito", "taco",
            "falafel", "kebab", "muffin break", "boost juice",
            "chatime", "gong cha", "the coffee club",
        ],
    },
    # ── Entertainment ─────────────────────────────────────────────────────────
    {
        "id": "entertainment",
        "keywords": [
            "cinema", "hoyts", "event cinema", "village cinema", "reading cinema",
            "netflix", "spotify", "disney", "stan ", "binge", "paramount",
            "steam", "playstation", "xbox", "gaming", "bowling",
            "laser tag", "escape room", "concert", "ticketek", "ticketmaster",
            "eventbrite", "luna park", "theme park", "zoo", "aquarium",
            "foxtel", "youtube premium", "twitch",
        ],
    },
    # ── Groceries ─────────────────────────────────────────────────────────────
    {
        "id": "groceries",
        "keywords": [
            "woolworths", "coles ", "aldi ", "iga ",
            "harris farm", "costco", "spar ", "drakes", "foodland",
            "ritchies", "fresh market", "deli ", "butcher", "fruit",
            "convenience store", "7-eleven grocery",
        ],
    },
    # ── Transport ─────────────────────────────────────────────────────────────
    {
        "id": "transport",
        "keywords": [
            "uber ", "lyft", "ola cab", "didi ", "myki", "opal ",
            "transurban", "citylink", "eastlink", "westlink",
            "parking", "public transport", "metro train", "bus fare",
            "train ", "tram ", "ferry", "toll ", "car park",
            "linkt", "e-toll", "roam express", "go via",
        ],
    },
    # ── Health / Medical ──────────────────────────────────────────────────────
    {
        "id": "health",
        "keywords": [
            "pharmacy", "chemist", "priceline", "medicare",
            "medical", "doctor", "hospital", "clinic", "dental",
            "optometrist", "physio", "pathology", "health fund",
            "medibank", "bupa ", "nib ", "hcf ", "ahm health",
            "bulk bill", "gp clinic",
        ],
    },
    # ── Shopping / Retail ─────────────────────────────────────────────────────
    {
        "id": "shopping",
        "keywords": [
            "amazon", "target ", "kmart", "myer ", "david jones",
            "jb hi-fi", "harvey norman", "bunnings", "officeworks",
            "the good guys", "rebel sport", "cotton on", "uniqlo",
            "h&m ", "cotton:on", "factorie", "glue store",
            "sephora", "priceline cosm", "ebay",
            "catch.com", "mighty ape",
        ],
    },
    # ── Subscriptions ─────────────────────────────────────────────────────────
    {
        "id": "subscriptions",
        "keywords": [
            "apple.com", "apple subscription", "itunes",
            "google play", "google storage",
            "microsoft", "adobe ", "canva ", "dropbox", "icloud",
            "youtube", "amazon prime", "audible", "kindle",
            "github", "chatgpt", "openai", "anthropic",
        ],
    },
    # ── ATM / Cash ────────────────────────────────────────────────────────────
    {
        "id": "atm",
        "keywords": [
            "atm ", "cash out", "withdrawal", "cash advance", "atm withdrawal",
            "commonweal atm", "westpac atm", "nab atm", "anz atm",
        ],
    },
]

VALID_CATEGORIES = {c["id"] for c in CATEGORIES} | {"uncategorized"}


def _normalize_keyword(text: str) -> str:
    """Lowercase, collapse spaces — used for both lookup and storage."""
    return re.sub(r"\s+", " ", text.lower().strip())


# Patterns to strip from descriptions BEFORE keyword matching.
# Real bank statements embed a lot of noise that prevents matching.
_PREFIX_NOISE = re.compile(
    r"^("
    r"EFTPOS (PURCHASE|WITHDRAWAL|DEBIT|CREDIT|TRAN)\s*|"
    r"EFTPOS\s+|"
    r"TSP\*|"
    r"SQ[\s\*]+|"          # Square terminal: "SQ *MERCHANT"
    r"ZLR\*|"              # Zeller terminal
    r"DPT\*|"              # DoorDash/payment terminal
    r"PAYPAL\*|"
    r"VISA (DEBIT|CREDIT|PURCHASE|TRAN)\s*|"
    r"VIS\s+|"
    r"DEBIT (CARD\s*|PURCHASE\s*)|"
    r"CREDIT (CARD\s*|PURCHASE\s*)|"
    r"CARD\s+\d+\s+|"      # "CARD 1234 MERCHANT"
    r"DIRECT (DEBIT|CREDIT)\s*|"
    r"\d{2}[A-Z]{3}\s+"    # date prefix like "01APR "
    r")",
    re.IGNORECASE,
)

_AU_STATES = re.compile(
    r"\s+(NSW|VIC|QLD|SA|WA|TAS|NT|ACT)(\s+[A-Z]{2,3})?$",
    re.IGNORECASE,
)

_COUNTRY_CODES = re.compile(
    r"\s+(AUS|USA|GBR|NLD|IRL|NZL|SGP|CAN|FRA|DEU|IND|HKG|CHN|JPN|UAE)$",
    re.IGNORECASE,
)

_TERMINAL_REF = re.compile(
    r"(\s+\d{3,10}$|"       # trailing reference numbers
    r"\s+REF:?\s*\S+$|"     # REF: xxx
    r"\s+#\S+$)",            # #reference
    re.IGNORECASE,
)


def _clean_description(text: str) -> str:
    """
    Strip bank-added noise so keyword matching works on the actual merchant name.
    E.g.: "EFTPOS PURCHASE  WOOLWORTHS 3029  PARRAMATTA NSW AUS"
          → "WOOLWORTHS"
    """
    s = text.strip()
    s = _PREFIX_NOISE.sub("", s)
    s = _AU_STATES.sub("", s)
    s = _COUNTRY_CODES.sub("", s)
    # Strip trailing terminal / store numbers (4+ digit standalone token)
    s = re.sub(r"\s+\d{4,}\s*$", "", s)
    s = _TERMINAL_REF.sub("", s)
    return re.sub(r"\s+", " ", s).strip()


def _auto_category_builtin(description: str) -> str:
    # Match on the cleaned description first, then fall back to raw
    for text in (_clean_description(description), description):
        lower = text.lower()
        for cat in CATEGORIES:
            if any(kw in lower for kw in cat["keywords"]):
                return cat["id"]
    return "uncategorized"



async def save_merchant_rules(
    corrections: list[dict],  # [{description, category}]
    db: AsyncSession,
) -> int:
    """
    Upsert learned rules from user corrections.
    Uses the first 4 meaningful words of the description as the keyword
    (same normalisation as _merchant_key).
    Returns count saved.
    """
    saved = 0
    for item in corrections:
        category = item.get("category", "")
        if category not in VALID_CATEGORIES or category == "uncategorized":
            continue

        keyword = _normalize_keyword(_merchant_key(item.get("description", "")))
        if not keyword or len(keyword) < 3:
            continue

        existing = await db.execute(
            select(MerchantRule).where(MerchantRule.keyword == keyword)
        )
        rule = existing.scalar_one_or_none()
        if rule:
            rule.category = category
            rule.hit_count += 1
        else:
            db.add(MerchantRule(keyword=keyword, category=category))
        saved += 1

    await db.commit()
    return saved


# ─────────────────────────────────────────────────────────────────────────────
# Date / amount helpers
# ─────────────────────────────────────────────────────────────────────────────

_DATE_FMTS = [
    "%d/%m/%Y", "%d-%m-%Y", "%d/%m/%y", "%d-%m-%y",
    "%Y-%m-%d", "%m/%d/%Y", "%d %b %Y", "%d %b %y",
    "%b %d %Y", "%b %d, %Y", "%d %B %Y",
]

_DATE_RE = re.compile(
    r"\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}"
    r"|\d{4}-\d{2}-\d{2}"
    r"|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{2,4}"
    r"|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}[,\s]+\d{4})\b",
    re.IGNORECASE,
)

_AMOUNT_RE = re.compile(r"^-?\$?\s*[\d,]+\.?\d{0,2}$")


def _parse_date(raw: str) -> Optional[date]:
    raw = raw.strip().rstrip(".")
    for fmt in _DATE_FMTS:
        try:
            return datetime.strptime(raw, fmt).date()
        except ValueError:
            pass
    return None


def _parse_amount(raw: str) -> Optional[float]:
    cleaned = re.sub(r"[^0-9.\-]", "", raw.replace(",", ""))
    if not cleaned:
        return None
    try:
        v = float(cleaned)
        return round(abs(v), 2) if v != 0 else None
    except ValueError:
        return None


def _looks_like_amount(text: str) -> bool:
    return bool(_AMOUNT_RE.match(text.replace(" ", "")))


# ─────────────────────────────────────────────────────────────────────────────
# Strategy 1: word-coordinate grouping
# ─────────────────────────────────────────────────────────────────────────────

def _extract_by_words(page) -> list[dict]:
    words = page.extract_words(x_tolerance=3, y_tolerance=3)
    if not words:
        return []

    rows_by_y: dict[int, list[dict]] = defaultdict(list)
    for w in words:
        bucket = round(w["top"] / 4) * 4
        rows_by_y[bucket].append(w)

    rows: list[list[dict]] = [
        sorted(rows_by_y[y], key=lambda w: w["x0"])
        for y in sorted(rows_by_y)
    ]

    # Detect column x-ranges from first 40 rows
    date_x_max: Optional[float] = None
    amount_x_min: Optional[float] = None

    for row in rows[:40]:
        texts = [w["text"] for w in row]
        if texts and _parse_date(texts[0]):
            date_x_max = max(date_x_max or 0, row[0]["x1"] + 5)
        if texts and _looks_like_amount(texts[-1]):
            amount_x_min = min(amount_x_min or 9999, row[-1]["x0"] - 5)

    pw = page.width
    if date_x_max is None:
        date_x_max = pw * 0.22
    if amount_x_min is None:
        amount_x_min = pw * 0.75

    results: list[dict] = []

    for row in rows:
        if len(row) < 2:
            continue

        date_words   = [w["text"] for w in row if w["x1"] <= date_x_max]
        amount_words = [w["text"] for w in row if w["x0"] >= amount_x_min]
        desc_words   = [w["text"] for w in row if w["x1"] > date_x_max and w["x0"] < amount_x_min]

        if not date_words or not amount_words:
            continue

        raw_date = " ".join(date_words)
        parsed_date = _parse_date(raw_date)
        if not parsed_date and len(date_words) >= 2:
            parsed_date = _parse_date(" ".join(date_words[:2]))
        if not parsed_date:
            continue

        amount = next(
            (_parse_amount(t) for t in reversed(amount_words) if _parse_amount(t)),
            None,
        )
        if not amount:
            continue

        description = " ".join(desc_words).strip()
        if not description or len(description) < 2:
            description = raw_date

        lower_desc = description.lower()
        if any(h in lower_desc for h in ("description", "details", "narration", "balance", "opening", "closing")):
            continue

        results.append({
            "id": str(uuid.uuid4()),
            "date": parsed_date,
            "description": description,
            "amount": amount,
            "category": _auto_category_builtin(description),
        })

    return results


# ─────────────────────────────────────────────────────────────────────────────
# Strategy 2: extract_tables()
# ─────────────────────────────────────────────────────────────────────────────

def _extract_from_table(table: list[list]) -> list[dict]:
    if not table or len(table) < 2:
        return []

    header = [str(c or "").lower().strip() for c in table[0]]
    date_col = desc_col = amt_col = debit_col = -1

    for i, h in enumerate(header):
        if "date" in h and date_col == -1:
            date_col = i
        if any(w in h for w in ("description", "details", "narration", "particulars", "memo", "reference")) and desc_col == -1:
            desc_col = i
        if h in ("amount", "amt") and amt_col == -1:
            amt_col = i
        if any(w in h for w in ("debit", "withdrawal", "dr")) and debit_col == -1:
            debit_col = i

    if date_col == -1:
        for row in table[1:6]:
            cells = [str(c or "").strip() for c in row]
            for i, cell in enumerate(cells):
                if _parse_date(cell) and date_col == -1:
                    date_col = i
                elif desc_col == -1 and i != date_col and len(cell) > 4 and not _looks_like_amount(cell):
                    desc_col = i
                elif amt_col == -1 and i != date_col and _looks_like_amount(cell):
                    amt_col = i

    if date_col == -1 or desc_col == -1:
        return []

    results = []
    for row in table[1:]:
        cells = [str(c or "").strip() for c in row]
        raw_date = cells[date_col] if date_col < len(cells) else ""
        raw_desc = cells[desc_col] if desc_col < len(cells) else ""
        raw_dbt  = cells[debit_col] if debit_col >= 0 and debit_col < len(cells) else ""
        raw_amt  = cells[amt_col]   if amt_col   >= 0 and amt_col   < len(cells) else ""

        parsed_date = _parse_date(raw_date)
        if not parsed_date or not raw_desc:
            continue
        amount = _parse_amount(raw_dbt or raw_amt)
        if not amount:
            continue

        results.append({
            "id": str(uuid.uuid4()),
            "date": parsed_date,
            "description": raw_desc,
            "amount": round(amount, 2),
            "category": _auto_category_builtin(raw_desc),
        })

    return results


# ─────────────────────────────────────────────────────────────────────────────
# Strategy 3: raw-text regex fallback
# ─────────────────────────────────────────────────────────────────────────────

def _extract_from_text(text: str) -> list[dict]:
    results = []
    for line in text.split("\n"):
        line = line.strip()
        if len(line) < 10:
            continue
        m = _DATE_RE.search(line)
        if not m:
            continue
        parsed_date = _parse_date(m.group(0))
        if not parsed_date:
            continue
        remainder = (line[:m.start()] + line[m.end():]).strip()
        amt_m = re.search(r"[\d,]+\.\d{2}\s*$", remainder)
        if not amt_m:
            continue
        amount = _parse_amount(amt_m.group(0))
        if not amount:
            continue
        description = re.sub(r"\s+", " ", remainder[:amt_m.start()].strip())
        if not description or len(description) < 2:
            continue
        if description.lower() in ("description", "details", "narration"):
            continue
        results.append({
            "id": str(uuid.uuid4()),
            "date": parsed_date,
            "description": description,
            "amount": amount,
            "category": _auto_category_builtin(description),
        })
    return results


# ─────────────────────────────────────────────────────────────────────────────
# Apply learned rules to already-parsed transactions (batch DB lookup)
# ─────────────────────────────────────────────────────────────────────────────

async def apply_learned_rules(transactions: list[dict], db: AsyncSession) -> list[dict]:
    """
    For each transaction still marked 'uncategorized', check the learned rules DB.
    Mutates in-place and returns the same list.
    """
    uncategorized = [t for t in transactions if t["category"] == "uncategorized"]
    if not uncategorized:
        return transactions

    rules_result = await db.execute(
        select(MerchantRule).order_by(MerchantRule.hit_count.desc()).limit(1000)
    )
    rules = rules_result.scalars().all()

    for tx in uncategorized:
        norm = _normalize_keyword(tx["description"])
        for rule in rules:
            if rule.keyword in norm:
                tx["category"] = rule.category
                break

    return transactions


# ─────────────────────────────────────────────────────────────────────────────
# Public parse entry point
# ─────────────────────────────────────────────────────────────────────────────

def parse_pdf_bytes(pdf_bytes: bytes) -> tuple[list[dict], bool]:
    """
    Returns (transactions, unreadable).
    Each transaction: {id, date, description, amount, category}
    """
    try:
        import pdfplumber
        import io

        all_transactions: list[dict] = []

        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            for page in pdf.pages:
                page_results: list[dict] = []

                word_rows = _extract_by_words(page)
                page_results.extend(word_rows)

                if not word_rows:
                    for table in page.extract_tables():
                        page_results.extend(_extract_from_table(table))

                if not page_results:
                    text = page.extract_text() or ""
                    page_results.extend(_extract_from_text(text))

                all_transactions.extend(page_results)

        # Deduplicate within the file
        seen: set = set()
        unique: list[dict] = []
        for tx in all_transactions:
            key = (tx["date"], tx["description"].lower()[:40], tx["amount"])
            if key not in seen:
                seen.add(key)
                unique.append(tx)

        return unique, len(unique) == 0

    except Exception:
        return [], True


# ─────────────────────────────────────────────────────────────────────────────
# Recurring / bill detection
# ─────────────────────────────────────────────────────────────────────────────

def _merchant_key(description: str) -> str:
    cleaned = re.sub(r"\s*\d{4,}\s*$", "", description)
    cleaned = re.sub(r"[^a-z0-9 ]", " ", cleaned.lower())
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    words = [w for w in cleaned.split() if len(w) > 2]
    return " ".join(words[:4])


def detect_recurring(transactions: list[dict]) -> tuple[list[dict], list[dict]]:
    """Split into (suggested_bills, regular_transactions)."""
    by_merchant: dict[str, list[dict]] = defaultdict(list)
    for tx in transactions:
        key = _merchant_key(tx["description"])
        by_merchant[key].append(tx)

    bill_ids: set[str] = set()
    bills: list[dict] = []

    for merchant_key, group in by_merchant.items():
        if len(group) < 2:
            continue
        months = {(t["date"].year, t["date"].month) for t in group}
        if len(months) < 2:
            continue
        days = [t["date"].day for t in group]
        if max(days) - min(days) > 4:
            continue

        rep = sorted(group, key=lambda t: t["date"])[-1]
        avg_amount = round(sum(t["amount"] for t in group) / len(group), 2)
        due_day = min(max(round(sum(days) / len(days)), 1), 28)

        bills.append({
            "id": str(uuid.uuid4()),
            "name": rep["description"].title()[:60],
            "amount": avg_amount,
            "currency": "AUD",
            "due_day": due_day,
            "category": rep["category"],
            "sample_dates": [str(t["date"]) for t in sorted(group, key=lambda t: t["date"])],
        })
        bill_ids.update(t["id"] for t in group)

    regular = [
        {
            "id": tx["id"],
            "date": str(tx["date"]),
            "description": tx["description"],
            "amount": tx["amount"],
            "category": tx["category"],
        }
        for tx in transactions
        if tx["id"] not in bill_ids
    ]

    return bills, regular


# ─────────────────────────────────────────────────────────────────────────────
# Duplicate detection against DB
# ─────────────────────────────────────────────────────────────────────────────

def _similar(a: str, b: str) -> bool:
    a_words = set(re.findall(r"\w{3,}", a.lower()))
    b_words = set(re.findall(r"\w{3,}", b.lower()))
    if not a_words or not b_words:
        return a.lower() == b.lower()
    overlap = len(a_words & b_words) / max(len(a_words), len(b_words))
    return overlap >= 0.6


async def filter_duplicates(
    account_id: str,
    transactions: list[dict],
    db: AsyncSession,
) -> tuple[list[dict], int]:
    if not transactions:
        return [], 0

    dates = list({
        tx["date"] if isinstance(tx["date"], date) else date.fromisoformat(tx["date"])
        for tx in transactions
    })

    result = await db.execute(
        select(DBTransaction).where(
            and_(
                DBTransaction.account_id == account_id,
                DBTransaction.transaction_date.in_(dates),
            )
        )
    )
    existing = result.scalars().all()

    existing_map: dict[date, list[tuple[float, str]]] = defaultdict(list)
    for ex in existing:
        existing_map[ex.transaction_date].append((float(ex.amount), ex.description or ""))

    unique, skipped = [], 0
    for tx in transactions:
        tx_date = tx["date"] if isinstance(tx["date"], date) else date.fromisoformat(tx["date"])
        is_dup = any(
            abs(ex_amt - tx["amount"]) < 0.01 and _similar(tx["description"], ex_desc)
            for ex_amt, ex_desc in existing_map.get(tx_date, [])
        )
        if is_dup:
            skipped += 1
        else:
            unique.append(tx)

    return unique, skipped
