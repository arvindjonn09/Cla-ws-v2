# README - Financial Command Center (Kosa)

**Version**: v-0.1  
**Last Updated**: April 28, 2026  
**Status**: Active Development

---

## 📱 About Kosa

**Kosa** is a Financial Rehabilitation and Elevation System - not a budgeting app. It's designed to take users on a 9-stage journey from debt to financial independence.

### Core Concept
- **Freedom Date**: The exact date you become completely debt-free
- **Journey**: Debt → Savings → Investments → Financial Independence
- **Features**: Debt tracking, goal planning, investment portfolio, joint account management, multi-currency support

---

## 🎯 The 9-Stage Journey

| Stage | Name | Goal |
|-------|------|------|
| 1 | Know Your Numbers | Understand income, expenses, total debt |
| 2 | Stop The Bleeding | Identify and cut spending leaks |
| 3 | Clear Small Debts | First wins with snowball/avalanche |
| 4 | Emergency Fund | Build 3-month safety net |
| 5 | Clear Large Debts | Attack biggest debts |
| 6 | Save Consistently | Monthly savings habit |
| 7 | Begin Investing | Local investments |
| 8 | Foreign Investments | Multi-currency portfolio |
| 9 | Financial Independence | Passive income covers expenses |

---

## 🏗️ Tech Stack

### Backend
- **Language**: Python 3.12+
- **Framework**: FastAPI
- **Database**: PostgreSQL 16
- **ORM**: SQLAlchemy 2.0
- **Task Scheduler**: APScheduler
- **Migration Tool**: Alembic

### Frontend
- **Framework**: Next.js 15
- **Language**: TypeScript 5+
- **Styling**: Tailwind CSS 4
- **State Management**: React Hooks + localStorage

### Infrastructure
- **Server**: Ubuntu 24.04 LTS (VMware)
- **Email**: Zoho SMTP
- **Tunnel**: Cloudflare Tunnel (Free tier)
- **Process Manager**: systemd
- **Mobile**: Capacitor (future)

---

## 📂 Project Structure

```
kosa/
├── backend/
│   ├── app/
│   │   ├── api/           # API endpoints
│   │   ├── core/          # Config, security, database
│   │   ├── models/        # SQLAlchemy ORM models
│   │   ├── schemas/       # Pydantic validation
│   │   ├── services/      # Business logic
│   │   └── main.py        # FastAPI app + scheduler
│   ├── alembic/           # Database migrations
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── app/           # Next.js routes
│   │   │   ├── (auth)/    # Public auth routes
│   │   │   ├── (personal)/# Protected personal routes
│   │   │   └── (joint)/   # Protected joint account routes
│   │   ├── components/    # Reusable components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── lib/           # Utilities (api, helpers)
│   │   └── types/         # TypeScript interfaces
│   └── package.json
│
├── database/
│   ├── schema.sql         # Database schema
│   └── seeds/             # Initial data
│
├── docs/
│   ├── ARCHITECTURE_AND_DEPENDENCIES.md  # Complete reference
│   ├── DEPENDENCY_GRAPH.md               # Data flow & dependencies
│   ├── ARCHITECTURE_REFERENCE.md         # Quick start guide
│   └── FCC_ARCHITECTURE.md               # Original design doc
│
├── scripts/
│   ├── start.sh           # Start services
│   ├── restart.sh         # Restart services
│   ├── backup.sh          # Database backup
│   └── watchdog.py        # Health check
│
└── deploy/
    └── systemd/           # Service files
```

---

## 🚀 Getting Started

### Prerequisites
- Python 3.12+
- Node.js 18+
- PostgreSQL 16
- npm/yarn

### Backend Setup

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Run migrations
alembic upgrade head

# Start server
uvicorn app.main:app --reload
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

### Database Setup

```bash
# Start PostgreSQL
sudo systemctl start postgresql

# Create database
createdb kosa

# Run initial schema
psql kosa < database/schema.sql

# Run migrations
cd backend && alembic upgrade head
```

---

