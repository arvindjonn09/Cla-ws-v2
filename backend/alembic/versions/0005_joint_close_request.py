"""joint close request — track which member requested account closure

Revision ID: 0005
Revises: 0004
Create Date: 2026-04-26
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "accounts",
        sa.Column("close_requested_by", UUID(as_uuid=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("accounts", "close_requested_by")
