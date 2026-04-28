# Architecture Reference - Quick Start Guide

**Version**: v-0.1  
**Created**: April 28, 2026  
**Purpose**: Help AI assistants understand your codebase architecture and maintain consistency

---

## 📍 Where to Find What

### 1. **Complete Architecture Guide**
📄 [ARCHITECTURE_AND_DEPENDENCIES.md](/home/shiva/kosa/docs/ARCHITECTURE_AND_DEPENDENCIES.md)

**Use this for:**
- Understanding the complete system
- Learning the 9-stage financial journey
- Understanding data relationships
- Learning common pitfalls
- Implementation checklists

**Key Sections:**
- System architecture diagram
- Data models and relationships
- API layer structure
- Frontend architecture
- Service dependencies
- Data flow patterns
- Critical constraints
- Common pitfalls to avoid

---

### 2. **Dependency Graph (Visual Reference)**
📄 [DEPENDENCY_GRAPH.md](/home/shiva/kosa/docs/DEPENDENCY_GRAPH.md)

**Use this for:**
- Understanding how components talk to each other
- Tracing data flow through the system
- Identifying which files might break if you change something
- Performance optimization points
- Testing strategy

**Key Sections:**
- Module dependency graph
- Critical dependency paths
- File-to-file dependencies
- API endpoint dependencies
- Authorization dependency chain
- Performance impact analysis

---

### 3. **RepoGraph Visualization**
📁 [.repograph/kosa_config.json](/home/shiva/kosa/.repograph/kosa_config.json)

**Use this for:**
- Sharing with other AI assistants
- Visual structure reference
- Quick lookup of critical paths
- Feature impact analysis

**Content includes:**
- Project structure
- Critical data flows
- Key constraints
- Common pitfalls
- File mapping for features

---

## 🔍 How to Use When Asking for Help

### Example 1: "Add a new feature - recurring debt payments"

**What you should tell AI:**

```
Task: Add recurring debt payments

Details:
- Users want to set up automatic recurring payments on debts
- Should support weekly, biweekly, monthly frequency
- Should create transactions automatically on schedule
- Should respect joint account boundaries

Then provide:
- What data needs to be stored?
- What API endpoints are needed?
- What frontend pages/components?
- Are there multi-currency concerns?
- Do joint account rules apply?

AI can then:
1. Check ARCHITECTURE_AND_DEPENDENCIES.md for patterns
2. Use DEPENDENCY_GRAPH.md to trace impact
3. Follow the implementation checklist
4. Verify all dependencies are met
```

### Example 2: "We have a bug in net-worth calculation"

**What you should tell AI:**

```
Bug Report:
- Issue: Net worth shows wrong total when account has multiple currencies
- When: Started after adding investment in USD to INR account
- Expected: Should convert using latest exchange rates
- Actual: Shows raw amounts without conversion
- Impact: Personal account with INR base currency + USD investments

AI can then:
1. Check DEPENDENCY_GRAPH.md "When Fetching Net Worth" section
2. Trace API calls: net-worth → debts → investments → exchange_rates
3. Check convertToBase() in lib/utils.ts
4. Check if rates are being fetched correctly
5. Review exchange_rate_job in services
6. Identify if rates table is empty or stale
```

---

## ⚠️ Critical Rules to Remember

### Backend Rules

1. **Always use dependencies for auth**
   ```python
   current_user: User = Depends(get_current_user)
   account: Account = Depends(get_account_with_permission)
   ```

2. **Never skip permission checks**
   - Without these, users can access each other's data

3. **Always commit database changes**
   ```python
   db.add(new_record)
   db.commit()  # ← Required!
   ```

4. **Handle multi-currency**
   ```python
   total = convertToBase(amount, currency, base_currency, rates)
   ```

### Frontend Rules

1. **Always have "use client" directive**
   - Needed for useState, useEffect, useCallback

2. **Use useCallback for useEffect dependencies**
   ```typescript
   const load = useCallback(async () => { ... }, [accountId]);
   useEffect(() => { load(); }, [load]);
   ```

3. **Always handle errors**
   ```typescript
   try {
     const data = await api.call();
   } catch (err) {
     setError(err.message);
   }
   ```

