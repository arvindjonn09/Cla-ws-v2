# App Working Notes

This document records how the app currently works in the codebase. It is meant to be a shared reference before making future changes, so fixes do not solve one screen while breaking another.

## Current Stack

- Frontend: Next.js 15 app router, React 19, TypeScript, Tailwind CSS 4.
- Backend: FastAPI, async SQLAlchemy, PostgreSQL, Alembic.
- Auth: JWT access tokens plus refresh tokens stored in the database `sessions` table.
- Background jobs: APScheduler starts inside FastAPI lifespan.
- Main frontend API wrapper: `frontend/src/lib/api.ts`.
- Main backend entrypoint: `backend/app/main.py`.

## Product Shape

The app is a Financial Command Center. It has two major work areas:

- Personal account area: dashboard, debts, budget, goals, investments, net worth, emergency fund, subscriptions, bills, transactions, forecast, growth, journal, settings.
- Joint account area: war room, shared debts, payment warnings/history, insights, forecast, shared goals/growth/investments, safe space, planning, members, notifications, settings.

The core idea is that every user gets a personal account, and users can also join or create one active joint account. The debt journey centers on the Freedom Date, which is computed from active debts.

## Auth Flow

Signup does the following in `backend/app/api/auth.py`:

1. Creates a `users` row with `is_verified = false`.
2. Creates a personal `accounts` row.
3. Creates an active `account_members` row for the user as `member`.
4. Creates a `user_profiles` row for that user/account.
5. Creates notification preferences.
6. Queues a verification email.

Email verification:

1. Finds the user by verification token.
2. Marks the user verified.
3. Selects the first active account membership.
4. Issues access and refresh tokens.
5. Stores the refresh token in `sessions`.

Login:

1. Checks email/password.
2. Rejects unverified users.
3. Selects the user's active account membership.
4. Checks onboarding status from that account's profile.
5. Issues access and refresh tokens.
6. Stores the refresh token in `sessions`.

Refresh:

1. Decodes the refresh token.
2. Checks that the token exists in `sessions` and has not expired.
3. Issues a new access token and refresh token.
4. Replaces the stored session token.

Frontend auth state:

- Tokens and the user object are stored in `localStorage`.
- `saveTokens()` also sets an `fcc_auth` cookie.
- `frontend/src/middleware.ts` only checks the `fcc_auth` cookie, not the JWT itself.
- If an API request gets a 401, `api.ts` tries `/api/auth/refresh` and retries once.
- If refresh fails, localStorage is cleared and the user is sent to `/login`.

## Account Selection And Local Storage

Important helpers live in `frontend/src/lib/utils.ts`.

- `getAccountId()` currently returns the personal account id.
- `getPersonalAccountId()` reads `personal_account_id`, or falls back to `account_id` when current `account_type` is not joint.
- `getJointAccountId()` reads `joint_account_id`, or falls back to `account_id` when current `account_type` is joint.
- `saveAccountMeta()` saves personal account metadata unless the type is `joint`.
- `saveJointAccountMeta()` saves joint account metadata separately.
- `saveAccountMemberships()` reads `/api/accounts/mine` results and saves both personal and joint ids when present.

This means future pages must be careful to use the right helper:

- Personal pages should use `getPersonalAccountId()` or existing `getAccountId()`.
- Joint pages should use `getJointAccountId()`.
- A page using the wrong helper can silently load or modify the wrong account.

## Access Control

Shared backend dependencies live in `backend/app/api/deps.py`.

- `get_current_user` validates a bearer access token, loads the user, and rejects unverified users.
- `get_account_member` checks the user is an active member of the requested account.
- `require_full_member` rejects users whose role is not `member`.

Current pattern:

- Most list/read/write endpoints require `require_full_member`, so viewers are often blocked even from reads.
- A few read-only endpoints use `get_account_member`.
- If viewer behavior is changed, backend dependencies and frontend assumptions both need to be reviewed together.

## Backend Routers

Mounted routers in `backend/app/main.py`:

