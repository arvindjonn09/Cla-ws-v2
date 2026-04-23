# Financial Command Center — Complete Architecture Reference
> Source: FCC Complete Architecture.pdf + FinanceApp Design Document.pdf (April 21, 2026)
> Status: LOCKED & APPROVED — Ready to Build

---

## SECTION 1 — PROJECT OVERVIEW

**What it is:** A financial rehabilitation and elevation system. Not a budgeting app.  
**Core Metric:** Freedom Date — the exact date the user becomes completely debt free.  
**Core Journey:** Debt → Savings → Investment

### The 9 Stages (Never Skipped)
| Stage | Name | Objective |
|-------|------|-----------|
| 1 | Know Your Numbers | Understand income, expenses, total debt |
| 2 | Stop The Bleeding | Identify and cut spending leaks |
| 3 | Clear Small Debts | Snowball or avalanche — first wins |
| 4 | Emergency Fund | Build 3-month safety net |
| 5 | Clear Large Debts | Attack biggest debts with full force |
| 6 | Save Consistently | Monthly savings habit established |
| 7 | Begin Investing | Local investments — index funds, bonds |
| 8 | Foreign Investments | Multi-currency portfolio building |
| 9 | Financial Independence | Passive income covers living expenses |

---

## SECTION 2 — TECH STACK

| Layer | Technology | Version |
|-------|------------|---------|
| Backend Language | Python | 3.12+ |
| Backend Framework | FastAPI | Latest |
| Database | PostgreSQL | 16 |
| ORM | SQLAlchemy | 2+ |
| DB Migrations | Alembic | Latest |
| Task Scheduler | APScheduler | Latest |
| Frontend Framework | Next.js | 15 |
| Frontend Styling | Tailwind CSS | 4 |
| Frontend Language | TypeScript | 5+ |
| Email | Zoho SMTP | — |
| Tunnel | Cloudflare Tunnel | Free tier |
| Service Manager | systemd | Ubuntu built-in |
| Mobile | Capacitor | Latest |
| Hosting | Ubuntu Server VM | VMware |

**Environment:** Ubuntu Server 24.04 LTS on VMware, VS Code on Windows via Remote SSH, GitHub + Copilot

---

## SECTION 3 — FOLDER STRUCTURE

```
financial-command-center/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth.py
│   │   │   ├── users.py
│   │   │   ├── accounts.py
│   │   │   ├── debts.py
│   │   │   ├── transactions.py
│   │   │   ├── goals.py
│   │   │   ├── investments.py
│   │   │   ├── notifications.py
│   │   │   └── joint/
│   │   │       ├── members.py
│   │   │       ├── payments.py
│   │   │       ├── boundaries.py
│   │   │       └── scenarios.py
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   ├── security.py
│   │   │   ├── database.py
│   │   │   └── email.py
│   │   ├── models/
│   │   │   ├── user.py
│   │   │   ├── account.py
│   │   │   ├── debt.py
│   │   │   ├── transaction.py
│   │   │   ├── goal.py
│   │   │   ├── investment.py
│   │   │   └── notification.py
│   │   ├── schemas/
│   │   │   ├── user.py
│   │   │   ├── account.py
│   │   │   ├── debt.py
│   │   │   └── ...
│   │   ├── services/
│   │   │   ├── freedom_date.py
│   │   │   ├── debt_engine.py
│   │   │   ├── income_engine.py
│   │   │   ├── exchange_rate.py
│   │   │   ├── email_service.py
│   │   │   └── watchdog.py
│   │   └── main.py
│   ├── requirements.txt
│   └── alembic/
├── frontend/
│   └── src/
│       ├── app/
│       │   ├── (auth)/
│       │   │   ├── login/
│       │   │   └── signup/
│       │   ├── (personal)/
│       │   │   ├── dashboard/
│       │   │   ├── debts/
│       │   │   ├── budget/
│       │   │   ├── investments/
│       │   │   └── ...
│       │   └── (joint)/
│       │       ├── war-room/
│       │       ├── payments/
│       │       └── ...
│       ├── components/
│       ├── hooks/
│       ├── lib/
│       └── types/
├── database/
│   ├── schema.sql
│   └── seeds/
├── scripts/
│   ├── start.sh
│   ├── watchdog.py
│   └── backup.sh
├── docs/
├── .env.example
├── .gitignore
└── README.md
```

