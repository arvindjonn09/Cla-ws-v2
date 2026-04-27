"""
PDF bank statement import.

POST .../transactions/import-pdf   — parse PDF → preview JSON
POST .../transactions/import-bulk  — save confirmed transactions to DB
POST /api/merchant-rules/learn     — save user-assigned categories as global rules
"""

import logging
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

from app.core.database import get_db
from app.models.account import AccountMember
from app.models.transaction import Transaction
from app.models.user import User
from app.api.deps import get_current_user, require_full_member
from app.services.pdf_parser import (
    parse_pdf_bytes,
    detect_recurring,
    filter_duplicates,
    apply_learned_rules,
    save_merchant_rules,
)

router = APIRouter(tags=["import"])

MAX_PDF_BYTES = 20 * 1024 * 1024  # 20 MB

# ─────────────────────────────────────────────────────────────────────────────
# Response / request schemas
# ─────────────────────────────────────────────────────────────────────────────

class PreviewBill(BaseModel):
    id: str
    name: str
    amount: float
    currency: str
    due_day: int
    category: str
    sample_dates: list[str]


class PreviewTransaction(BaseModel):
    id: str
    date: str
    description: str
    amount: float
    category: str


class PreviewTransfer(BaseModel):
    id: str
    date: str
    description: str
    amount: float


class ImportPreviewResponse(BaseModel):
    bills: list[PreviewBill]
    transactions: list[PreviewTransaction]
    transfers: list[PreviewTransfer]
    skipped_duplicates: int
    unreadable: bool


class BulkTransactionItem(BaseModel):
    date: str
    description: str
    amount: float
    category: str
    currency: str = "AUD"
    type: str = "expense"


class BulkImportBody(BaseModel):
    transactions: list[BulkTransactionItem]


class BulkImportResponse(BaseModel):
    saved: int


class LearnRuleItem(BaseModel):
    description: str
    category: str


class LearnRulesBody(BaseModel):
    corrections: list[LearnRuleItem]


# ─────────────────────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@router.post(
    "/api/accounts/{account_id}/transactions/import-pdf",
    response_model=ImportPreviewResponse,
)
async def import_pdf(
    account_id: UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    member: Annotated[AccountMember, Depends(require_full_member)],
    db: Annotated[AsyncSession, Depends(get_db)],
    file: UploadFile = File(...),
):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    pdf_bytes = await file.read()
    if len(pdf_bytes) > MAX_PDF_BYTES:
        raise HTTPException(status_code=413, detail="PDF exceeds 20 MB limit")

    try:
        # Parse
        raw_transactions, unreadable = parse_pdf_bytes(pdf_bytes)
        logger.info("PDF parsed: %d raw transactions, unreadable=%s", len(raw_transactions), unreadable)

        # Apply learned rules to anything still uncategorized
        raw_transactions = await apply_learned_rules(raw_transactions, db)

        # Separate transfers — they get a special IOU UI on the frontend
        transfers_raw = [t for t in raw_transactions if t["category"] == "transfer"]
        non_transfers  = [t for t in raw_transactions if t["category"] != "transfer"]

        # Detect recurring bill candidates (non-transfers only)
        bills, transactions = detect_recurring(non_transfers)

        # Remove duplicates already in DB
        transactions, skipped = await filter_duplicates(str(account_id), transactions, db)

        # Transfers skip recurring detection but still get dupe-filtered
        transfers_clean, skipped_t = await filter_duplicates(str(account_id), transfers_raw, db)
        skipped += skipped_t

        # Normalise dates to ISO strings (transfers bypass detect_recurring which normally does this)
        transfer_items = [
            {
                "id": t["id"],
                "date": str(t["date"]),          # datetime.date → "YYYY-MM-DD"
                "description": t["description"],
                "amount": t["amount"],
            }
            for t in transfers_clean
        ]

        logger.info(
            "Import preview ready: %d bills, %d txs, %d transfers, %d skipped",
            len(bills), len(transactions), len(transfer_items), skipped,
        )

        return ImportPreviewResponse(
            bills=bills,
            transactions=transactions,
            transfers=transfer_items,
            skipped_duplicates=skipped,
            unreadable=unreadable,
        )

    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Unhandled error in import_pdf for account %s", account_id)
        raise HTTPException(status_code=500, detail=f"Import failed: {exc}") from exc


@router.post(
    "/api/accounts/{account_id}/transactions/import-bulk",
    response_model=BulkImportResponse,
    status_code=201,
)
async def import_bulk(
    account_id: UUID,
    body: BulkImportBody,
    current_user: Annotated[User, Depends(get_current_user)],
    member: Annotated[AccountMember, Depends(require_full_member)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    from datetime import date as date_type

    if not body.transactions:
        return BulkImportResponse(saved=0)

    if len(body.transactions) > 500:
        raise HTTPException(status_code=400, detail="Maximum 500 transactions per import")

    VALID_TYPES = {"income", "expense", "transfer", "debt_payment"}

    saved = 0
    for item in body.transactions:
        try:
            tx_date = date_type.fromisoformat(item.date)
        except ValueError:
            continue

        tx_type = item.type if item.type in VALID_TYPES else "expense"

        tx = Transaction(
            account_id=account_id,
            user_id=current_user.id,
            amount=item.amount,
            type=tx_type,
            category=item.category,
            description=item.description,
            transaction_date=tx_date,
            currency=item.currency,
            is_shared=False,
        )
        db.add(tx)
        saved += 1

    await db.commit()
    return BulkImportResponse(saved=saved)


@router.post("/api/merchant-rules/learn")
async def learn_rules(
    body: LearnRulesBody,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """
    Save user-assigned categories as global learned rules.
    Called when the user confirms an import — sends back any manually-changed categories.
    """
    saved = await save_merchant_rules(
        [{"description": c.description, "category": c.category} for c in body.corrections],
        db,
    )
    return {"learned": saved}
