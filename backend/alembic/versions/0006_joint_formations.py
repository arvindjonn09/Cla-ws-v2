"""joint_formations: immutable record when both members join

Revision ID: 0006
Revises: 0005
Create Date: 2026-04-28
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "joint_formations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("account_id", UUID(as_uuid=True), sa.ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("member_1_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("member_2_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("formed_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("joint_formations")