- Auth: `/api/auth`
- Accounts: `/api/accounts`
- Debts: `/api/accounts/{account_id}/debts`
- Transactions: `/api/accounts/{account_id}/transactions`
- Goals: `/api/accounts/{account_id}/goals`
- Investments: `/api/accounts/{account_id}/investments`
- PDF import: `/api/accounts/{account_id}/transactions/import-pdf`, `/import-bulk`, `/api/merchant-rules/learn`
- Joint boundaries: `/api/accounts/{account_id}/boundaries`
- Joint scenarios: `/api/accounts/{account_id}/scenarios`
- Joint payment warnings: `/api/accounts/{account_id}/payment-warnings`
- Joint safe space: `/api/accounts/{account_id}/safe-space`

There are also health and exchange-rate endpoints directly in `main.py`.

## Data Model Overview

Main models:

- `User`: login identity and verification/reset fields.
- `Session`: stored refresh token per login.
- `Account`: personal or joint account.
- `AccountMember`: user/account link with role and status.
- `UserProfile`: onboarding, income, debt method, motivation, local currency.
- `InviteToken`: joint account invitations.
- `Debt` and `DebtPayment`: debt tracking and payment history.
- `Transaction`: income, expense, transfer, or debt payment entries.
- `Goal`: savings/debt/emergency/custom goals.
- `Investment`: portfolio items.
- `InvestmentSecureDetails`, `InvestmentSecureCode`, `InvestmentSecureAccessLog`: encrypted investment details and email-code reveal flow.
- `Notification`-related tables: bills, subscriptions, spending boundaries, payment warnings, scenarios, safe space messages, journal entries, milestones, email log, notification preferences.
- `MerchantRule`: learned PDF-import category rules.

## Debt Flow

Debt CRUD lives in `backend/app/api/debts.py`.

- Debts are account-scoped.
- Creating a debt sets `added_by` to the current user.
- Updating a cleared debt sets `cleared_at` and zeroes the balance.
- Logging a payment creates a `DebtPayment` and subtracts `amount + extra_amount` from `current_balance`.
- If the balance reaches zero, the debt becomes `cleared`.

Freedom Date:

- `/api/accounts/{account_id}/debts/freedom-date` loads active debts for the account.
- It reads the current user's `UserProfile.debt_method`.
- It calls `compute_freedom_date()`.
- The engine compares snowball, avalanche, and custom results.
- Snowball orders by smallest balance.
- Avalanche orders by highest interest rate.
- The simulation rolls freed monthly payments into the next priority debt.

## Personal-To-Joint Debt Sharing

The debt sharing model is important.

Personal debt shared to joint:

1. Source debt must belong to a personal account.
2. Current user must own the source debt if `added_by` is set.
3. User must have an active joint account.
4. A new debt is created in the joint account.
5. Mirrored fields are copied from the personal debt.
6. Personal source is marked `is_shared = true`, `is_locked = true`.
7. Source stores `shared_to_account_id` and `shared_to_debt_id`.
8. Joint debt stores `shared_from_debt_id`.

Editing rules:

- Locked personal source debts cannot be edited or paid from the personal side.
- The joint debt is editable.
- When the joint debt changes, `_sync_source_debt()` copies mirrored fields back to the personal source.
- Deleting the joint debt unlocks the personal source and clears its share pointers.

This is a high-risk area. Future debt changes must preserve source/joint mirror behavior.

## Transactions And PDF Import

Transactions:

- CRUD is account-scoped.
- Transactions support filters: category, type, from date, to date, limit, offset.
- Write operations require full member access.

PDF import:

- Upload accepts only PDFs up to 20 MB.
- Parser extracts raw transactions and an unreadable flag.
- Learned merchant rules are applied.
- Transfers are separated.
- Recurring bills are detected from non-transfer transactions.
- Existing duplicates are filtered.
- Frontend receives preview lists for bills, transactions, transfers, skipped duplicates, and unreadable status.
- Confirmed items are saved through `/transactions/import-bulk`.
- Category corrections are saved globally through `/api/merchant-rules/learn`.

## Investments

Investments are account-scoped but visibility-aware.

- A user sees active investments where `visibility = shared`, or where they are the creator, or where `added_by` is null.
- Secure details are encrypted with `backend/app/core/crypto.py`.
- Secure details are never returned in normal investment list/create/update responses.
- To reveal secure details, the user requests an email code, then verifies the code.
- Reveal access is logged.
- Revealed secure details include a `revealed_until` timestamp, but frontend behavior must enforce any hiding after that time.

## Joint Features

Implemented joint routes include:

- Boundaries: list/create spending boundaries.
- Payment warnings: list warnings and confirm a warning.
- Scenarios: list/create draft scenarios.
- Safe space: list/send messages.
- Members: invite, accept invite, list members, remove viewer, close account placeholder.

Business rules currently enforced:

- A user can only have one active joint account as a full `member`.
- Viewers cannot become members through invite acceptance.
- A joint account can have at most five active viewers.
- Full members cannot be removed with the viewer removal endpoint.
- Joint account close is currently only a placeholder response.

## Frontend Routing

Route groups:

- `frontend/src/app/(auth)`: login/signup/verify/forgot/reset.
- `frontend/src/app/(personal)`: personal screens with `PersonalNav`.
- `frontend/src/app/(joint)`: joint screens with `JointNav`.
- `frontend/src/app/onboarding`: onboarding wizard.
- `frontend/src/app/invite`: invitation acceptance flow.

Navigation:

- Personal and joint layouts are separate.
- Personal nav must always provide a joint path:
  - show "Switch to Joint" when `/api/accounts/mine` shows an active joint account.
  - show "Create Joint" when no active joint account exists.
- Joint nav always has "Switch to Personal".
- Desktop uses sidebars; mobile uses bottom bars.

## Background Jobs

FastAPI lifespan starts APScheduler:

- Exchange rates daily using configured IST time.
- Email queue every 15 seconds.
- Debt reminders daily at 08:00 Asia/Kolkata.

Because these run inside app startup, future server/process changes must avoid accidentally starting duplicate schedulers.

## Known Implementation Mismatches Or Risks

- `TokenResponse` frontend type requires `onboarding_complete`, but some backend auth responses do not always pass it explicitly.
- `rateApi.status()` frontend type expects `usd_zar`, while backend `/api/exchange-rates/status` returns `usd_eur`.
- Many modified files already exist in the worktree; future edits must not overwrite unrelated user changes.
- Some frontend imports/types use current assumptions that may not match every backend response.
- Some joint pages may be using the wrong account-id helper unless checked page by page.
- Viewer access is not consistently read-only across the whole backend because many list endpoints require full member access.
- Joint account close is not fully implemented.
- `getAccountId()` means personal by default; using it in joint pages is likely wrong.

## Change Rules For Future Work

Before changing code:

1. Identify whether the screen is personal, joint, or shared auth.
2. Confirm which account id helper the screen should use.
3. Check the matching frontend API method in `frontend/src/lib/api.ts`.
4. Check the backend route and schema for that method.
5. Check whether the endpoint requires full member or any account member.
6. For debts, check whether the debt can be shared/locked/mirrored.
7. For auth/account changes, check localStorage, middleware cookie, access token payload, and refresh flow together.
8. For models/schemas, check SQLAlchemy model, Pydantic schema, migration, API response type, and frontend TypeScript type together.
9. Do not change UI behavior only on one side if the backend contract also needs to change.
10. Run the smallest useful verification after each change.
11. Update this document after behavior changes, especially if a route, account flow, or backend/frontend contract changes.

## Safe Editing Checklist

Use this checklist before future fixes:

- Which route/page is affected?
- Which account id is used?
- Which backend endpoint is called?
- What role should be allowed: member only, or viewer too?
- Does this touch auth/session/onboarding?
- Does this touch debt sharing or locked mirrored debts?
- Does this touch imported PDF transactions or learned rules?
- Does this touch secure investment details?
- Are frontend TypeScript types still aligned with backend schemas?
- Are migrations needed?
- Did I avoid unrelated modified files?
- Did I test or at least type-check the touched area?

## Working Change Log

### 2026-04-26 — Restored Joint Account Creation Entry Point

Problem:

- Backend supported `POST /api/accounts/joint`, but the frontend had no visible create-joint action.
- Personal nav only showed "Switch to Joint" after a joint account already existed, leaving first-time users with no way to create one.

Changed:

- Added `accountApi.createJoint()` in `frontend/src/lib/api.ts`.
- Updated `PersonalNav` so it shows:
  - "Create Joint" when no active joint account exists.
  - "Switch to Joint" when an active joint account exists.
- After creating a joint account, the frontend saves joint account metadata, refreshes memberships, and redirects to `/war-room`.

Verification required:

- From a personal account with no active joint account, the sidebar should show "Create Joint".
- Clicking it should create the joint account and redirect to `/war-room`.
- Logging out and back in should then show "Switch to Joint".