---

## SECTION 4 — DATABASE SCHEMA

### users
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    verification_token TEXT,
    verification_expires_at TIMESTAMP,
    reset_token TEXT,
    reset_token_expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### sessions
```sql
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### accounts (Personal + Joint — One Model)
```sql
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL CHECK (type IN ('personal', 'joint')),
    name TEXT,
    base_currency TEXT NOT NULL DEFAULT 'ZAR',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### account_members
```sql
CREATE TABLE account_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('member', 'viewer')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'removed')),
    joined_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (account_id, user_id)
);

-- ONE JOINT PER PERSON — Database enforced
CREATE UNIQUE INDEX one_joint_per_user
ON account_members (user_id)
WHERE account_id IN (SELECT id FROM accounts WHERE type = 'joint')
AND role = 'member' AND status = 'active';
```

### user_profiles
```sql
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
    country TEXT,
    city TEXT,
    local_currency TEXT,
    income_type TEXT CHECK (income_type IN ('fixed', 'casual', 'variable', 'multiple')),
    pay_frequency TEXT CHECK (pay_frequency IN ('weekly', 'biweekly', 'monthly', 'irregular')),
    pay_day TEXT,
    income_month_1 NUMERIC(15,2),
    income_month_2 NUMERIC(15,2),
    income_month_3 NUMERIC(15,2),
    income_baseline NUMERIC(15,2),
    income_lowest NUMERIC(15,2),
    financial_situation TEXT CHECK (financial_situation IN ('in_debt', 'breaking_even', 'stable', 'growing')),
    primary_goal TEXT,
    debt_method TEXT DEFAULT 'snowball' CHECK (debt_method IN ('snowball', 'avalanche', 'custom')),
    motivation_style TEXT CHECK (motivation_style IN ('disciplined', 'motivation_driven')),
    spending_personality TEXT,
    onboarding_complete BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### debts
```sql
CREATE TABLE debts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
    added_by UUID REFERENCES users(id),
    name TEXT NOT NULL,
    debt_type TEXT NOT NULL CHECK (debt_type IN (
        'credit_card', 'personal_loan', 'car_finance',
        'student_loan', 'home_loan', 'store_account', 'personal', 'other'
    )),
    payment_type TEXT CHECK (payment_type IN ('fixed', 'variable', 'app_decided')),
    original_balance NUMERIC(15,2) NOT NULL,
    current_balance NUMERIC(15,2) NOT NULL,
    minimum_payment NUMERIC(15,2),
    actual_payment NUMERIC(15,2),
    payment_frequency TEXT CHECK (payment_frequency IN ('weekly', 'biweekly', 'monthly')),
    payment_day TEXT,
    has_interest BOOLEAN DEFAULT FALSE,
    interest_rate NUMERIC(5,2),
    months_remaining INTEGER,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'cleared', 'paused')),
    cleared_at TIMESTAMP,
    currency TEXT NOT NULL DEFAULT 'ZAR',
    is_shared BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### debt_payments
```sql
CREATE TABLE debt_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    debt_id UUID REFERENCES debts(id) ON DELETE CASCADE,
    account_id UUID REFERENCES accounts(id),
    paid_by UUID REFERENCES users(id),
    amount NUMERIC(15,2) NOT NULL,
    extra_amount NUMERIC(15,2) DEFAULT 0,
    payment_date DATE NOT NULL,
    due_date DATE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'late', 'extended')),
    extension_requested BOOLEAN DEFAULT FALSE,
    extension_days INTEGER,
    extension_reason TEXT,
    extension_due_date DATE,
    member_b_amount NUMERIC(15,2),
    member_b_confirmed BOOLEAN DEFAULT FALSE,
    team_option_used TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### transactions
```sql
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    amount NUMERIC(15,2) NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer', 'debt_payment')),
    category TEXT,
    subcategory TEXT,
    description TEXT,
    transaction_date DATE NOT NULL,
    currency TEXT NOT NULL DEFAULT 'ZAR',
    is_shared BOOLEAN DEFAULT FALSE,
    split_type TEXT CHECK (split_type IN ('shared', 'personal', 'grey')),
    created_at TIMESTAMP DEFAULT NOW()
);
```

### goals
```sql
CREATE TABLE goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id),
    name TEXT NOT NULL,
    goal_type TEXT NOT NULL CHECK (goal_type IN (
        'emergency_fund', 'debt_payoff', 'savings',
        'house_deposit', 'holiday', 'education', 'custom'
    )),
    target_amount NUMERIC(15,2) NOT NULL,
    current_amount NUMERIC(15,2) DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'ZAR',
    target_date DATE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused')),
    priority INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### investments
