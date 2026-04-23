-- Financial Command Center — PostgreSQL 16 schema
-- Run once against an empty fcc_db database.
-- Alembic is the migration tool; keep this reference aligned with 0001_initial_schema.py.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────────────────────
-- USERS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE users (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email                       VARCHAR(255) NOT NULL UNIQUE,
    password_hash               VARCHAR(255) NOT NULL,
    full_name                   VARCHAR(255) NOT NULL,
    is_verified                 BOOLEAN NOT NULL DEFAULT FALSE,
    verification_token          VARCHAR(255),
    verification_expires_at     TIMESTAMPTZ,
    reset_token                 VARCHAR(255),
    reset_token_expires_at      TIMESTAMPTZ,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE sessions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token         VARCHAR(512) NOT NULL UNIQUE,
    expires_at    TIMESTAMPTZ NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_sessions_user_id ON sessions(user_id);

-- ─────────────────────────────────────────────────────────────
-- ACCOUNTS & MEMBERS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE accounts (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type          VARCHAR(20) NOT NULL,          -- personal | joint
    name          VARCHAR(255),
    base_currency VARCHAR(10) NOT NULL DEFAULT 'ZAR',
    status        VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE account_members (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role       VARCHAR(20) NOT NULL DEFAULT 'member',  -- member | viewer
    status     VARCHAR(20) NOT NULL DEFAULT 'active',
    joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_account_members_account_user UNIQUE (account_id, user_id)
);
CREATE INDEX ix_account_members_account_id ON account_members(account_id);
CREATE INDEX ix_account_members_user_id    ON account_members(user_id);

-- Enforce one active joint membership per user (at DB level).
-- PostgreSQL partial indexes cannot use subqueries, so this uses a trigger.
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

CREATE TRIGGER trg_one_active_joint_member
BEFORE INSERT OR UPDATE OF account_id, user_id, role, status
ON account_members
FOR EACH ROW
EXECUTE FUNCTION enforce_one_active_joint_member();

CREATE TABLE invite_tokens (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    invited_by UUID NOT NULL REFERENCES users(id),
    email      VARCHAR(255) NOT NULL,
    role       VARCHAR(20) NOT NULL DEFAULT 'member',
    token      VARCHAR(255) NOT NULL UNIQUE,
    status     VARCHAR(20) NOT NULL DEFAULT 'pending',
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- USER PROFILES (1:1 with account)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE user_profiles (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id           UUID NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
    income_type          VARCHAR(50),   -- fixed | casual | variable | multiple
    income_months        JSONB,         -- array of {month, amount} for 3-month baseline
    income_baseline      NUMERIC(15,2),
    income_lowest        NUMERIC(15,2),
    employment_status    VARCHAR(50),
    financial_situation  VARCHAR(50),
    debt_method          VARCHAR(20) NOT NULL DEFAULT 'snowball',
    onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- DEBTS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE debts (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id       UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    name             VARCHAR(255) NOT NULL,
    debt_type        VARCHAR(50) NOT NULL
                         CHECK (debt_type IN ('credit_card','personal_loan','student_loan',
                                              'car_loan','home_loan','store_account',
                                              'medical_debt','tax_debt','other')),
    payment_type     VARCHAR(20) NOT NULL DEFAULT 'fixed',
    original_balance NUMERIC(15,2) NOT NULL,
    current_balance  NUMERIC(15,2) NOT NULL,
    interest_rate    NUMERIC(8,4) NOT NULL,
    minimum_payment  NUMERIC(15,2) NOT NULL,
    months_remaining INTEGER,
    due_date         INTEGER,          -- day-of-month
    status           VARCHAR(20) NOT NULL DEFAULT 'active',
    notes            TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_debts_account_id ON debts(account_id);

CREATE TABLE debt_payments (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    debt_id          UUID NOT NULL REFERENCES debts(id) ON DELETE CASCADE,
    account_id       UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    amount           NUMERIC(15,2) NOT NULL,
    extra_amount     NUMERIC(15,2) NOT NULL DEFAULT 0,
    payment_date     DATE NOT NULL,
    balance_after    NUMERIC(15,2) NOT NULL,
    note             TEXT,
    member_a_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    member_b_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_debt_payments_debt_id ON debt_payments(debt_id);

-- ─────────────────────────────────────────────────────────────
-- TRANSACTIONS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE transactions (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id       UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    type             VARCHAR(30) NOT NULL,   -- income | expense | transfer | debt_payment
    amount           NUMERIC(15,2) NOT NULL,
    category         VARCHAR(100),
    description      TEXT,
    split_type       VARCHAR(20),            -- shared | personal | grey
    transaction_date DATE NOT NULL,
    created_by       UUID REFERENCES users(id),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_transactions_account_id       ON transactions(account_id);
CREATE INDEX ix_transactions_transaction_date ON transactions(transaction_date);

-- ─────────────────────────────────────────────────────────────
-- GOALS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE goals (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id     UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    name           VARCHAR(255) NOT NULL,
    goal_type      VARCHAR(50) NOT NULL
                       CHECK (goal_type IN ('emergency_fund','sinking_fund','vacation',
                                            'education','home_deposit','vehicle',
                                            'retirement','business','other')),
    target_amount  NUMERIC(15,2) NOT NULL,
    current_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    target_date    DATE,
    priority       INTEGER NOT NULL DEFAULT 1,
    status         VARCHAR(20) NOT NULL DEFAULT 'active',
    notes          TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_goals_account_id ON goals(account_id);

-- ─────────────────────────────────────────────────────────────
-- INVESTMENTS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE investments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id          UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    name                VARCHAR(255) NOT NULL,
    asset_type          VARCHAR(50) NOT NULL
                            CHECK (asset_type IN ('etf','unit_trust','stock','crypto',
                                                  'property','retirement_annuity',
                                                  'fixed_deposit','money_market','bond','other')),
    currency            VARCHAR(10) NOT NULL,
    quantity            NUMERIC(20,8),
    purchase_price      NUMERIC(20,8),
    current_price       NUMERIC(20,8),
    current_value       NUMERIC(20,8) NOT NULL,
    base_currency_value NUMERIC(20,8),
    country             VARCHAR(100),
    institution         VARCHAR(255),
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_investments_account_id ON investments(account_id);

CREATE TABLE exchange_rates (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_currency VARCHAR(10) NOT NULL,
    to_currency   VARCHAR(10) NOT NULL,
    rate          NUMERIC(20,8) NOT NULL,
    status        VARCHAR(10) NOT NULL DEFAULT 'live',   -- live | stale | error
    fetched_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_exchange_rates_currencies ON exchange_rates(from_currency, to_currency);

-- ─────────────────────────────────────────────────────────────
-- SUBSCRIPTIONS & BILLS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE subscriptions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id        UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    name              VARCHAR(255) NOT NULL,
    amount            NUMERIC(15,2) NOT NULL,
    billing_cycle     VARCHAR(20) NOT NULL,
    next_billing_date DATE,
    category          VARCHAR(100),
    is_active         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_subscriptions_account_id ON subscriptions(account_id);

CREATE TABLE bills (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    name       VARCHAR(255) NOT NULL,
    amount     NUMERIC(15,2) NOT NULL,
    due_day    INTEGER,
    category   VARCHAR(100),
    is_active  BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_bills_account_id ON bills(account_id);

-- ─────────────────────────────────────────────────────────────
-- JOINT ACCOUNT FEATURES
-- ─────────────────────────────────────────────────────────────
CREATE TABLE spending_boundaries (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id    UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    category      VARCHAR(100) NOT NULL,
    monthly_limit NUMERIC(15,2) NOT NULL,
    classification VARCHAR(20) NOT NULL DEFAULT 'shared',  -- shared | personal | grey
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_spending_boundaries_account_id ON spending_boundaries(account_id);

CREATE TABLE payment_warnings (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id         UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    debt_id            UUID REFERENCES debts(id) ON DELETE CASCADE,
    warning_type       VARCHAR(30) NOT NULL
                           CHECK (warning_type IN ('30_day','21_day','14_day','7_day',
                                                   '3_day','1_day','3_day_after')),
    due_date           DATE NOT NULL,
    amount             NUMERIC(15,2),
    member_a_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    member_b_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_payment_warnings_account_id ON payment_warnings(account_id);

CREATE TABLE joint_scenarios (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id    UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    created_by    UUID NOT NULL REFERENCES users(id),
    title         VARCHAR(255) NOT NULL,
    description   TEXT,
    scenario_data JSONB,
    status        VARCHAR(20) NOT NULL DEFAULT 'draft',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_joint_scenarios_account_id ON joint_scenarios(account_id);

CREATE TABLE sacrifice_logs (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id   UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    user_id      UUID NOT NULL REFERENCES users(id),
    description  TEXT NOT NULL,
    amount_saved NUMERIC(15,2),
    logged_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_sacrifice_logs_account_id ON sacrifice_logs(account_id);

CREATE TABLE safe_space_messages (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    sender_id  UUID NOT NULL REFERENCES users(id),
    message    TEXT NOT NULL,
    sent_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_safe_space_messages_account_id ON safe_space_messages(account_id);

-- ─────────────────────────────────────────────────────────────
-- JOURNAL & MILESTONES
-- ─────────────────────────────────────────────────────────────
CREATE TABLE journal_entries (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id),
    content    TEXT NOT NULL,
    mood       VARCHAR(50),
    entry_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_journal_entries_account_id ON journal_entries(account_id);

CREATE TABLE milestones (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id     UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    title          VARCHAR(255) NOT NULL,
    description    TEXT,
    achieved_at    TIMESTAMPTZ,
    milestone_type VARCHAR(50),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_milestones_account_id ON milestones(account_id);

-- ─────────────────────────────────────────────────────────────
-- EMAIL QUEUE
-- ─────────────────────────────────────────────────────────────
CREATE TABLE email_log (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient     VARCHAR(255) NOT NULL,
    subject       VARCHAR(500) NOT NULL,
    html_body     TEXT NOT NULL,
    trigger_type  VARCHAR(100) NOT NULL,
    account_id    UUID,
    user_id       UUID,
    status        VARCHAR(20) NOT NULL DEFAULT 'queued',  -- queued | sent | failed | skipped
    attempts      INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    sent_at       TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ix_email_log_status ON email_log(status);

-- ─────────────────────────────────────────────────────────────
-- NOTIFICATION PREFERENCES
-- ─────────────────────────────────────────────────────────────
CREATE TABLE notification_preferences (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id       UUID NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
    security_alerts  BOOLEAN NOT NULL DEFAULT TRUE,   -- cannot be disabled
    payment_warnings BOOLEAN NOT NULL DEFAULT TRUE,
    milestone_alerts BOOLEAN NOT NULL DEFAULT TRUE,
    weekly_summary   BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