4. **Include all dependencies in useEffect**
   - Missing dependencies = infinite loops

---

## 🚀 Common Tasks

### Task: "Check if my change will break anything"

**Steps:**
1. Open [DEPENDENCY_GRAPH.md](/home/shiva/kosa/docs/DEPENDENCY_GRAPH.md)
2. Search for the file you're changing
3. Check which files depend on it
4. Verify those files won't break
5. Check if any database migrations needed

**Example:**
- Changing `services/exchange_rate.py`?
- → Used by: `net-worth/page.tsx`, `api/investments.py`
- → Check if rate calculation logic changes
- → Verify net-worth still works correctly

---

### Task: "I need to add a new API endpoint"

**Checklist:**
- [ ] Check ARCHITECTURE_AND_DEPENDENCIES.md "API Layer Structure"
- [ ] Include `get_current_user` dependency
- [ ] Include `get_account_with_permission` dependency (if account-specific)
- [ ] Use Pydantic schema for validation
- [ ] Add docstring with dependencies
- [ ] Include error handling
- [ ] Log mutations
- [ ] Create database migration if needed
- [ ] Add corresponding frontend API call in `lib/api.ts`

---

### Task: "I need to add a new model"

**Checklist:**
- [ ] Define in `models/*.py` with SQLAlchemy
- [ ] Add relationships with proper ForeignKey
- [ ] Add cascade rules
- [ ] Create Pydantic schema in `schemas/*.py`
- [ ] Create database migration: `alembic revision --autogenerate -m "Add ..."`
- [ ] Verify relationships in migration file
- [ ] Test migration: `alembic upgrade head`

---

### Task: "I need to add a scheduled job"

**Checklist:**
- [ ] Create service function in `services/*.py`
- [ ] Make it async (async def)
- [ ] Handle errors gracefully
- [ ] Log important events
- [ ] Register in `app/main.py` scheduler
- [ ] Add to `main.py` lifespan context
- [ ] Test with APScheduler

---

## 🔧 When Something Goes Wrong

### Debugging Strategy

**Problem**: Frontend shows blank page or error
1. Check browser console for errors
2. Check `lib/api.ts` for API response
3. Check backend logs for 401/403/500
4. Use DEPENDENCY_GRAPH.md to trace the flow
5. Verify all dependencies loaded correctly

**Problem**: API returns 403 Forbidden
1. Check authentication: Is JWT token valid?
2. Check authorization: Is user AccountMember?
3. Verify `get_account_with_permission` is working
4. Check if user has correct role (member vs viewer)

**Problem**: Database migration fails
1. Check migration file for syntax errors
2. Try rollback: `alembic downgrade -1`
3. Fix migration
4. Reapply: `alembic upgrade head`
5. Always backup before migrations!

**Problem**: Calculation is wrong
1. Check if multi-currency: Are rates being fetched?
2. Verify `convertToBase()` is being used
3. Check exchange_rate_job is running
4. Verify rates table not empty
5. Look in ARCHITECTURE_AND_DEPENDENCIES.md "Multi-Currency" section

---

## 📚 Document Structure

```
docs/
├── ARCHITECTURE_AND_DEPENDENCIES.md  ← START HERE
│   └── Complete reference + patterns
│
├── DEPENDENCY_GRAPH.md              ← For tracing dependencies
│   └── Data flows + file relationships
│
└── ARCHITECTURE_REFERENCE.md        ← This file
    └── Quick start + common tasks
```

---

## 🎯 Before Coding Anything

**ALWAYS:**

1. **Read relevant section** in [ARCHITECTURE_AND_DEPENDENCIES.md](/home/shiva/kosa/docs/ARCHITECTURE_AND_DEPENDENCIES.md)
2. **Check DEPENDENCY_GRAPH.md** to understand impact
3. **Review the "Implementation Checklist"** in the architecture guide
4. **Look for similar patterns** in existing code
5. **Verify all dependencies** are available

**Then:**

- Implement with confidence
- Follow the patterns
- Handle all edge cases
- Test thoroughly

---

## 💬 Talking to AI About Your Code

### Better Questions:

❌ "Fix the net-worth bug"
✅ "The net-worth page shows wrong total for multi-currency accounts. Expected: convert USD to INR using latest rates. Actual: shows raw USD amount. Check DEPENDENCY_GRAPH.md 'When Fetching Net Worth' section"