```sql
CREATE TABLE investments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
    added_by UUID REFERENCES users(id),
    name TEXT NOT NULL,
    asset_type TEXT NOT NULL CHECK (asset_type IN (
        'stocks', 'bonds', 'mutual_funds', 'property',
        'crypto', 'fixed_deposit', 'retirement', 'foreign_cash', 'other'
    )),
    currency TEXT NOT NULL,
    units NUMERIC(15,6),
    purchase_price NUMERIC(15,2),
    current_price NUMERIC(15,2),
    current_value NUMERIC(15,2),
    base_currency_value NUMERIC(15,2),
    country TEXT,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'sold')),
    purchased_at DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### exchange_rates
```sql
CREATE TABLE exchange_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_currency TEXT NOT NULL,
    to_currency TEXT NOT NULL,
    rate NUMERIC(20,8) NOT NULL,
    fetched_at TIMESTAMP DEFAULT NOW(),
    source TEXT DEFAULT 'open_exchange_rates',
    status TEXT DEFAULT 'live' CHECK (status IN ('live', 'stale', 'error')),
    UNIQUE (from_currency, to_currency, fetched_at::DATE)
);
```

### subscriptions
```sql
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    name TEXT NOT NULL,
    amount NUMERIC(15,2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'ZAR',
    frequency TEXT CHECK (frequency IN ('weekly', 'monthly', 'yearly')),
    category TEXT,
    is_shared BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'paused')),
    next_charge_date DATE,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### bills
```sql
CREATE TABLE bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    name TEXT NOT NULL,
    amount NUMERIC(15,2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'ZAR',
    frequency TEXT CHECK (frequency IN ('weekly', 'monthly', 'yearly')),
    due_day INTEGER,
    is_shared BOOLEAN DEFAULT FALSE,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW()
);
```

### spending_boundaries (Joint)
```sql
CREATE TABLE spending_boundaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    classification TEXT NOT NULL CHECK (classification IN ('shared', 'personal', 'grey')),
    split_method TEXT CHECK (split_method IN ('equal', 'percentage', 'decide_each_time')),
    member_a_percentage NUMERIC(5,2),
    member_b_percentage NUMERIC(5,2),
    notes TEXT,
    set_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### payment_warnings (Joint)
```sql
CREATE TABLE payment_warnings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
    debt_id UUID REFERENCES debts(id),
    debt_payment_id UUID REFERENCES debt_payments(id),
    due_date DATE NOT NULL,
    warning_type TEXT NOT NULL CHECK (warning_type IN (
        '30_day', '7_day', '4_day', '3_day', '1_day', 'payment_day', '3_day_after'
    )),
    sent_at TIMESTAMP,
    member_a_confirmed BOOLEAN DEFAULT FALSE,
    member_b_confirmed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### joint_scenarios
```sql
CREATE TABLE joint_scenarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id),
    title TEXT NOT NULL,
    description TEXT,
    scenario_data JSONB,
    projected_freedom_date DATE,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'shared', 'decided', 'archived')),
    decision TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### sacrifice_log (Joint)
```sql
CREATE TABLE sacrifice_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    description TEXT NOT NULL,
    amount_saved NUMERIC(15,2),
    logged_at TIMESTAMP DEFAULT NOW()
);
```

### safe_space_messages (Joint)
```sql
CREATE TABLE safe_space_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id),
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMP DEFAULT NOW()
);
```

### journal_entries
```sql
CREATE TABLE journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    entry_date DATE NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### milestones
```sql
CREATE TABLE milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
    milestone_type TEXT NOT NULL CHECK (milestone_type IN (
        'debt_cleared', 'emergency_fund_built',
        'stage_unlocked', 'first_investment',
        'freedom_date_updated', 'savings_goal_hit'
    )),
    title TEXT NOT NULL,
    description TEXT,
    related_id UUID,
    achieved_at TIMESTAMP DEFAULT NOW(),
    celebrated BOOLEAN DEFAULT FALSE
);
```

