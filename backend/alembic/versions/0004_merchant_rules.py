"""merchant_rules — global learned categorisation rules

Revision ID: 0002
Revises: 0001
Create Date: 2026-04-25
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "merchant_rules",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("keyword", sa.String(200), nullable=False, unique=True),
        sa.Column("category", sa.String(50), nullable=False),
        sa.Column("hit_count", sa.Integer(), server_default="1", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_merchant_rules_keyword", "merchant_rules", ["keyword"])


def downgrade() -> None:
    op.drop_index("ix_merchant_rules_keyword", table_name="merchant_rules")
    op.drop_table("merchant_rules")
