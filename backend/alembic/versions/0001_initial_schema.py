"""initial schema — matches ORM models exactly

Revision ID: 0001
Revises:
Create Date: 2026-04-23 00:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')

    # ── users ──────────────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("is_verified", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("verification_token", sa.String(255), nullable=True),
        sa.Column("verification_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reset_token", sa.String(255), nullable=True),
        sa.Column("reset_token_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_users_email", "users", ["email"])

    # ── sessions ───────────────────────────────────────────────────────────────
    op.create_table(
        "sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token", sa.String(512), nullable=False, unique=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_sessions_user_id", "sessions", ["user_id"])

    # ── accounts ───────────────────────────────────────────────────────────────
    op.create_table(
        "accounts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("type", sa.String(20), nullable=False),
        sa.Column("name", sa.String(255), nullable=True),
        sa.Column("base_currency", sa.String(10), server_default="ZAR", nullable=False),
        sa.Column("status", sa.String(20), server_default="active", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("type IN ('personal', 'joint')", name="ck_accounts_type"),
        sa.CheckConstraint("status IN ('active', 'closed')", name="ck_accounts_status"),
    )

    # ── account_members ────────────────────────────────────────────────────────
    op.create_table(
        "account_members",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("status", sa.String(20), server_default="active", nullable=False),
        sa.Column("joined_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("account_id", "user_id", name="uq_account_members"),
        sa.CheckConstraint("role IN ('member', 'viewer')", name="ck_account_members_role"),
        sa.CheckConstraint("status IN ('active', 'pending', 'removed')", name="ck_account_members_status"),
    )
    op.create_index("ix_account_members_account_id", "account_members", ["account_id"])
    op.create_index("ix_account_members_user_id", "account_members", ["user_id"])
    # Business Rule #1 — one active joint membership per user (DB-enforced).
    # PostgreSQL partial indexes cannot use subqueries, so this uses a trigger.
    op.execute("""
        CREATE OR REPLACE FUNCTION enforce_one_active_joint_member()
        RETURNS trigger AS $$
        BEGIN
            IF NEW.role = 'member'
               AND NEW.status = 'active'
               AND EXISTS (
                   SELECT 1 FROM accounts
                   WHERE id = NEW.account_id
                     AND type = 'joint'
                     AND status = 'active'
               )
               AND EXISTS (
                   SELECT 1
                   FROM account_members am
                   JOIN accounts a ON a.id = am.account_id
                   WHERE am.user_id = NEW.user_id
                     AND am.role = 'member'
                     AND am.status = 'active'
                     AND a.type = 'joint'
                     AND a.status = 'active'
                     AND am.id <> NEW.id
               )
            THEN
                RAISE EXCEPTION 'user already has an active joint account';
            END IF;

            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)
    op.execute("""
        CREATE TRIGGER trg_one_active_joint_member
        BEFORE INSERT OR UPDATE OF account_id, user_id, role, status
        ON account_members
        FOR EACH ROW
        EXECUTE FUNCTION enforce_one_active_joint_member();
    """)

    # ── invite_tokens ──────────────────────────────────────────────────────────
    op.create_table(
        "invite_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("invited_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("role", sa.String(20), server_default="member", nullable=False),
        sa.Column("token", sa.String(255), nullable=False, unique=True),
        sa.Column("status", sa.String(20), server_default="pending", nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("role IN ('member', 'viewer')", name="ck_invite_role"),
        sa.CheckConstraint("status IN ('pending', 'accepted', 'declined', 'expired')", name="ck_invite_status"),
    )

    # ── user_profiles ──────────────────────────────────────────────────────────
    op.create_table(
        "user_profiles",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("country", sa.String(100), nullable=True),
        sa.Column("city", sa.String(100), nullable=True),
        sa.Column("local_currency", sa.String(10), nullable=True),
        sa.Column("income_type", sa.String(50), nullable=True),
        sa.Column("pay_frequency", sa.String(20), nullable=True),
        sa.Column("pay_day", sa.String(20), nullable=True),
        sa.Column("income_month_1", sa.Numeric(15, 2), nullable=True),
        sa.Column("income_month_2", sa.Numeric(15, 2), nullable=True),
        sa.Column("income_month_3", sa.Numeric(15, 2), nullable=True),
        sa.Column("income_baseline", sa.Numeric(15, 2), nullable=True),
        sa.Column("income_lowest", sa.Numeric(15, 2), nullable=True),
        sa.Column("financial_situation", sa.String(50), nullable=True),
        sa.Column("primary_goal", sa.String(255), nullable=True),
        sa.Column("debt_method", sa.String(20), server_default="snowball", nullable=False),
        sa.Column("motivation_style", sa.String(50), nullable=True),
        sa.Column("spending_personality", sa.String(100), nullable=True),
        sa.Column("onboarding_complete", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("income_type IN ('fixed', 'casual', 'variable', 'multiple')", name="ck_profile_income_type"),
        sa.CheckConstraint("pay_frequency IN ('weekly', 'biweekly', 'monthly', 'irregular')", name="ck_profile_pay_freq"),
        sa.CheckConstraint("debt_method IN ('snowball', 'avalanche', 'custom')", name="ck_profile_debt_method"),
    )
    op.create_index("ix_user_profiles_user_id", "user_profiles", ["user_id"])
    op.create_index("ix_user_profiles_account_id", "user_profiles", ["account_id"])

    # ── debts ──────────────────────────────────────────────────────────────────
    op.create_table(
        "debts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("added_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("debt_type", sa.String(50), nullable=False),
        sa.Column("payment_type", sa.String(20), nullable=True),
        sa.Column("original_balance", sa.Numeric(15, 2), nullable=False),
        sa.Column("current_balance", sa.Numeric(15, 2), nullable=False),
        sa.Column("minimum_payment", sa.Numeric(15, 2), nullable=True),
        sa.Column("actual_payment", sa.Numeric(15, 2), nullable=True),
        sa.Column("payment_frequency", sa.String(20), nullable=True),
        sa.Column("payment_day", sa.String(20), nullable=True),
        sa.Column("has_interest", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("interest_rate", sa.Numeric(5, 2), nullable=True),
        sa.Column("months_remaining", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(20), server_default="active", nullable=False),
        sa.Column("cleared_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("currency", sa.String(10), server_default="ZAR", nullable=False),
        sa.Column("is_shared", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "debt_type IN ('credit_card','personal_loan','car_finance','student_loan','home_loan','store_account','personal','other')",
            name="ck_debt_type",
        ),
        sa.CheckConstraint("payment_type IN ('fixed', 'variable', 'app_decided')", name="ck_debt_payment_type"),
        sa.CheckConstraint("payment_frequency IN ('weekly', 'biweekly', 'monthly')", name="ck_debt_pay_freq"),
        sa.CheckConstraint("status IN ('active', 'cleared', 'paused')", name="ck_debt_status"),
    )
    op.create_index("ix_debts_account_id", "debts", ["account_id"])

    # ── debt_payments ──────────────────────────────────────────────────────────
    op.create_table(
        "debt_payments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("debt_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("debts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("accounts.id"), nullable=True),
        sa.Column("paid_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("amount", sa.Numeric(15, 2), nullable=False),
        sa.Column("extra_amount", sa.Numeric(15, 2), server_default="0", nullable=False),
        sa.Column("payment_date", sa.Date(), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("status", sa.String(20), server_default="pending", nullable=False),
        sa.Column("extension_requested", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("extension_days", sa.Integer(), nullable=True),
        sa.Column("extension_reason", sa.String(500), nullable=True),
        sa.Column("extension_due_date", sa.Date(), nullable=True),
        sa.Column("member_b_amount", sa.Numeric(15, 2), nullable=True),
        sa.Column("member_b_confirmed", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("team_option_used", sa.String(100), nullable=True),
        sa.Column("notes", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("status IN ('pending', 'confirmed', 'late', 'extended')", name="ck_debt_payment_status"),
    )
    op.create_index("ix_debt_payments_debt_id", "debt_payments", ["debt_id"])

    # ── transactions ───────────────────────────────────────────────────────────
    op.create_table(
        "transactions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("amount", sa.Numeric(15, 2), nullable=False),
        sa.Column("type", sa.String(30), nullable=False),
        sa.Column("category", sa.String(100), nullable=True),
        sa.Column("subcategory", sa.String(100), nullable=True),
        sa.Column("description", sa.String(500), nullable=True),
        sa.Column("transaction_date", sa.Date(), nullable=False),
        sa.Column("currency", sa.String(10), server_default="ZAR", nullable=False),
        sa.Column("is_shared", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("split_type", sa.String(20), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("type IN ('income', 'expense', 'transfer', 'debt_payment')", name="ck_transaction_type"),
        sa.CheckConstraint("split_type IN ('shared', 'personal', 'grey')", name="ck_transaction_split"),
    )
    op.create_index("ix_transactions_account_id", "transactions", ["account_id"])
    op.create_index("ix_transactions_transaction_date", "transactions", ["transaction_date"])
    op.create_index("ix_transactions_category", "transactions", ["category"])

    # ── goals ──────────────────────────────────────────────────────────────────
    op.create_table(
        "goals",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("goal_type", sa.String(50), nullable=False),
        sa.Column("target_amount", sa.Numeric(15, 2), nullable=False),
        sa.Column("current_amount", sa.Numeric(15, 2), server_default="0", nullable=False),
        sa.Column("currency", sa.String(10), server_default="ZAR", nullable=False),
        sa.Column("target_date", sa.Date(), nullable=True),
        sa.Column("status", sa.String(20), server_default="active", nullable=False),
        sa.Column("priority", sa.Integer(), server_default="1", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "goal_type IN ('emergency_fund','debt_payoff','savings','house_deposit','holiday','education','custom')",
            name="ck_goal_type",
        ),
        sa.CheckConstraint("status IN ('active', 'completed', 'paused')", name="ck_goal_status"),
    )
    op.create_index("ix_goals_account_id", "goals", ["account_id"])

    # ── investments ────────────────────────────────────────────────────────────
    op.create_table(
        "investments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("added_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("asset_type", sa.String(50), nullable=False),
        sa.Column("currency", sa.String(10), nullable=False),
        sa.Column("units", sa.Numeric(15, 6), nullable=True),
        sa.Column("purchase_price", sa.Numeric(15, 2), nullable=True),
        sa.Column("current_price", sa.Numeric(15, 2), nullable=True),
        sa.Column("current_value", sa.Numeric(15, 2), nullable=True),
        sa.Column("base_currency_value", sa.Numeric(15, 2), nullable=True),
        sa.Column("country", sa.String(100), nullable=True),
        sa.Column("status", sa.String(20), server_default="active", nullable=False),
        sa.Column("purchased_at", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "asset_type IN ('stocks','bonds','mutual_funds','property','crypto','fixed_deposit','retirement','foreign_cash','other')",
            name="ck_investment_asset_type",
        ),
        sa.CheckConstraint("status IN ('active', 'sold')", name="ck_investment_status"),
    )
    op.create_index("ix_investments_account_id", "investments", ["account_id"])

    # ── exchange_rates ─────────────────────────────────────────────────────────
    op.create_table(
        "exchange_rates",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("from_currency", sa.String(10), nullable=False),
        sa.Column("to_currency", sa.String(10), nullable=False),
        sa.Column("rate", sa.Numeric(20, 8), nullable=False),
        sa.Column("fetched_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("source", sa.String(50), server_default="frankfurter", nullable=False),
        sa.Column("status", sa.String(20), server_default="live", nullable=False),
        sa.CheckConstraint("status IN ('live', 'stale', 'error')", name="ck_exchange_rate_status"),
    )
    op.create_index("ix_exchange_rates_currencies", "exchange_rates", ["from_currency", "to_currency"])

    # ── subscriptions ──────────────────────────────────────────────────────────
    op.create_table(
        "subscriptions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("amount", sa.Numeric(15, 2), nullable=False),
        sa.Column("currency", sa.String(10), server_default="ZAR", nullable=False),
        sa.Column("frequency", sa.String(20), nullable=True),
        sa.Column("category", sa.String(100), nullable=True),
        sa.Column("is_shared", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("status", sa.String(20), server_default="active", nullable=False),
        sa.Column("next_charge_date", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("frequency IN ('weekly', 'monthly', 'yearly')", name="ck_sub_frequency"),
        sa.CheckConstraint("status IN ('active', 'cancelled', 'paused')", name="ck_sub_status"),
    )
    op.create_index("ix_subscriptions_account_id", "subscriptions", ["account_id"])

    # ── bills ──────────────────────────────────────────────────────────────────
    op.create_table(
        "bills",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("amount", sa.Numeric(15, 2), nullable=False),
        sa.Column("currency", sa.String(10), server_default="ZAR", nullable=False),
        sa.Column("frequency", sa.String(20), nullable=True),
        sa.Column("due_day", sa.Integer(), nullable=True),
        sa.Column("is_shared", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("status", sa.String(20), server_default="active", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_bills_account_id", "bills", ["account_id"])

    # ── spending_boundaries ────────────────────────────────────────────────────
    op.create_table(
        "spending_boundaries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("category", sa.String(100), nullable=False),
        sa.Column("classification", sa.String(20), nullable=False),
        sa.Column("split_method", sa.String(20), nullable=True),
        sa.Column("member_a_percentage", sa.Numeric(5, 2), nullable=True),
        sa.Column("member_b_percentage", sa.Numeric(5, 2), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("set_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("classification IN ('shared', 'personal', 'grey')", name="ck_boundary_class"),
        sa.CheckConstraint("split_method IN ('equal', 'percentage', 'decide_each_time')", name="ck_boundary_split"),
    )
    op.create_index("ix_spending_boundaries_account_id", "spending_boundaries", ["account_id"])

    # ── payment_warnings ───────────────────────────────────────────────────────
    op.create_table(
        "payment_warnings",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("debt_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("debts.id"), nullable=True),
        sa.Column("debt_payment_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("debt_payments.id"), nullable=True),
        sa.Column("due_date", sa.Date(), nullable=False),
        sa.Column("warning_type", sa.String(30), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("member_a_confirmed", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("member_b_confirmed", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "warning_type IN ('30_day','7_day','4_day','3_day','1_day','payment_day','3_day_after')",
            name="ck_warning_type",
        ),
    )
    op.create_index("ix_payment_warnings_account_id", "payment_warnings", ["account_id"])

    # ── joint_scenarios ────────────────────────────────────────────────────────
    op.create_table(
        "joint_scenarios",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("scenario_data", postgresql.JSONB(), nullable=True),
        sa.Column("projected_freedom_date", sa.Date(), nullable=True),
        sa.Column("status", sa.String(20), server_default="draft", nullable=False),
        sa.Column("decision", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("status IN ('draft', 'shared', 'decided', 'archived')", name="ck_scenario_status"),
    )
    op.create_index("ix_joint_scenarios_account_id", "joint_scenarios", ["account_id"])

    # ── sacrifice_log ──────────────────────────────────────────────────────────
    op.create_table(
        "sacrifice_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("amount_saved", sa.Numeric(15, 2), nullable=True),
        sa.Column("logged_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_sacrifice_log_account_id", "sacrifice_log", ["account_id"])

    # ── safe_space_messages ────────────────────────────────────────────────────
    op.create_table(
        "safe_space_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sender_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("is_read", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_safe_space_messages_account_id", "safe_space_messages", ["account_id"])

    # ── journal_entries ────────────────────────────────────────────────────────
    op.create_table(
        "journal_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("entry_date", sa.Date(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_journal_entries_account_id", "journal_entries", ["account_id"])

    # ── milestones ─────────────────────────────────────────────────────────────
    op.create_table(
        "milestones",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("milestone_type", sa.String(50), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("related_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("achieved_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("celebrated", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.CheckConstraint(
            "milestone_type IN ('debt_cleared','emergency_fund_built','stage_unlocked','first_investment','freedom_date_updated','savings_goal_hit')",
            name="ck_milestone_type",
        ),
    )
    op.create_index("ix_milestones_account_id", "milestones", ["account_id"])

    # ── email_log ──────────────────────────────────────────────────────────────
    op.create_table(
        "email_log",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("recipient", sa.String(255), nullable=False),
        sa.Column("subject", sa.String(500), nullable=False),
        sa.Column("html_body", sa.Text(), nullable=False),
        sa.Column("trigger_type", sa.String(100), nullable=False),
        sa.Column("account_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("status", sa.String(20), server_default="queued", nullable=False),
        sa.Column("attempts", sa.Integer(), server_default="0", nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("status IN ('queued', 'sent', 'failed', 'skipped')", name="ck_email_log_status"),
    )
    op.create_index("ix_email_log_status", "email_log", ["status"])

    # ── notification_preferences ───────────────────────────────────────────────
    op.create_table(
        "notification_preferences",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("account_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("accounts.id"), nullable=True),
        sa.Column("payment_reminders", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("milestone_celebrations", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("security_alerts", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("goal_updates", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("freedom_date_changes", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("weekly_summary", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("channel_email", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("channel_push", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_notification_preferences_user_id", "notification_preferences", ["user_id"])


def downgrade() -> None:
    op.execute("DROP TRIGGER IF EXISTS trg_one_active_joint_member ON account_members")
    op.execute("DROP FUNCTION IF EXISTS enforce_one_active_joint_member()")
    op.drop_table("notification_preferences")
    op.drop_table("email_log")
    op.drop_table("milestones")
    op.drop_table("journal_entries")
    op.drop_table("safe_space_messages")
    op.drop_table("sacrifice_log")
    op.drop_table("joint_scenarios")
    op.drop_table("payment_warnings")
    op.drop_table("spending_boundaries")
    op.drop_table("bills")
    op.drop_table("subscriptions")
    op.drop_table("exchange_rates")
    op.drop_table("investments")
    op.drop_table("goals")
    op.drop_table("transactions")
    op.drop_table("debt_payments")
    op.drop_table("debts")
    op.drop_table("user_profiles")
    op.drop_table("invite_tokens")
    op.drop_table("account_members")
    op.drop_table("accounts")
    op.drop_table("sessions")
    op.drop_table("users")