### email_log
```sql
CREATE TABLE email_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient TEXT NOT NULL,
    subject TEXT NOT NULL,
    trigger_type TEXT NOT NULL,
    account_id UUID,
    user_id UUID,
    status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed', 'skipped')),
    attempts INTEGER DEFAULT 0,
    error_message TEXT,
    sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### notification_preferences
```sql
CREATE TABLE notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    account_id UUID REFERENCES accounts(id),
    payment_reminders BOOLEAN DEFAULT TRUE,
    milestone_celebrations BOOLEAN DEFAULT TRUE,
    security_alerts BOOLEAN DEFAULT TRUE,
    goal_updates BOOLEAN DEFAULT TRUE,
    freedom_date_changes BOOLEAN DEFAULT TRUE,
    weekly_summary BOOLEAN DEFAULT TRUE,
    channel_email BOOLEAN DEFAULT TRUE,
    channel_push BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### invite_tokens
```sql
CREATE TABLE invite_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
    invited_by UUID REFERENCES users(id),
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('member', 'viewer')),
    token TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## SECTION 5 — AUTHENTICATION SYSTEM

### Flow
```
User signup (email + password x2)
  → FastAPI hashes password (bcrypt)
  → Creates user (is_verified = false)
  → Generates verification token (15 min expiry)
  → Sends email via Zoho SMTP
  → User clicks link → is_verified = true
  → JWT issued → user enters dashboard
```

### Session Rules
- JWT access token: 15 minutes
- Refresh token: 10–15 days (remember me)
- After 15 days: quiet re-verification prompt
- Both joint members can be logged in simultaneously
- Security alerts always on — cannot be disabled

### JWT Payload
```json
{
  "sub": "user_id",
  "account_id": "account_id",
  "account_type": "personal | joint",
  "role": "member | viewer",
  "exp": 1234567890
}
```

---

## SECTION 6 — ACCOUNT RULES

- **One joint per person — hard limit** (enforced at app AND DB level)
- Viewers do NOT count against this limit
- If joint is closed, person can open a new one
- Personal account = joint account with one member (same model, type field differentiates)
- Viewers can NEVER be upgraded to full member — permanent rule
- Viewers can never affect any data
- Up to 5 viewers per joint account
- Either member can remove any viewer without reason
- Closing joint account requires BOTH members to confirm

---

## SECTION 7 — INCOME ENGINE

### Income Types
| Type | Description | How App Handles |
|------|-------------|-----------------|
| Fixed | Same amount, same date | Payday mode, monthly budget |
| Casual | Day labour, irregular shifts | Weekly/daily tracking, cushion system |
| Variable | Uber, freelancer, commission | 3-month average, tier allocation |
| Multiple | More than one income source | Per-source tracking, combined baseline |

### 3-Month Average Logic
```python
baseline = (month1 + month2 + month3) / 3
lowest = min(month1, month2, month3)
safe_baseline = lowest  # used for debt calculations

# Monthly monitoring
if new_income > baseline:
    suggest: put extra toward debt or goal
elif new_income < baseline:
    recalculate plan, suggest Bare Minimum Mode

