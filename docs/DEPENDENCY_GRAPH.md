# RepoGraph Configuration & Dependency Visualization

> Auto-generated dependency mapping for Financial Command Center

## Quick Reference

### Module Dependency Graph

```
FRONTEND (Next.js)
├── pages/
│   ├── (auth)/* → api/auth
│   ├── (personal)/* → api/accounts, api/debts, api/investments, api/goals, api/transactions
│   └── (joint)/* → api/joint/*, api/accounts
├── hooks/
│   ├── useAuth → localStorage + api/auth
│   ├── useAccount → api/accounts
│   └── useCustom → Various APIs
├── lib/
│   ├── api.ts → All API endpoints
│   └── utils.ts → convertToBase, fmt, getPersonalAccountId
└── types/
    └── index.ts → User, Account, Debt, Investment, etc.

BACKEND (FastAPI)
├── api/
│   ├── auth.py → deps, models.User, schemas.User
│   ├── accounts.py → deps, models.Account, services
│   ├── debts.py → deps, models.Debt, services.debt_engine
│   ├── investments.py → deps, models.Investment, services.exchange_rate
│   ├── transactions.py → deps, models.Transaction
│   ├── goals.py → deps, models.Goal
│   ├── import_pdf.py → services.pdf_parser
│   └── joint/
│       ├── members.py → deps, models.AccountMember
│       ├── payments.py → deps, models.Transaction, services.debt_engine
│       ├── boundaries.py → deps, models.Account
│       └── scenarios.py → deps, services
├── services/
│   ├── debt_engine.py → models.Debt, models.Transaction, freedom_date.py, income_engine.py, exchange_rate.py
│   ├── freedom_date.py → Pure math (no deps)
│   ├── income_engine.py → models.UserProfile, models.Transaction
│   ├── exchange_rate.py → models.ExchangeRate, httpx (external API)
│   ├── email_service.py → models.Notification, aiosmtplib
│   ├── debt_reminder.py → models.Notification, debt_engine.py
│   ├── pdf_parser.py → PyPDF (external)
│   └── watchdog.py → Logging, health check
├── models/ (SQLAlchemy ORM)
│   ├── user.py
│   ├── account.py → Foreign key to User
│   ├── debt.py → Foreign key to Account
│   ├── transaction.py → Foreign key to Account, Debt
│   ├── goal.py → Foreign key to Account
│   ├── investment.py → Foreign key to Account
│   ├── merchant_rule.py → Foreign key to Account
│   └── notification.py → Foreign key to Account
├── schemas/ (Pydantic validation)
│   ├── user.py
│   ├── account.py
│   ├── debt.py
│   ├── etc.
├── core/
│   ├── config.py → Environment variables
│   ├── database.py → PostgreSQL connection, AsyncSessionLocal
│   ├── security.py → JWT, password hashing
│   ├── email.py → Zoho SMTP config
│   └── crypto.py → Encryption utilities
└── main.py
    ├── FastAPI app setup
    ├── CORS middleware
    ├── All route imports
    └── APScheduler (Background jobs)

DATABASE (PostgreSQL 16)
├── users
├── sessions
├── accounts
├── account_members
├── debts
├── transactions
├── goals
├── investments
├── merchant_rules
├── exchange_rates
├── notifications
└── user_profiles
```

## Critical Dependency Paths

### When Adding a Debt

```
frontend/debts/page.tsx
  │ POST /api/accounts/{id}/debts
  ├─ api/debts.py (create_debt)
  ├─ deps.py (get_current_user, get_account_with_permission)
  ├─ models.Debt
  ├─ services/debt_engine.py
  │  ├─ services/freedom_date.py (calculate due date)
  │  ├─ services/income_engine.py (calculate payment capacity)
  │  └─ services/exchange_rate.py (if multi-currency)
  ├─ models.Notification
  ├─ database.AsyncSessionLocal
  ├─ [Transaction commit]
  └─ Return Debt object to frontend
```

### When Fetching Net Worth

