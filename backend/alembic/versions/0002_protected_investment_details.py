"""protected investment details

Revision ID: 0002
Revises: 0001
Create Date: 2026-04-25 00:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("investments", sa.Column("visibility", sa.String(), server_default="personal", nullable=False))
    op.add_column("investments", sa.Column("has_secure_details", sa.Boolean(), server_default=sa.text("false"), nullable=False))
    op.execute("""
        UPDATE investments
        SET visibility = 'shared'
        FROM accounts
        WHERE investments.account_id = accounts.id
          AND accounts.type = 'joint'
    """)
    op.create_check_constraint("ck_investment_visibility", "investments", "visibility IN ('personal', 'shared')")

    op.create_table(
        "investment_secure_details",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("investment_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("investments.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("nonce", sa.LargeBinary(), nullable=False),
        sa.Column("ciphertext", sa.LargeBinary(), nullable=False),
        sa.Column("updated_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_investment_secure_details_investment_id", "investment_secure_details", ["investment_id"])

    op.create_table(
        "investment_secure_codes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("investment_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("investments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("code_hash", sa.String(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_investment_secure_codes_investment_id", "investment_secure_codes", ["investment_id"])
    op.create_index("ix_investment_secure_codes_user_id", "investment_secure_codes", ["user_id"])

    op.create_table(
        "investment_secure_access_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("investment_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("investments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("action", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("ip_address", sa.String(), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("action IN ('request_code', 'view_secure_details')", name="ck_investment_secure_log_action"),
        sa.CheckConstraint("status IN ('success', 'failed')", name="ck_investment_secure_log_status"),
    )
    op.create_index("ix_investment_secure_access_log_investment_id", "investment_secure_access_log", ["investment_id"])
    op.create_index("ix_investment_secure_access_log_user_id", "investment_secure_access_log", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_investment_secure_access_log_user_id", table_name="investment_secure_access_log")
    op.drop_index("ix_investment_secure_access_log_investment_id", table_name="investment_secure_access_log")
    op.drop_table("investment_secure_access_log")
    op.drop_index("ix_investment_secure_codes_user_id", table_name="investment_secure_codes")
    op.drop_index("ix_investment_secure_codes_investment_id", table_name="investment_secure_codes")
    op.drop_table("investment_secure_codes")
    op.drop_index("ix_investment_secure_details_investment_id", table_name="investment_secure_details")
    op.drop_table("investment_secure_details")
    op.drop_constraint("ck_investment_visibility", "investments", type_="check")
    op.drop_column("investments", "has_secure_details")
    op.drop_column("investments", "visibility")