# After 3 consecutive low months: recalculate average downward
# After 3 consecutive high months: ask to update baseline upward
```

### Special Modes
| Mode | Trigger | What It Does |
|------|---------|--------------|
| Payday Mode | Fixed — first 24h after salary | Immediate allocation prompt |
| Pre-Payday Mode | Fixed — 3 days before payday | Safe-to-spend calculation |
| Cushion System | Irregular earners | Buffer absorbs income unpredictability |
| Tier Allocation | Every deposit (irregular) | Survival → Cushion → Debt → Living |
| Bare Minimum Mode | Tough month | Shows only non-negotiables, pauses goals |
| Quiet Mode | User triggers | Reduces visibility, protects dignity |

---

## SECTION 8 — DEBT ENGINE

### Debt Entry Questions
1. Payment type → Fixed / Variable / Let app decide
2. How much do you pay? + frequency (weekly / biweekly / monthly)
3. Any interest? → Yes (enter rate) / No / Don't know
4. Outstanding balance remaining
5. How many months remaining

### Calculations Per Debt
```python
monthly_interest = (current_balance * interest_rate / 100) / 12
months_to_clear = calculate based on balance, payment, interest
total_interest = sum of all future interest payments
```

### Freedom Date — Three Methods Shown Simultaneously
| Method | Freedom Date | Total Interest Paid | Months Remaining |
|--------|-------------|---------------------|-----------------|
| Snowball | Date | Amount | Number |
| Avalanche | Date | Amount | Number |
| Custom | Date | Amount | Number |

- App highlights recommended method based on motivation style
- User chooses — user owns the decision
- Switching methods updates Freedom Date instantly

### Extra Payment Simulator
- Show impact of paying extra R50 / R100 / R500 / custom per month
- Show new Freedom Date vs current Freedom Date
- Show total interest saved

### Debt Completion
- Balance hits zero → trigger milestone celebration
- Send congratulations email via Zoho
- Roll freed-up payment to next debt automatically

---

## SECTION 9 — JOINT ACCOUNT SYSTEM

### Core Philosophy
```
Two commanders. One enemy. Debt.
Nobody keeps score. Nobody owes anyone.
The app is never the referee. It is the scoreboard both people agreed to play by.
```

### Transparency Model
Both members see: all transactions, individual contributions, each other's income,
payment history, who paid what, safe space messages, what-if scenarios, extension requests, goals.

Viewers see: progress only — never financial mechanics.

### Payment Warning Flow
| Timing | Channel | Action Required |
|--------|---------|-----------------|
| 30 days before | App only | Soft nudge |
| 7 days before | Email both | Full breakdown, confirm plan |
| 4 days before | Push | Reminder to unconfirmed member |
| 3 days before | Email both | Confirmed plan summary |
| 1 day before | Push | Funds ready? |
| Payment day | Email + Push | Mark as paid — both confirm |
| 3 days after unpaid | Email + Push | Did you pay? |

### When One Member Is Short — Three Options Always Shown
1. Reduce payment this month — interest impact shown
2. One member covers full amount — logged as team decision
3. Borrow from shared savings — repaid automatically next month

### Language Rules
- Never use: owes, debt between members, settlement, fairness score
- Always use: team language, shared decision, together

### Cross-Country Support
- Each member sets own country and local currency
- Each member logs expenses in local currency
- App converts to joint base currency daily
- Joint base currency chosen during onboarding

---

## SECTION 10 — EXCHANGE RATE SYSTEM

- Fetch once per day at **9:00 AM IST**
- Use free API: exchangerate-api.com or frankfurter.app
- Store in `exchange_rates` table
- Currency is a property of each asset/debt — never a separate system
- Stale: use yesterday's rate + show red dot indicator
- API down >24h: send Level 2 alert to admin

---

## SECTION 11 — EMAIL SYSTEM (ZOHO SMTP)

```
ZOHO_SMTP_HOST = "smtp.zoho.com"
ZOHO_SMTP_PORT = 587
ZOHO_SMTP_USER = "noreply@yourdomain.com"
ZOHO_FROM_NAME = "Financial Command Center"
```

### Email Queue
User action → insert into `email_log` (queued) → APScheduler picks up every 60s
→ FastAPI sends via Zoho → status updated → retry up to 3x → after 3 failures: alert admin

### All Email Triggers
| Trigger | Recipients |
|---------|-----------|
| Signup | New user — verification link |
| New device login | User — security alert |
| Password reset | User — reset link (15 min expiry) |
| Joint invite | Invited person |
| 7 days before payment | Both joint members |
| 3 days before payment | Both joint members |
| Payment day | Both joint members |
| 3 days after missed payment | Both joint members |
| Debt cleared | User / Both members |
| Freedom Date updated | User / Both members |
| Stage unlocked | User / Both members |
| Both quiet too long | Both members |
| Extension requested | Both members |
| System Level 1 alert | Admin only |
| System Level 2 alert | Admin only |
| System Level 3 alert | Admin + SMS |

---

## SECTION 12 — RECOVERY & MONITORING

### Four Layers
| Layer | Description |
|-------|-------------|
| 1 — systemd | All services registered, auto-start on boot |
| 2 — systemd restart | If service crashes, auto-restart |
| 3 — Health endpoint | FastAPI /health checks DB, ports, memory, disk |
| 4 — Watchdog | Python script checks all ports every 60 seconds |

### Service Startup Order
1. PostgreSQL (port 5432)
2. FastAPI (port 8000)
3. Next.js (port 3000)
4. Cloudflare Tunnel (outbound)
5. Watchdog

### Alert Levels
| Level | Trigger | Action |
|-------|---------|--------|
| 1 — Minor | Service restarted successfully | Email admin |
| 2 — Moderate | Service failed to restart twice | Email admin |
| 3 — Critical | Full system down | Email + SMS admin |

### Recovery Times
| Scenario | Expected Recovery |
|----------|-----------------|
| Single service crash | Under 75 seconds |
| Full machine restart | Under 90 seconds |
| PostgreSQL crash | No data loss (WAL), auto-restart |
| Cloudflare tunnel drop | Under 30 seconds |

---

## SECTION 13 — ALL 49 PAGES

### Personal Account — 22 Pages
| # | Page | Category |
|---|------|----------|
| 1 | Auth Page | Entry |
| 2 | Onboarding | Entry |
| 3 | Milestone Celebrations | Entry |
| 4 | Dashboard | Core |
| 5 | Net Worth | Core |
| 6 | Step Progress | Core |
| 7 | Debt Center | Recovery |
| 8 | Budget Command Center | Recovery |
| 9 | Spending Intelligence | Recovery (V2) |
| 10 | Subscription Manager | Recovery |
| 11 | Bill Tracker | Recovery |
| 12 | Emergency Fund Tracker | Growth |
| 13 | Forecast 30/60/90 Day | Growth |
| 14 | Scenario Planner | Growth |
| 15 | Growth Timeline | Growth |
| 16 | Investment Hub | Invest |
| 17 | Financial Personality Profile | Identity |
| 18 | Financial Journal | Identity |
| 19 | Annual Review | Identity |
| 20 | Tax Awareness | Identity |
| 21 | Transactions Full Log | System |
| 22 | Settings & Profile | System |

### Joint Account — 27 Pages
| # | Page | Category |
|---|------|----------|
| 1 | Joint Onboarding | Entry |
| 2 | Invite & Accept Flow | Entry |
| 3 | War Room Dashboard | Core |
| 4 | Team Momentum Score | Core |
| 5 | Freedom Countdown | Core |
| 6 | Shared Debt Center | Debt |
| 7 | Payment Warning System | Debt |
| 8 | Payment History | Debt |
| 9 | Contribution Overview | Debt |
| 10 | Shared Budget Center | Planning |
| 11 | Spending Boundary Setup | Planning |
| 12 | Joint What-If Scenarios | Planning |
| 13 | Shared Forecast | Planning |
| 14 | Shared Spending Intelligence | Intel (V2) |
| 15 | Shared Sacrifice Log | Intel |
| 16 | Conflict Check-in | Intel |
| 17 | Shared Goals | Growth |
| 18 | Step Progress Joint | Growth |
| 19 | Growth Timeline Together | Growth |
| 20 | Joint Investment Hub | Growth |
| 21 | Safe Space Message | Comms |
| 22 | Monthly Planning Session | Comms |
| 23 | Member Management | System |
| 24 | Notification Settings | System |
| 25 | Joint Annual Review | System |
| 26 | Exit Plan | System |
| 27 | Settings Joint | System |

---

## SECTION 14 — API ENDPOINTS

### Authentication
```
POST /api/auth/signup
POST /api/auth/verify-email
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/refresh
POST /api/auth/forgot-password
POST /api/auth/reset-password
```

### Accounts
```
POST   /api/accounts/personal
POST   /api/accounts/joint
GET    /api/accounts/{account_id}
PATCH  /api/accounts/{account_id}
POST   /api/accounts/{account_id}/invite
DELETE /api/accounts/{account_id}/members/{user_id}
POST   /api/accounts/{account_id}/close
```

### Debts
```
GET    /api/accounts/{account_id}/debts
POST   /api/accounts/{account_id}/debts
GET    /api/accounts/{account_id}/debts/{debt_id}
PATCH  /api/accounts/{account_id}/debts/{debt_id}
DELETE /api/accounts/{account_id}/debts/{debt_id}
GET    /api/accounts/{account_id}/debts/freedom-date
POST   /api/accounts/{account_id}/debts/{debt_id}/payments
POST   /api/accounts/{account_id}/debts/{debt_id}/simulate
```

### Transactions
```
GET    /api/accounts/{account_id}/transactions
POST   /api/accounts/{account_id}/transactions
PATCH  /api/accounts/{account_id}/transactions/{transaction_id}
DELETE /api/accounts/{account_id}/transactions/{transaction_id}
```

### Goals
```
GET    /api/accounts/{account_id}/goals
POST   /api/accounts/{account_id}/goals
PATCH  /api/accounts/{account_id}/goals/{goal_id}
DELETE /api/accounts/{account_id}/goals/{goal_id}
```

### Investments
```
GET    /api/accounts/{account_id}/investments
POST   /api/accounts/{account_id}/investments
PATCH  /api/accounts/{account_id}/investments/{investment_id}
DELETE /api/accounts/{account_id}/investments/{investment_id}
GET    /api/accounts/{account_id}/investments/portfolio
```

### Exchange Rates
```
GET /api/exchange-rates/{from}/{to}
GET /api/exchange-rates/status
```

### Joint Specific
```
GET  /api/accounts/{account_id}/boundaries
POST /api/accounts/{account_id}/boundaries
GET  /api/accounts/{account_id}/scenarios
POST /api/accounts/{account_id}/scenarios
GET  /api/accounts/{account_id}/safe-space
POST /api/accounts/{account_id}/safe-space
GET  /api/accounts/{account_id}/payment-warnings
POST /api/accounts/{account_id}/payment-warnings/{warning_id}/confirm
```

### System
```
GET /api/health
GET /api/health/detailed
```

---

## SECTION 15 — ENVIRONMENT VARIABLES

```env
# Database
DATABASE_URL=postgresql://fcc_user:password@localhost:5432/financial_command_center

