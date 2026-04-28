# Financial Command Center - Complete Architecture & Dependencies Guide

**Last Updated:** April 28, 2026  
**Purpose:** Reference guide for AI assistants and developers to maintain architectural consistency  
**Status:** CRITICAL - Must be consulted before implementing features

---

## 📋 Table of Contents

1. [System Architecture](#system-architecture)
2. [Data Models & Relationships](#data-models--relationships)
3. [API Layer Structure](#api-layer-structure)
4. [Frontend Architecture](#frontend-architecture)
5. [Service Dependencies](#service-dependencies)
6. [Data Flow Patterns](#data-flow-patterns)
7. [Critical Constraints](#critical-constraints)
8. [Common Pitfalls](#common-pitfalls)

---

## 1. System Architecture

### High-Level System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                       CLIENT LAYER                               │
├─────────────────────────────────────────────────────────────────┤
│  Next.js 15 (TypeScript)  │  React Hooks  │  Tailwind CSS       │
│  ├─ Personal Routes       │  ├─ useAuth   │  Theme: Dark        │
│  ├─ Joint Routes          │  ├─ useAccount│  Dark Slate/Blue    │
│  └─ Auth Routes           │  └─ Custom    │  Green (Good)       │
│                           │     Hooks     │  Red (Bad)          │
└──────────────┬────────────────────────────┬──────────────────────┘
               │                            │
        API (Bearer JWT)            WebSocket (Future)
               │                            │
┌──────────────▼────────────────────────────▼──────────────────────┐
│                    API GATEWAY (FastAPI)                          │
├────────────────────────────────────────────────────────────────┤
│  CORS Middleware  │  Auth Middleware  │  Error Handling        │
│  Rate Limiting    │  JWT Verification │  Request/Response      │
│                   │                   │  Validation            │
└──────────────┬────────────────────────────┬──────────────────────┘
               │                            │
        CRUD Operations             Background Tasks
               │                            │
┌──────────────▼──────────────┬─────────────▼───────────────────────┐
│    API ROUTES LAYER          │  BACKGROUND JOBS (APScheduler)    │
├──────────────────────────────┼─────────────────────────────────────┤
│  POST /api/auth/*            │  Daily Exchange Rate Fetch (9 AM)  │
│  GET  /api/accounts/*        │  Email Queue Processor (every 15s) │
│  GET  /api/debts/*           │  Debt Reminder Job (daily)        │
│  POST /api/debts/*           │  Health Check                      │
│  GET  /api/investments/*     │                                    │
│  GET  /api/transactions/*    │                                    │
│  GET  /api/goals/*           │                                    │
│  POST /api/joint/*           │                                    │
│  POST /api/import_pdf        │                                    │
└──────────────┬──────────────────────────┬──────────────────────────┘
               │                          │
        Business Logic             Scheduled Tasks
               │                          │
┌──────────────▼──────────────┬───────────▼───────────────────────────┐
│   SERVICES LAYER (Core)      │  SERVICES LAYER (Background)        │
├──────────────────────────────┼───────────────────────────────────────┤
│  • debt_engine.py            │  • exchange_rate.py (Daily job)      │
│  • freedom_date.py           │  • email_service.py (Queue)          │
│  • income_engine.py          │  • debt_reminder.py (Daily)          │
│  • pdf_parser.py             │  • watchdog.py (Health check)        │
│                              │                                      │
│  ⚠️ RULES:                   │  ⚠️ RULES:                          │
│  - Read from Models          │  - Async only                       │
│  - Write via ORM Only        │  - Error resilient                  │
│  - No Direct SQL             │  - Transactional                    │
│  - Stateless                 │  - Log all actions                  │
└──────────────┬──────────────────────────┬──────────────────────────┘
               │                          │
        ORM Queries                 Database Connections
               │                          │
┌──────────────▼──────────────┬───────────▼───────────────────────────┐
│     MODELS LAYER (ORM)       │   DATABASE LAYER                    │
├──────────────────────────────┼───────────────────────────────────────┤
│  SQLAlchemy 2.0              │  PostgreSQL 16                       │
│                              │                                      │
│  Data Entities:              │  Connection:                         │
│  • User                      │  • asyncpg (Async Driver)           │
│  • Account (Personal/Joint)  │  • Connection pooling               │
│  • Debt                      │  • SSL enabled                       │
│  • Transaction               │                                      │
│  • Goal                      │  Migrations:                         │
│  • Investment                │  • Alembic 1.14.0                   │
│  • UserProfile               │  • Version controlled                │
│  • AccountMember             │                                      │
│  • Notification              │                                      │
│  • MerchantRule              │                                      │
│  • ExchangeRate              │                                      │
│                              │                                      │
│  ⚠️ RULES:                   │  ⚠️ RULES:                          │
│  - Relationships intact      │  - ACID transactions                │
│  - Cascade rules defined     │  - Migrations before deploys        │
│  - Validation in schema      │  - Rollback procedures tested       │
│  - No orphaned records       │  - Backup before migrations         │
└──────────────────────────────┴───────────────────────────────────────┘
```

---

## 2. Data Models & Relationships

### Entity Relationship Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          CORE ENTITIES                                    │
└──────────────────────────────────────────────────────────────────────────┘

              User (1)
               │
               ├─ (many) Sessions [Auth tokens]
               │
               ├─ (many) AccountMembers [Membership]
               │           │
               │           └─ (many) Account
               │
               └─ (many) UserProfiles [Preferences]


┌──────────────────────────────────────────────────────────────────────────┐
│                     ACCOUNT STRUCTURE                                     │
└──────────────────────────────────────────────────────────────────────────┘

Account (Personal or Joint)
├─ id: UUID
├─ type: "personal" | "joint"
├─ base_currency: String (USD, INR, etc.)
├─ status: "active" | "closed"
│
├─ (many) AccountMembers [Role: member/viewer, Status: active/pending/removed]
│
└─ (many) Financial Entities:
    ├─ (many) Debt
    │   ├─ original_balance
    │   ├─ current_balance
    │   ├─ payment_frequency
    │   ├─ interest_rate (if applicable)
    │   └─ (many) Transactions [Payment history]
    │
    ├─ (many) Transaction
    │   ├─ type: "expense" | "income" | "payment"
    │   ├─ category
    │   ├─ amount
    │   └─ currency (may differ from base)
    │
    ├─ (many) Goal
    │   ├─ target_amount
    │   ├─ current_amount
    │   ├─ deadline
    │   ├─ priority
    │   └─ status: "active" | "achieved" | "paused"
    │
    ├─ (many) Investment
    │   ├─ name
    │   ├─ type: "stock" | "bond" | "fund" | "crypto" | "other"
    │   ├─ original_value
    │   ├─ current_value
    │   ├─ currency (may differ from base)
    │   └─ status: "active" | "sold" | "paused"
    │
    └─ (many) Notifications
        ├─ type: "alert" | "reminder" | "achievement"
        └─ status: "sent" | "pending" | "failed"


┌──────────────────────────────────────────────────────────────────────────┐
│                     JOINT ACCOUNT SPECIFICS                               │
└──────────────────────────────────────────────────────────────────────────┘

JointAccount (extends Account)
│
├─ Members (2+)
│   ├─ Member 1 (Creator)
│   ├─ Member 2+ (Invited)
│   └─ Members can be: active, pending, removed
│
├─ Shared Entities:
│   ├─ Shared Debts [Must be agreed by members]
│   ├─ Shared Goals
│   ├─ Shared Transactions [Individual payments tracked]
│   ├─ Shared Investments
│   └─ Shared Forecasts
│
├─ Boundaries:
│   ├─ Individual spending limits
│   ├─ Category restrictions
│   └─ Emergency override rules
│
├─ Payments:
│   ├─ Who owes whom
│   ├─ Settlement tracking
│   └─ Payment history
│
└─ Safety:
    ├─ Account closure requests (2-week hold)
    ├─ Member removal (with consent/voting)
    └─ Dispute resolution
```

### Critical Relationships

| Relationship | Type | Cascade | Notes |
|---|---|---|---|
| User → Account | 1:M | All delete user → delete accounts | User is owner |
| Account → Debt | 1:M | All delete account → delete debts | Account isolation |
| Account → Transaction | 1:M | All delete account → delete transactions | Audit trail kept |
| Account → Goal | 1:M | All delete account → delete goals | Cascading |
| Account → Investment | 1:M | All delete account → delete investments | Portfolio cleanup |
| Debt → Transaction | 1:M | Set NULL on debt delete | Track payment history |
| User → AccountMember | 1:M | All delete user → delete membership | Removes from all accounts |

---

## 3. API Layer Structure

### Authentication Flow

```
Client Request
    │
    ├─ [No Token]
    │   └─ Public Endpoints (auth/login, auth/signup)
    │
    └─ [Has Token]
        └─ API Gateway
            ├─ Extract Bearer Token
            ├─ Verify JWT (deps.get_current_user)
            ├─ Validate Token Signature & Expiry
            │
            ├─ [Invalid/Expired]
            │   └─ Return 401
            │
            └─ [Valid]
                ├─ Load User from DB
                ├─ Check Account Membership (if account_id in path)
                ├─ Verify Permission (role: member/viewer)
                │
                ├─ [No Permission]
                │   └─ Return 403
                │
                └─ [Authorized]
                    └─ Execute Route Handler
                        └─ Return Resource
```

### API Route Structure

```
POST   /api/auth/register           [Public]
POST   /api/auth/login              [Public]
POST   /api/auth/verify             [Public]
POST   /api/auth/refresh            [Public]
POST   /api/auth/forgot-password    [Public]
POST   /api/auth/reset-password     [Public]

GET    /api/accounts                [Authenticated] → List user's accounts
POST   /api/accounts                [Authenticated] → Create account
GET    /api/accounts/{id}           [Authenticated + Permission]
PATCH  /api/accounts/{id}           [Authenticated + Permission]

GET    /api/accounts/{id}/debts     [Authenticated + Permission]
POST   /api/accounts/{id}/debts     [Authenticated + Permission]
GET    /api/accounts/{id}/debts/{did}[Authenticated + Permission]
PATCH  /api/accounts/{id}/debts/{did}[Authenticated + Permission]

GET    /api/accounts/{id}/transactions     [Authenticated + Permission]
POST   /api/accounts/{id}/transactions     [Authenticated + Permission]

GET    /api/accounts/{id}/investments      [Authenticated + Permission]
POST   /api/accounts/{id}/investments      [Authenticated + Permission]

GET    /api/accounts/{id}/goals            [Authenticated + Permission]
POST   /api/accounts/{id}/goals            [Authenticated + Permission]

POST   /api/joint/members            [Authenticated] → Manage members
POST   /api/joint/payments            [Authenticated] → Settlement
POST   /api/joint/boundaries          [Authenticated] → Set limits
GET    /api/joint/scenarios           [Authenticated] → Projections

POST   /api/import_pdf                [Authenticated] → Parse bank statements
```

### Dependency Pattern (deps.py)

```python
# CRITICAL: All authenticated routes must use this pattern

@router.get("/accounts/{account_id}/debts")
async def list_debts(
    account_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),  # ← REQUIRED
    account: Account = Depends(get_account_with_permission),  # ← REQUIRED
):
    # current_user: Authenticated user
    # account: User has access to this account (member/viewer)
    # db: Database session
    
    # Safe to query: debts = await db.execute(...)
    return debts

# What happens if you skip get_account_with_permission:
# ❌ User can access ANY account (Security breach!)
# ❌ Query doesn't validate account_id matches user

# What happens if you skip get_current_user:
# ❌ Anyone can hit endpoint (Auth bypass!)
```

---

## 4. Frontend Architecture

### Route Structure

```
src/app/
├── (auth)/
│   ├── login/
│   │   └── page.tsx           [Public - No auth required]
│   ├── signup/
│   │   └── page.tsx           [Public - No auth required]
│   ├── verify/
│   │   └── page.tsx           [Public - Email verification]
│   ├── forgot-password/
│   │   └── page.tsx           [Public]
│   └── reset-password/
│       └── page.tsx           [Public]
│
├── (personal)/
│   ├── dashboard/
│   │   └── page.tsx           [Protected - Personal data]
│   ├── debts/
│   │   └── page.tsx           [Protected]
│   ├── transactions/
│   │   └── page.tsx           [Protected]
│   ├── investments/
│   │   └── page.tsx           [Protected]
│   ├── goals/
│   │   └── page.tsx           [Protected]
│   ├── net-worth/
│   │   └── page.tsx           [Protected - Computed]
│   ├── forecast/
│   │   └── page.tsx           [Protected - Projection]
│   ├── growth/
│   │   └── page.tsx           [Protected - Analytics]
│   ├── journey/
│   │   └── page.tsx           [Protected - 9-stage progress]
│   ├── annual-review/
│   │   └── page.tsx           [Protected - Report]
│   └── settings/
│       └── page.tsx           [Protected - Profile]
│
├── (joint)/
│   ├── members/
│   │   └── page.tsx           [Protected - Joint members]
│   ├── shared-budget/
│   │   └── page.tsx           [Protected - Joint entity]
│   ├── shared-debts/
│   │   └── page.tsx           [Protected - Joint entity]
│   ├── shared-goals/
│   │   └── page.tsx           [Protected - Joint entity]
│   ├── shared-investments/
│   │   └── page.tsx           [Protected - Joint entity]
│   ├── payment-history/
│   │   └── page.tsx           [Protected - Joint tracking]
│   ├── war-room/
│   │   └── page.tsx           [Protected - Joint planning]
│   ├── insights/
│   │   └── page.tsx           [Protected - Joint analytics]
│   ├── safe-space/
│   │   └── page.tsx           [Protected - Joint notes]
│   ├── boundaries/
│   │   └── page.tsx           [Protected - Joint rules]
│   ├── joint-settings/
│   │   └── page.tsx           [Protected - Joint config]
│   └── exit/
│       └── page.tsx           [Protected - Exit process]
│
├── onboarding/
│   └── page.tsx               [Protected - First time setup]
│
└── invite/
    └── page.tsx               [Semi-public - Accept invite]
```

### Data Flow Pattern

```
Component (page.tsx or component.tsx)
    │
    ├─ "use client"              [Client-side directive]
    │
    ├─ useState                  [Local state]
    ├─ useCallback               [Memoized functions]
    ├─ useEffect                 [Side effects]
    │
    ├─ Custom Hooks (if needed)
    │   ├─ useAuth()             [Get current user]
    │   └─ useAccount()          [Get account context]
    │
    └─ API Calls (via lib/api.ts)
        ├─ debtApi.list()
        ├─ debtApi.create()
        ├─ investmentApi.list()
        ├─ accountApi.getAccount()
        ├─ rateApi.getRate()      [Exchange rates]
        │
        └─ Error Handling
            ├─ Catch & show toast
            ├─ Retry logic
            └─ Fallback to empty []

Render
    ├─ Loading state → spinner
    ├─ Error state → message
    └─ Data state → UI
```

### Important Frontend Patterns

```typescript
// ✅ CORRECT: Proper data fetching
const [debts, setDebts] = useState<Debt[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

const load = useCallback(async () => {
  try {
    setLoading(true);
    const data = await debtApi.list(accountId);
    setDebts(data);
  } catch (err) {
    setError(err instanceof Error ? err.message : "Unknown error");
  } finally {
    setLoading(false);
  }
}, [accountId]);

useEffect(() => {
  load();
}, [load]);

// ❌ WRONG: Missing error handling
useEffect(() => {
  debtApi.list(accountId).then(setDebts);
}, []);

// ❌ WRONG: Infinite loop
useEffect(() => {
  load(); // Called without dependencies
}, []);

// ❌ WRONG: Race condition
useEffect(() => {
  if (accountId) load();  // What if accountId changes?
}, []);  // No dependency array!
```

---

## 5. Service Dependencies

### Service Call Hierarchy

```
API Route (debts.py)
    │
    ├─ Authentication ✓ (current_user)
    ├─ Authorization ✓ (account_id permission)
    └─ Business Logic ⬇
        │
        └─ debt_engine.py
            │
            ├─ Uses: freedom_date.py
            │   └─ Calculates: Debt free date
            │
            ├─ Uses: income_engine.py
            │   └─ Calculates: Available payment capacity
            │
            ├─ Uses: exchange_rate.py (for multi-currency)
            │   └─ Converts: All debts to base currency
            │
            └─ ORM Write (via db session)
                └─ Database


Exchange Rate Service Flow
    │
    ├─ Scheduled Job: 09:00 IST daily
    │
    ├─ Fetches: Live rates (USD → *)
    │
    ├─ Stores: ExchangeRate model
    │
    └─ Frontend Usage
        ├─ rateApi.getRate("USD", "INR")
        ├─ Cached locally (in state)
        └─ Used in: convertToBase() utility


Email Service Flow
    │
    ├─ Scheduled Job: Every 15 seconds
    │
    ├─ Scans: Notifications table (status="pending")
    │
    ├─ Sends: Via Zoho SMTP
    │
    ├─ Updates: Notification status → "sent"/"failed"
    │
    └─ Logs: All attempts (for debugging)


Debt Reminder Job Flow
    │
    ├─ Scheduled Job: Daily (configurable time)
    │
    ├─ For each active debt:
    │   ├─ Check: Payment due?
    │   ├─ Create: Notification record
    │   └─ Queue: Email (via email_service)
    │
    └─ Track: Notification status
```

### Service Rules

**debt_engine.py**
- ✅ Reads from: Models (Debt, Transaction, UserProfile)
- ✅ Writes: Via ORM (db.add, db.commit)
- ✅ Dependencies: freedom_date, income_engine, exchange_rate
- ❌ Never: Direct SQL
- ❌ Never: External API (except exchange rates)

**freedom_date.py**
- ✅ Pure calculations
- ✅ Input: current_balance, payment_rate, interest_rate
- ✅ Output: Datetime object
- ❌ Database access: Only for reading parameters
- ❌ Side effects: None

**income_engine.py**
- ✅ Calculates: Available income for payments
- ✅ Considers: Multiple income sources, variable income
- ✅ Input: UserProfile, historical transactions
- ❌ Side effects: None

**exchange_rate.py**
- ✅ Reads: Latest ExchangeRate record
- ✅ Converts: Amount from X currency to Y currency
- ✅ Cache strategy: Load rates once, use multiple times
- ❌ Makes API calls: Only during scheduled job

**email_service.py**
- ✅ Async operations
- ✅ Queue pattern: Read from DB → Send → Update status
- ✅ Error handling: Retry logic, status tracking
- ❌ Blocking operations

---

## 6. Data Flow Patterns

### Create Debt Flow

```
Frontend (debts/page.tsx)
    │ User submits form
    └─ POST /api/accounts/{id}/debts
        └─ Backend (api/debts.py)
            │
            ├─ Validate schema
            ├─ Auth check ✓
            ├─ Permission check ✓
            │
            └─ Create business logic
                │
                ├─ ORM: db.add(Debt(...))
                ├─ Calculate: freedom_date via debt_engine
                ├─ ORM: db.add(Notification(...))
                │       [Optional: "Debt added" notification]
                │
                ├─ db.commit()  ← Transaction boundary
                │
                └─ Return: Debt object
                    │
                    └─ Frontend
                        ├─ Update state
                        ├─ Show success toast
                        └─ Reload debts list
```

### Multi-Currency Net Worth Calculation

```
Frontend (net-worth/page.tsx)
    │
    ├─ Load: All debts for account
    ├─ Load: All investments for account
    ├─ Load: Account base_currency
    │
    └─ Process:
        │
        ├─ Extract unique currencies
        │   (from debts, investments, + base_currency)
        │
        ├─ Fetch: Exchange rates for ALL currencies
        │   POST calls to: rateApi.getRate("USD", currency)
        │   Backend → Fetch from ExchangeRate table
        │
        ├─ Convert: All amounts to base_currency
        │   Using: convertToBase() utility
        │   Formula: amount × rates[currency]
        │
        └─ Calculate:
            ├─ totalDebt = Σ(debt in base_currency)
            ├─ totalAssets = Σ(investment in base_currency)
            └─ netWorth = totalAssets - totalDebt
```

### Joint Account Payment Settlement

```
Joint Members (A, B, C)
    │
    ├─ Member A: Pays ₹5000 (shared debt)
    │
    └─ System creates Transaction:
        ├─ type: "payment"
        ├─ payer: Member A
        ├─ amount: 5000
        ├─ category: "debt_payment"
        │
        └─ Calculates: Who owes whom
            │
            ├─ Total debt: ₹15000
            ├─ Each owes: ₹5000
            ├─ Member A paid: ₹5000
            │
            └─ Settlement status:
                ├─ Member A: ✓ Settled
                ├─ Member B: Owes ₹5000 to A
                └─ Member C: Owes ₹5000 to A
```

---

## 7. Critical Constraints

### Database Constraints

| Rule | Why | Example |
|---|---|---|
| Foreign Key Integrity | Data consistency | account_id must exist in accounts table |
| Unique Emails | User identification | email column has UNIQUE constraint |
| NOT NULL enforcements | Data validity | account.base_currency cannot be NULL |
| Cascade Delete | Clean orphan removal | Delete account → Delete all debts |
| Account Isolation | Multi-tenant security | User A cannot see User B's debts |
| Currency consistency | Finance accuracy | All debts in debt stored with currency |

### API Constraints

| Rule | Why | Example |
|---|---|---|
| JWT expiry (15 min) | Security | Token becomes invalid after 15 min |
| Refresh token (7 days) | Session lifecycle | Can renew for 7 days, then re-login |
| Role-based access (member/viewer) | Permission control | Viewers cannot create/edit |
| Account ownership | Multi-tenant | Only members can access account |
| Rate limiting (future) | DDoS protection | Max 100 requests/minute |

### Frontend Constraints

| Rule | Why | Example |
|---|---|---|
| "use client" directive | Component client-side | Must for useState/useEffect |
| Error boundary | Graceful failures | Catch and display error |
| Loading states | UX | Show spinner while fetching |
| Re-fetch on dependency change | Data freshness | useEffect dependency array |
| Currency display consistency | UX | Always show base_currency for totals |

### Service Constraints

| Rule | Why | Example |
|---|---|---|
| Async only for jobs | Performance | No blocking operations |
| Idempotent operations | Safety | Can retry without side effects |
| Transaction boundaries | Data consistency | db.commit() at operation end |
| Error resilience | Availability | Job continues despite one failure |
| Logging all mutations | Audit trail | Every DB write is logged |

---

## 8. Common Pitfalls

### ❌ Pitfall 1: Missing Permission Check

```python
# WRONG: Allows access to any account
@router.get("/accounts/{account_id}/debts")
async def list_debts(
    account_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # User can pass ANY account_id
    debts = await db.execute(...)
    return debts

# RIGHT: Validates permission
@router.get("/accounts/{account_id}/debts")
async def list_debts(
    account_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    account: Account = Depends(get_account_with_permission),  # ← CHECK
):
    debts = await db.execute(...)
    return debts
```

### ❌ Pitfall 2: Infinite Fetch Loop

```typescript
// WRONG: Fetches on every render
useEffect(() => {
  load();
}, []);  // No load in dependencies!

// RIGHT: Fetch once with load in deps
const load = useCallback(async () => {
  const data = await debtApi.list(accountId);
  setDebts(data);
}, [accountId]);

useEffect(() => {
  load();
}, [load]);  // load is in dependencies
```

### ❌ Pitfall 3: Missing Error Handling

```typescript
// WRONG: No error handling
useEffect(() => {
  debtApi.list(accountId).then(setDebts);  // What if this fails?
}, [accountId]);

// RIGHT: Full error handling
const load = useCallback(async () => {
  try {
    setLoading(true);
    const data = await debtApi.list(accountId);
    setDebts(data);
    setError(null);
  } catch (err) {
    setError(err instanceof Error ? err.message : "Error");
  } finally {
    setLoading(false);
  }
}, [accountId]);
```

### ❌ Pitfall 4: Ignoring Currency Mismatch

```python
# WRONG: Assumes all amounts are in base_currency
total = sum(debt.current_balance for debt in debts)

# RIGHT: Convert to base currency first
total = sum(
    convertToBase(debt.current_balance, debt.currency, base_currency, rates)
    for debt in debts
)
```

### ❌ Pitfall 5: Cascade Delete Without Verification

```python
# WRONG: Deletes account without checking dependent data
db.delete(account)  # Deletes debts, goals, investments, etc.
db.commit()

# RIGHT: Explicit cascade or warning
# SQLAlchemy handles cascade, but LOG what's being deleted
logger.info(f"Deleting account {account_id}")
logger.info(f"  - Deleting {len(account.debts)} debts")
logger.info(f"  - Deleting {len(account.goals)} goals")
db.delete(account)
db.commit()
```

### ❌ Pitfall 6: Joint Account Member Role Confusion

```python
# WRONG: Treats all members the same
if account in user.accounts:
    return "Can access"

# RIGHT: Check specific role
membership = get_account_membership(user, account)
if membership.role == "viewer":
    # Can read, not write
else:
    # Can read and write
```

### ❌ Pitfall 7: Race Condition in Multi-Member Joint

```python
# WRONG: Two members update payment simultaneously
member_a_payment = 5000
member_b_payment = 3000
db.execute(update(debt).values(current_balance = original - member_a_payment))
db.execute(update(debt).values(current_balance = original - member_b_payment))
# Result: Only member_b's payment is recorded!

# RIGHT: Use transaction
async with db.begin():
    # Both updates happen atomically
    db.execute(update(debt).values(current_balance -= 5000))
    db.execute(create_transaction(...))
    # If any fails, entire transaction rolls back
```

### ❌ Pitfall 8: Forgetting Account Type Check

```python
# WRONG: Allows joint operations on personal account
@router.post("/api/joint/members")
async def add_member(account_id: UUID, ...):
    account = get_account(account_id)
    # What if account.type == "personal"?

# RIGHT: Validate account type
@router.post("/api/joint/members")
async def add_member(
    account_id: UUID,
    account: Account = Depends(get_account_with_permission),
    ...
):
    if account.type != "joint":
        raise HTTPException(status_code=400, detail="Not a joint account")
    # Now safe to proceed
```

---

## 9. Implementation Checklist

When implementing a new feature, verify:

### Backend (API Endpoint)

- [ ] Authentication dependency: `get_current_user`
- [ ] Authorization dependency: `get_account_with_permission`
- [ ] Input validation: Pydantic schema
- [ ] Output validation: Pydantic schema
- [ ] Permission check: User is member/viewer
- [ ] Database transaction: Proper `db.commit()`
- [ ] Error handling: Try/except with meaningful errors
- [ ] Logging: Critical operations logged
- [ ] Account type check: `account.type` verified if needed
- [ ] Multi-currency handling: If dealing with money
- [ ] Cascade behavior: Documented in docstring

### Frontend (Page or Component)

- [ ] "use client" directive present
- [ ] State management: useState/useCallback/useEffect
- [ ] Error handling: Try/catch or error state
- [ ] Loading state: Spinner during fetch
- [ ] Dependency array: All deps in useEffect
- [ ] Permission check: If needed
- [ ] Error display: User-friendly messages
- [ ] Currency consistency: Base currency used
- [ ] Accessibility: ARIA labels, keyboard nav
- [ ] Mobile responsive: Works on small screens

### Database

- [ ] Migration created: `alembic/versions/`
- [ ] Relationships defined: ForeignKey constraints
- [ ] Cascade rules set: Delete/update behavior
- [ ] Indexes added: For frequent queries
- [ ] Constraints enforced: NOT NULL, UNIQUE
- [ ] Migration reversible: Down script works

---

## 10. Asking for Help

When reporting issues or asking for changes, include:

1. **What broke**: Specific error message or unexpected behavior
2. **When it broke**: After which change/commit
3. **User type**: Personal account or joint account?
4. **Account type**: Which account_id if applicable
5. **Expected vs actual**: What should happen vs what does happen
6. **Steps to reproduce**: How to recreate the issue

**Example:**
```
Issue: Net worth calculation shows wrong total after adding investment
When: After adding ₹10,000 USD investment to INR account
User: Personal account (abc-123)
Expected: Total should convert USD to INR using latest rate
Actual: Shows ₹10,000 instead of ~₹830,000
Steps:
1. Add investment in USD
2. Go to net-worth page
3. See wrong calculation
```

---

## 11. Database Migration Reference

### When to create migration:

```bash
# 1. Add new table
alembic revision --autogenerate -m "Add merchant_rules table"

# 2. Add column to existing table
alembic revision --autogenerate -m "Add interest_rate to debt"

# 3. Update relationship
alembic revision --autogenerate -m "Add cascade delete from account to notifications"

# 4. Apply migration
alembic upgrade head

# 5. Rollback if needed
alembic downgrade -1
```

---

## Last Update Notes

- **Date**: April 28, 2026
- **Version**: v-0.1
- **Major Components**: Personal & Joint accounts, Debt tracking, Investment portfolio, Exchange rates, Email notifications
- **Recent Additions**: PDF import, Merchant rules, Joint formation tracking
- **Upcoming**: Mobile app via Capacitor, Advanced forecasting, AI insights

---

**⚠️ CRITICAL: This document must be consulted before any significant changes. When in doubt, ask before implementing.**