❌ "Add recurring debts"
✅ "Add recurring debt payments. Frontend: personal/recurring-debts page. Backend: new endpoint at /api/accounts/{id}/recurring-debts. Service: update debt_engine.py to handle recurrence. Database: add columns to debts table via migration. See ARCHITECTURE_AND_DEPENDENCIES.md 'Create Debt Flow' for pattern."

### Information to Include:

- What component is affected?
- Expected vs actual behavior
- When did it break? (After which change/feature?)
- Multi-currency concern? (Y/N)
- Joint account involved? (Y/N)
- Database changes needed? (Y/N)

---

## 📞 Quick Reference Links

| Need | File |
|---|---|
| System overview | [ARCHITECTURE_AND_DEPENDENCIES.md](/home/shiva/kosa/docs/ARCHITECTURE_AND_DEPENDENCIES.md#1-system-architecture) |
| Data relationships | [ARCHITECTURE_AND_DEPENDENCIES.md](/home/shiva/kosa/docs/ARCHITECTURE_AND_DEPENDENCIES.md#2-data-models--relationships) |
| API routes | [ARCHITECTURE_AND_DEPENDENCIES.md](/home/shiva/kosa/docs/ARCHITECTURE_AND_DEPENDENCIES.md#3-api-layer-structure) |
| Frontend structure | [ARCHITECTURE_AND_DEPENDENCIES.md](/home/shiva/kosa/docs/ARCHITECTURE_AND_DEPENDENCIES.md#4-frontend-architecture) |
| Service dependencies | [ARCHITECTURE_AND_DEPENDENCIES.md](/home/shiva/kosa/docs/ARCHITECTURE_AND_DEPENDENCIES.md#5-service-dependencies) |
| Data flows | [ARCHITECTURE_AND_DEPENDENCIES.md](/home/shiva/kosa/docs/ARCHITECTURE_AND_DEPENDENCIES.md#6-data-flow-patterns) |
| Constraints | [ARCHITECTURE_AND_DEPENDENCIES.md](/home/shiva/kosa/docs/ARCHITECTURE_AND_DEPENDENCIES.md#7-critical-constraints) |
| Pitfalls | [ARCHITECTURE_AND_DEPENDENCIES.md](/home/shiva/kosa/docs/ARCHITECTURE_AND_DEPENDENCIES.md#8-common-pitfalls) |
| Dependency paths | [DEPENDENCY_GRAPH.md](/home/shiva/kosa/docs/DEPENDENCY_GRAPH.md#critical-dependency-paths) |
| File dependencies | [DEPENDENCY_GRAPH.md](/home/shiva/kosa/docs/DEPENDENCY_GRAPH.md#file-to-file-dependencies) |

---

## 🎓 Learning Path

**If you're new to this codebase:**

1. Start: [ARCHITECTURE_AND_DEPENDENCIES.md](/home/shiva/kosa/docs/ARCHITECTURE_AND_DEPENDENCIES.md) Section 1-2 (5 min read)
2. Then: Section 3-4 to understand API and Frontend (10 min)
3. Then: Section 6 to see data flows (5 min)
4. Then: Section 8 to avoid pitfalls (5 min)
5. Finally: [DEPENDENCY_GRAPH.md](/home/shiva/kosa/docs/DEPENDENCY_GRAPH.md) for deep dives

**Total**: ~30 minutes to understand the architecture

**When implementing:**
- Refer back to relevant section
- Use checklist from "Implementation Checklist"
- Follow existing patterns
- Ask AI to verify before coding

---

## ✅ You're Ready!

This architecture reference ensures that:
- ✅ AI assistants understand your codebase structure
- ✅ Changes maintain architectural consistency
- ✅ Dependencies are respected
- ✅ Multi-tenant security is maintained
- ✅ Multi-currency calculations are correct
- ✅ Joint account logic is preserved
- ✅ New features integrate properly

**Questions or changes needed?**
- Update these docs first
- Then implement changes
- Then commit both together

---

**Last Updated**: April 28, 2026 (v-0.1)
**Maintained By**: Development Team
**Status**: Keep in sync with codebase changes