# Security
SECRET_KEY=your_very_long_random_secret_key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=15

# Zoho SMTP
ZOHO_SMTP_HOST=smtp.zoho.com
ZOHO_SMTP_PORT=587
ZOHO_SMTP_USER=noreply@yourdomain.com
ZOHO_SMTP_PASSWORD=your_zoho_app_password
ZOHO_FROM_NAME=Financial Command Center

# Exchange Rates
EXCHANGE_RATE_API_URL=https://api.frankfurter.app
EXCHANGE_RATE_FETCH_TIME_IST=09:00

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8000

# Admin Alerts
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PHONE=+1234567890

# Environment
ENVIRONMENT=development
```

---

## SECTION 16 — VERSION ROADMAP

### Version 1 — Build This First
- Complete authentication system
- Personal account — all 22 pages
- Joint account — all 27 pages
- Debt engine (snowball, avalanche, custom)
- Freedom Date calculator
- Income engine (all 4 types)
- Goals system
- Investment hub (manual entry)
- Exchange rates (daily fetch)
- Zoho email system
- Recovery and watchdog system
- Android APK via Capacitor

### Version 2 — After V1 Is Stable
- Bank statement upload and analysis
- Spending intelligence
- AI-powered insights via Claude API
- Advanced forecasting
- Tax awareness engine
- Automated debt detection from statements

---

## SECTION 17 — KEY BUSINESS RULES

1. One joint account per person — hard limit
2. Viewers can never become members — permanent
3. Joint account closure requires both members
4. Housing is personal unless both members say otherwise
5. Currency is set per asset — never changes after set
6. Exchange rates fetch at 9AM IST daily — show stale indicator if down
7. Freedom Date updates in real time with every change
8. All 3 debt methods shown simultaneously — user chooses
9. Language in joint account is always team language — no blame
10. Email queue — never send inline — always via APScheduler
11. Security alerts cannot be turned off by any user
12. Viewer invite decline shows no details to inviter
13. Bank statement analysis — Version 2 only
14. Bare Minimum Mode pauses goals without deleting them
15. 3-month income average recalculates automatically