```
frontend/net-worth/page.tsx
  │
  ├─ GET /api/accounts/{id}/debts
  │  └─ api/debts.py (list_debts)
  │     └─ models.Debt query
  │
  ├─ GET /api/accounts/{id}/investments
  │  └─ api/investments.py (list_investments)
  │     └─ models.Investment query
  │
  ├─ GET /api/accounts/{id}
  │  └─ api/accounts.py (get_account)
  │     └─ models.Account query [get base_currency]
  │
  ├─ GET /api/exchange-rates?from=USD&to=INR
  │  └─ Fetch models.ExchangeRate (populated by daily job)
  │
  ├─ Frontend: lib/utils.ts
  │  ├─ convertToBase() [uses exchange rates]
  │  ├─ fmt() [format currency]
  │  └─ Calculations in React
  │
  └─ Display: Component rendering
```

### Scheduled Background Jobs

```
APScheduler (main.py startup)
│
├─ Exchange Rate Job [Daily 09:00 IST]
│  └─ services/exchange_rate.py (daily_rate_job)
│     ├─ Fetch from external API
│     ├─ Store in models.ExchangeRate
│     └─ db.commit()
│
├─ Email Queue Job [Every 15 seconds]
│  └─ services/email_service.py (process_email_queue)
│     ├─ Query models.Notification (status=pending)
│     ├─ Send via aiosmtplib (Zoho)
│     ├─ Update status to sent/failed
│     └─ db.commit()
│
└─ Debt Reminder Job [Daily]
   └─ services/debt_reminder.py (daily_debt_reminder_job)
      ├─ Query models.Debt (due date today)
      ├─ Create models.Notification
      ├─ Queue for email
      └─ db.commit()
```

## File-to-File Dependencies

### Critical Dependencies That Must Work Together

| Frontend | → | Backend API | → | Service | → | Database |
|---|---|---|---|---|---|---|
| net-worth/page.tsx | → | api/debts.py | → | debt_engine.py | → | models.Debt |
| net-worth/page.tsx | → | api/investments.py | → | exchange_rate.py | → | models.ExchangeRate |
| debts/page.tsx | → | api/debts.py | → | freedom_date.py | → | (pure function) |
| transactions/page.tsx | → | api/transactions.py | → | debt_engine.py | → | models.Transaction |
| joint/payments/page.tsx | → | api/joint/payments.py | → | debt_engine.py | → | models.Transaction |
| (any)/page.tsx | → | lib/api.ts | → | BaseURL + endpoints | → | FastAPI |

## Import Statements to Watch

### Backend - Circular Dependencies Avoided

```python
# ✅ SAFE: services imports models
from app.models import Debt, Transaction
from app.services import debt_engine

# ✅ SAFE: api imports from services
from app.services.debt_engine import calculate_freedom_date
from app.api import debts

# ❌ CIRCULAR: Never do this
# services/debt_engine.py
from app.api import debts  # ← This would cause circular import!

# ❌ WRONG: api importing from another api
# api/debts.py
from app.api import investments  # ← Could cause circular imports
```

### Frontend - Hook Dependencies

```typescript
// ✅ SAFE: Page uses hooks and APIs
"use client";
import { useAuth } from "@/hooks/useAuth";
import { debtApi } from "@/lib/api";

// ❌ WRONG: Importing another page component
import { NetWorthPage } from "./net-worth/page";

// ❌ WRONG: Importing from app/main.py (backend)
import { main } from "@/app/main";  // ← This won't work!
```

## Environment Dependencies

### Backend (.env)

```
DATABASE_URL=postgresql+asyncpg://user:pass@localhost/db
EXCHANGE_RATE_FETCH_HOUR_IST=9
EXCHANGE_RATE_API_KEY=...
ZOHO_SMTP_USERNAME=...
ZOHO_SMTP_PASSWORD=...
JWT_SECRET=...
```

### Frontend (.env.local)

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

**If these change:**
- Backend: Restart FastAPI server
- Frontend: Rebuild Next.js (`npm run build`)

## Dependency Tree for New Features

When adding a new feature, check:

### Feature: "Add recurring debt payments"