## 📚 Documentation

**Start here for understanding the architecture:**

1. **[ARCHITECTURE_REFERENCE.md](docs/ARCHITECTURE_REFERENCE.md)** - Quick start (15 min read)
   - Where to find what
   - How to ask for help
   - Common tasks with checklists

2. **[ARCHITECTURE_AND_DEPENDENCIES.md](docs/ARCHITECTURE_AND_DEPENDENCIES.md)** - Complete reference (30 min read)
   - System architecture diagram
   - Data models & relationships
   - API layer structure
   - Service dependencies
   - Data flow patterns
   - Critical constraints
   - Common pitfalls
   - Implementation checklist

3. **[DEPENDENCY_GRAPH.md](docs/DEPENDENCY_GRAPH.md)** - Data flow visualization (20 min read)
   - Module dependency tree
   - Critical dependency paths
   - File-to-file relationships
   - Performance analysis
   - Testing strategy

---

## 🔑 Key Features

### Personal Accounts
- ✅ Debt tracking (multiple types: CC, loans, mortgages, etc.)
- ✅ Freedom date calculation
- ✅ Investment portfolio tracking
- ✅ Goal planning with progress
- ✅ Transaction history
- ✅ Multi-currency support
- ✅ Net worth dashboard
- ✅ Financial forecasting
- ✅ Annual reviews

### Joint Accounts
- ✅ Invite members to shared finances
- ✅ Shared debt tracking
- ✅ Settlement tracking (who owes whom)
- ✅ Spending boundaries per member
- ✅ Shared goals and investments
- ✅ War room for joint planning
- ✅ Safe space for notes
- ✅ Account exit process

### Background Services
- ✅ Daily exchange rate updates
- ✅ Email notifications queue
- ✅ Debt reminders
- ✅ Health monitoring

---

## 🔐 Security

- **JWT Authentication**: 15-minute expiry, 7-day refresh tokens
- **Password**: BCrypt hashing with salt
- **Multi-tenant**: Account-based data isolation
- **Authorization**: Role-based (member/viewer) per account
- **SSL**: Enabled for database connections
- **CORS**: Configured for frontend domain
- **Email**: Encrypted credentials in environment

---

## 📊 API Endpoints

### Authentication
```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/verify
POST   /api/auth/refresh
POST   /api/auth/forgot-password
POST   /api/auth/reset-password
```

### Accounts
```
GET    /api/accounts
POST   /api/accounts
GET    /api/accounts/{id}
PATCH  /api/accounts/{id}
```

### Financial Data (per account)
```
GET/POST /api/accounts/{id}/debts
GET/POST /api/accounts/{id}/investments
GET/POST /api/accounts/{id}/transactions
GET/POST /api/accounts/{id}/goals
```

### Joint Accounts
```
POST   /api/joint/members
POST   /api/joint/payments
POST   /api/joint/boundaries
GET    /api/joint/scenarios
```

### Utilities
```
GET    /api/exchange-rates
POST   /api/import_pdf
```

