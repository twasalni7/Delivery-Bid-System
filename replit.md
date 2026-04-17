# Workspace

## Overview

نظام دوامات شهرية (Monthly Commute Bidding System) — منصة تتيح للعملاء نشر طلبات توصيل الدوام الشهري، ويتنافس السائقون بتقديم أفضل العروض، وتُشرف الإدارة على كل شيء. الواجهة بالكامل باللغة العربية مع دعم RTL.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Session**: express-session (MemoryStore)
- **Password hashing**: Node.js crypto (scrypt)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec → lib/api-zod/src/generated/api.ts)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + Tailwind CSS (shadcn/ui components)
- **Routing**: Wouter (client-side)
- **Font**: Cairo (Arabic-optimized)
- **Direction**: RTL (Right-to-Left)

## Artifacts

- **delivery-bidding** (`/`) — Main React + Vite frontend app (Arabic/RTL)
- **api-server** (`/api`) — Express backend API

## Authentication & Roles

### 3 Roles with Real Auth
1. **Client (عميل)** — Register/login with mobile + password. Create commute requests via step-by-step wizard. Phone number visible only to themselves (and selected driver after SELECTED status).
2. **Driver (سائق)** — Login with mobile + admin-assigned loginCode. View open requests, submit offers (price, car type, nationality). Minimum 50 SAR balance required to bid. 50 SAR deducted when selected. Can see client phone only AFTER being selected.
3. **Admin (مدير)** — Login with loginCode (default: ADMIN2024). Full CRUD on drivers and requests. Register drivers with auto-generated 8-char alphanumeric codes.

### Phone Privacy Rules
- **Anonymous**: Phone masked (e.g. `"******4567"`)
- **Client (own request)**: Full phone visible
- **Driver (not selected)**: Phone masked
- **Driver (selected, status = SELECTED/ACTIVE)**: Full phone visible
- **Admin**: Always full phone visible

### Session
- HTTP-only cookie sessions via express-session MemoryStore
- SESSION_SECRET env var (default: dev fallback)

## Status Flow

`OPEN (مفتوح)` → `SELECTED (تم الاختيار)` → `ACTIVE (نشط)` → `COMPLETED (مكتمل)`

## DB Schema (Drizzle)

### Tables
- `clients` — Client (id, name, mobile unique, passwordHash, createdAt)
- `admins` — Admin (id, name, loginCode unique, createdAt)
- `drivers` — Driver (id, name, mobile, loginCode, balance, carType, nationality, age, nationalId, status[ACTIVE/BLOCKED/DELETED], warningCount, deletedAt, createdAt)
- `requests` — CommuteRequest (id, clientId FK→clients, homeLocation, workLocation, phone, numberOfPeople, workingDaysPerWeek, morningTime, eveningTime, status, selectedDriverId FK→drivers, createdAt)
- `offers` — Offer (requestId FK→requests, driverId FK→drivers, price, carType, nationality)
- `transactions` — Transaction (driverId FK→drivers, amount, type[CREDIT/DEBIT])

## API Routes

### Auth (`/api/auth`)
- `POST /auth/client/register` — Register client (name, mobile, password)
- `POST /auth/client/login` — Client login (mobile, password)
- `POST /auth/driver/login` — Driver login (mobile, loginCode)
- `POST /auth/admin/login` — Admin login (loginCode)
- `POST /auth/logout` — Logout
- `GET /auth/me` — Current session user

### Requests (`/api/requests`)
- `GET /requests` — List requests (phone masked by role)
- `POST /requests` — Create request (requires client auth, clientId from session)
- `GET /requests/:id` — Get request
- `PATCH /requests/:id/status` — Update status (admin only)
- `POST /requests/:id/select-offer` — Select offer (client auth, owns request, deducts 50 SAR)
- `GET /requests/:id/offers` — List offers for request

### Drivers (`/api/drivers`)
- `GET /drivers` — List active drivers (public, no mobile/loginCode)
- `GET /drivers/me` — Driver profile (driver auth)
- `GET /drivers/:id` — Get driver
- `PATCH /drivers/:id/balance` — Add balance (admin only)
- `GET /drivers/:id/transactions` — Transaction history

### Offers (`/api/offers`)
- `GET /offers` — All offers (admin)
- `POST /offers` — Create offer (driver auth, driverId from session)

### Admin (`/api/admin`) — All require admin auth
- `GET /admin/stats` — Platform statistics
- `GET /admin/drivers` — All drivers with full details
- `POST /admin/drivers` — Register driver (auto-generates loginCode)
- `GET /admin/drivers/:id` — Driver full details
- `PATCH /admin/drivers/:id` — Update driver info
- `DELETE /admin/drivers/:id` — Soft-delete driver
- `POST /admin/drivers/:id/block` — Block driver
- `POST /admin/drivers/:id/unblock` — Unblock driver
- `POST /admin/drivers/:id/warn` — Add warning (+1 warningCount)
- `POST /admin/drivers/:id/regenerate-code` — Regenerate loginCode
- `GET /admin/clients` — List all clients
- `GET /admin/requests` — List all requests (full phone)
- `DELETE /admin/requests/:id` — Delete request

## Frontend Pages (TO BE REDESIGNED — Task #2)

Current state (pre-redesign):
- Home page, client dashboard, driver dashboard, admin dashboard
- Needs: blue/red theme, mobile-first, role portals with proper auth flows

## Design Targets (Task #2)

- **Theme**: Blue (#1D4ED8) + Red (#DC2626) + White + Black
- **Font**: Cairo (Arabic, RTL)
- **Mobile-first** responsive design
- Client portal: step-by-step request wizard
- Driver portal: login with mobile+code, bid on jobs
- Admin portal: full dashboard with driver CRUD, request management

## Important Notes

- After running codegen, `lib/api-zod/src/index.ts` must be manually set to `export * from "./generated/api";` only — orval regenerates it with conflicting exports
- Default admin loginCode: `ADMIN2024` (seeded on first run)
- Driver loginCode format: 8 uppercase alphanumeric chars (e.g. `D6RM8GMW`)
- 50 SAR deducted from driver balance when client selects their offer
- Soft-delete for drivers: sets status=DELETED and deletedAt timestamp