```
Affected Components:
├─ Frontend
│  └─ Create page: /app/(personal)/recurring-debts/page.tsx
│     ├─ Imports: useAuth, debtApi, convertToBase
│     └─ Uses: useState, useEffect, useCallback
│
├─ Backend API
│  ├─ New endpoint: /api/accounts/{id}/recurring-debts
│  ├─ Imports: deps, models.Debt, schemas
│  └─ Dependency: Get account permission
│
├─ Models
│  ├─ New field: Debt.is_recurring, Debt.recurrence_pattern
│  └─ Migration: 0007_add_recurring_debts.py
│
├─ Services
│  ├─ Update: debt_engine.py (handle recurring)
│  └─ Add: Process recurring job
│
└─ Database
   ├─ Migration: Add columns to debts table
   └─ Data: Backfill existing debts with is_recurring=False
```

## Validation Dependencies

### Request Validation Path

```
Frontend Form Submit
  └─ lib/api.ts → Fetch with data
     └─ Backend receives request
        └─ Pydantic schema validation (schemas/*.py)
           ├─ Type checking
           ├─ Field validation
           └─ Custom validators
              └─ If valid → Process
              └─ If invalid → Return 422
        └─ Model validation (models/*.py)
           ├─ SQLAlchemy constraints
           └─ Database-level validation
              └─ If valid → Insert
              └─ If invalid → Rollback
```

## Authorization Dependency Chain

```
Request arrives at API endpoint
  └─ dependency: get_current_user
     ├─ Extract JWT from Authorization header
     ├─ Verify JWT signature
     ├─ Check expiry
     ├─ Load user from DB
     └─ If invalid → 401 Unauthorized
  
  └─ dependency: get_account_with_permission
     ├─ Load account from ID
     ├─ Check user is AccountMember
     ├─ Check membership status = "active"
     ├─ Verify role (member can write, viewer can read-only)
     └─ If no permission → 403 Forbidden
  
  └─ Route handler
     ├─ All dependencies resolved
     └─ Safe to proceed with DB access
```

## Performance Dependencies

### What affects page load time:

```
net-worth/page.tsx load time depends on:
├─ API response time
│  ├─ GET /api/accounts/{id}/debts
│  │  └─ Database query: SELECT from debts WHERE account_id = ?
│  ├─ GET /api/accounts/{id}/investments
│  │  └─ Database query: SELECT from investments WHERE account_id = ?
│  ├─ GET /api/accounts/{id}
│  │  └─ Database query: SELECT from accounts WHERE id = ?
│  └─ GET /api/exchange-rates
│     └─ Database query: SELECT * from exchange_rates (cached)
│
├─ Frontend calculation
│  ├─ convertToBase() for each debt/investment
│  └─ Math operations (reduce, map, filter)
│
└─ Rendering
   ├─ React re-renders
   └─ CSS calculations

Optimization points:
├─ Add database indexes on account_id
├─ Cache exchange rates (daily update)
├─ Batch API calls (Promise.all)
├─ Memoize calculations (useCallback)
└─ Lazy load non-critical data
```

## Testing Dependencies

When testing debts/page.tsx:

```
Unit Tests
├─ lib/utils.ts
│  ├─ convertToBase() function
│  ├─ fmt() function
│  └─ getPersonalAccountId() function
│
├─ Components
│  └─ DebtsList component
│     └─ Mocked API responses
│
Integration Tests
├─ debtApi.list() → Mock backend response
├─ useAuth() hook
└─ Full page load

E2E Tests
├─ User login → /login
├─ Navigate to /debts
├─ Verify API calls made
├─ Verify UI renders correctly
└─ Verify exchange rates used
```

## Common Dependency Mistakes to Avoid

| Mistake | Why It Fails | Solution |
|---|---|---|
| Import from backend in frontend | Frontend can't execute Python | Use API endpoints only |
| Circular imports in services | Python import error | Restructure dependencies |
| Missing get_account_with_permission | Security breach | Always include in route |
| Direct SQL queries | Bypass ORM validation | Use SQLAlchemy query |
| No useCallback on useEffect deps | Infinite loops | Memoize functions |
| Assuming currency consistency | Wrong calculations | Always convert to base |
| Accessing raw localStorage | Race conditions | Use useAuth hook |
| Multiple API calls without Promise.all | Slow performance | Parallel load data |

---

**File generated**: April 28, 2026  
**Purpose**: Visual reference for RepoGraph + Architecture Doc  
**Status**: Keep synchronized with actual codebase