Full documentation: See [DEPENDENCY_GRAPH.md](docs/DEPENDENCY_GRAPH.md#api_endpoints)

---

## 🎛️ Configuration

### Environment Variables (.env)

**Backend:**
```env
# Database
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/kosa

# API
API_SECRET_KEY=your-secret-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15

# Exchange Rates
EXCHANGE_RATE_FETCH_HOUR_IST=9
EXCHANGE_RATE_FETCH_MINUTE_IST=0
EXCHANGE_RATE_API_KEY=your-api-key

# Email (Zoho)
ZOHO_SMTP_SERVER=smtp.zoho.com
ZOHO_SMTP_PORT=587
ZOHO_SMTP_USERNAME=your-email@zoho.com
ZOHO_SMTP_PASSWORD=your-password

# JWT
JWT_SECRET=your-jwt-secret
```

**Frontend:**
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_APP_NAME=Kosa
NEXT_PUBLIC_APP_DESCRIPTION=Financial Rehabilitation System
```

---

## 🔄 Database Migrations

```bash
# Create new migration (auto-generate)
alembic revision --autogenerate -m "Description of changes"

# Apply migrations
alembic upgrade head

# Rollback one migration
alembic downgrade -1

# View migration history
alembic history
```

---

## 📈 Background Jobs (APScheduler)

| Job | Schedule | Purpose |
|---|---|---|
| Exchange Rate Fetch | Daily 09:00 IST | Update currency rates |
| Email Queue Processor | Every 15 seconds | Send pending notifications |
| Debt Reminder Job | Daily (configurable) | Remind users of due payments |
| Health Check | Every 5 minutes | Monitor system status |

---

## 🧪 Testing

```bash
# Backend tests (when set up)
cd backend && pytest

# Frontend tests (when set up)
cd frontend && npm test

# E2E tests (when set up)
npm run test:e2e
```

---

## 📝 Deployment

### Using systemd

```bash
# Copy service files
sudo cp deploy/systemd/*.service /etc/systemd/system/

# Enable services
sudo systemctl enable kosa-backend kosa-frontend

# Start services
sudo systemctl start kosa-backend kosa-frontend

# Check status
sudo systemctl status kosa-backend kosa-frontend
```

### Using Scripts

```bash
# Start all services
./scripts/start.sh

# Restart services
./scripts/restart.sh

# Backup database
./scripts/backup.sh
```

---

## 🐛 Troubleshooting

### Backend won't start
```bash
# Check logs
journalctl -u kosa-backend -n 50

# Verify database connection
psql kosa -c "SELECT 1"

# Check if port 8000 is in use
lsof -i :8000
```

### Frontend won't connect
```bash
# Check API URL in .env.local
echo $NEXT_PUBLIC_API_URL

# Test API connectivity
curl http://localhost:8000/health

# Check browser console for CORS errors
```

### Database migration failed
```bash
# Check migration status
alembic current

# Rollback
alembic downgrade -1

# Review migration file
cat alembic/versions/XXXX_*.py
```

---

## 🔗 Important Links

- **GitHub**: https://github.com/arvindjonn09/Cla-ws-v2
- **Architecture Docs**: [See docs/ folder](docs/)
- **Issue Tracker**: [GitHub Issues](https://github.com/arvindjonn09/Cla-ws-v2/issues)

---

## 👥 Contributing

When contributing:

1. **Read documentation first**
   - [ARCHITECTURE_REFERENCE.md](docs/ARCHITECTURE_REFERENCE.md)
   - [ARCHITECTURE_AND_DEPENDENCIES.md](docs/ARCHITECTURE_AND_DEPENDENCIES.md)

2. **Follow patterns**
   - Backend: See service patterns in `app/services/`
   - Frontend: See page patterns in `src/app/(personal)/`

3. **Update docs with code**
   ```bash
   # When you add a new feature:
   git add app/ frontend/ alembic/  # Your code
   git add docs/                     # Updated docs
   git commit -m "Feature: [name]"
   git push origin main
   ```

4. **Test thoroughly**
   - Backend: Manual API testing
   - Frontend: Browser testing
   - Database: Verify migrations work

---

## 📋 Checklist Before Pushing

- [ ] Code follows existing patterns
- [ ] Documentation updated (if applicable)
- [ ] No security issues introduced
- [ ] Database migrations tested
- [ ] API endpoints working
- [ ] Frontend pages rendering
- [ ] Multi-currency handling correct
- [ ] Error handling in place
- [ ] Git commit message descriptive
- [ ] Tests passing

---

## 📞 Support

For issues or questions:
1. Check [ARCHITECTURE_REFERENCE.md](docs/ARCHITECTURE_REFERENCE.md)
2. Search [GitHub Issues](https://github.com/arvindjonn09/Cla-ws-v2/issues)
3. Review relevant documentation section
4. Open a new issue with details

---

## 📄 License

See [LICENSE](LICENSE) file

---

**Last Updated**: April 28, 2026  
**Version**: v-0.1  
**Maintained By**: Development Team
