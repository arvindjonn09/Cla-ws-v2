"""debt joint mirrors

Revision ID: 0003
Revises: 0002
Create Date: 2026-04-25 00:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("debts", sa.Column("is_locked", sa.Boolean(), server_default=sa.text("false"), nullable=False))
    op.add_column("debts", sa.Column("shared_from_debt_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("debts", sa.Column("shared_to_account_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("debts", sa.Column("shared_to_debt_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("fk_debts_shared_from_debt_id", "debts", "debts", ["shared_from_debt_id"], ["id"])
    op.create_foreign_key("fk_debts_shared_to_account_id", "debts", "accounts", ["shared_to_account_id"], ["id"])
    op.create_foreign_key("fk_debts_shared_to_debt_id", "debts", "debts", ["shared_to_debt_id"], ["id"])
    op.create_index("ix_debts_shared_from_debt_id", "debts", ["shared_from_debt_id"])
    op.create_index("ix_debts_shared_to_debt_id", "debts", ["shared_to_debt_id"])


def downgrade() -> None:
    op.drop_index("ix_debts_shared_to_debt_id", table_name="debts")
    op.drop_index("ix_debts_shared_from_debt_id", table_name="debts")
    op.drop_constraint("fk_debts_shared_to_debt_id", "debts", type_="foreignkey")
    op.drop_constraint("fk_debts_shared_to_account_id", "debts", type_="foreignkey")
    op.drop_constraint("fk_debts_shared_from_debt_id", "debts", type_="foreignkey")
    op.drop_column("debts", "shared_to_debt_id")
    op.drop_column("debts", "shared_to_account_id")
    op.drop_column("debts", "shared_from_debt_id")
    op.drop_column("debts", "is_locked")
