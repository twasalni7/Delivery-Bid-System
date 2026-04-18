# Workspace

## Overview

**توصّلني** — منصة اشتراكات التوصيل الشهري. تتيح للعملاء نشر طلبات توصيل الدوام الشهري، ويتنافس السائقون بتقديم أفضل العروض، وتُشرف الإدارة على كل شيء. الواجهة بالكامل باللغة العربية مع دعم RTL.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: Supabase PostgreSQL + Drizzle ORM (connection via `SUPABASE_DATABASE_URL` secret — Transaction Pooler on port 6543)
- **Session**: express-session + connect-pg-simple (PostgreSQL-backed, `user_sessions` table, auto-created)
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
- **api-server** (`/api`) — Express backend API (port from `PORT` env)

## Authentication & Roles

### 3 Roles with Real Auth
1. **Client (عميل)** — Register/login with mobile + password (scrypt hash). Create commute requests. Phone number visible only to themselves and to their selected driver after SELECTED status.
2. **Driver (سائق)** — Login with mobile + admin-assigned loginCode. View open requests, submit offers (price, car type, nationality). Minimum 50 SAR balance required to bid. 50 SAR deducted when selected.
3. **Admin (مدير)** — Login with loginCode (default: ADMIN2024). Full CRUD on drivers and requests. Register drivers with auto-generated 8-char alphanumeric codes.

### Phone Privacy Rules
- **Anonymous / non-owner**: Phone field returned as `null`, `phoneHidden: true`
- **Client (own request)**: Full phone visible, `phoneHidden: false`
- **Driver (selected, status = SELECTED/ACTIVE)**: Full phone visible
- **Admin**: Always full phone visible

### Session
- HTTP-only cookie sessions via express-session + connect-pg-simple PostgreSQL store
- `user_sessions` table auto-created via `createTableIfMissing: true`
- SESSION_SECRET env var required (throws on startup if missing)
- Cookie: httpOnly, sameSite lax (dev) / strict+secure (prod), 7-day expiry

## Status Flow

`OPEN` → `BIDDING` (auto on first offer) → `SELECTED` → `ACTIVE` → `COMPLETED`

Admin can also set: `CANCELLED`, `EXPIRED`, `FROZEN`

## DB Schema (Drizzle)

### Tables
- `clients` — (id, name, mobile unique, passwordHash, createdAt)
- `admins` — (id, name, loginCode unique, createdAt)
- `drivers` — (id, name, mobile NOT NULL UNIQUE, loginCode NOT NULL UNIQUE, balance, carType, nationality, age, nationalId, status[ACTIVE/BLOCKED/DELETED], warningCount, deletedAt, createdAt)
- `requests` — (id, clientId FK→clients, homeLocation, workLocation, phone, numberOfPeople, workingDaysPerWeek, morningTime, eveningTime, clientType[EMPLOYEE/STUDENT/OTHER], additionalLocations JSONB, notes TEXT, numberOfShifts INT, status[OPEN/BIDDING/SELECTED/ACTIVE/COMPLETED/CANCELLED/EXPIRED/FROZEN], selectedDriverId FK→drivers, createdAt, updatedAt)
- `offers` — (id, requestId FK→requests, driverId FK→drivers, price, carType, nationality, createdAt)
- `transactions` — (id, driverId FK→drivers, amount, type[CREDIT/DEBIT], createdAt)
- `support_tickets` — (id, clientId FK→clients, driverId FK→drivers, requestId FK→requests, type, message, status[OPEN/IN_PROGRESS/RESOLVED/CLOSED], adminReply TEXT, createdAt, updatedAt)
- `user_sessions` — Session store (auto-managed by connect-pg-simple)

## API Routes

### Auth (`/api/auth`)
Both naming conventions supported (RESTful path + flat alias):
- `POST /auth/client/register` = `POST /auth/register-client` — Register client (name, mobile, password)
- `POST /auth/client/login` = `POST /auth/login-client` — Client login (mobile, password)
- `POST /auth/driver/login` = `POST /auth/login-driver` — Driver login (mobile, loginCode)
- `POST /auth/admin/login` = `POST /auth/login-admin` — Admin login (loginCode)
- `POST /auth/logout` — Logout (destroy session)
- `GET /auth/me` — Current session user

### Requests (`/api/requests`)
- `GET /requests` — List requests (phone null for non-owners)
- `POST /requests` — Create request (requires client auth, clientId from session)
- `GET /requests/:id` — Get request
- `PATCH /requests/:id/status` — Update status (admin only)
- `POST /requests/:id/select-offer` — Select offer (client auth, strict ownership check, deducts 50 SAR)
- `GET /requests/:id/offers` — List offers for request (driver mobile revealed to owner+admin after selection)

### Drivers (`/api/drivers`)
- `GET /drivers` — List active drivers (public, no mobile/loginCode)
- `GET /drivers/me` — Driver profile (driver auth)
- `GET /drivers/:id` — Get driver
- `PATCH /drivers/:id/balance` — Add balance (admin only)
- `GET /drivers/:id/transactions` — Transaction history

### Offers (`/api/offers`)
- `GET /offers` — All offers with driver mobile (admin auth required)
- `POST /offers` — Create offer (driver auth, balance ≥ 50 SAR required)

### Admin (`/api/admin`) — All require admin auth
- `GET /admin/stats` — Platform statistics
- `GET /admin/analytics?months=3|6|12` — Analytics data: monthly request volume (default 12 months, filterable), offer acceptance rate, top drivers by accepted bids
- `GET /admin/drivers` — All drivers with full details
- `POST /admin/drivers` — Register driver (auto-generates 8-char loginCode)
- `GET /admin/drivers/:id` — Driver full details
- `PATCH /admin/drivers/:id` — Update driver info
- `DELETE /admin/drivers/:id` — Soft-delete driver (status=DELETED, sets deletedAt)
- `POST /admin/drivers/:id/block` — Block driver
- `POST /admin/drivers/:id/unblock` — Unblock driver
- `POST /admin/drivers/:id/warn` — Add warning (+1 warningCount)
- `POST /admin/drivers/:id/restore` — Restore deleted driver
- `POST /admin/drivers/:id/regenerate-code` — Regenerate loginCode
- `PATCH /admin/drivers/:id/balance` — Set/add driver balance
- `GET /admin/clients` — List all clients
- `GET /admin/requests` — List all requests (full phone)
- `PATCH /admin/requests/:id` — Update request status or reassign selectedDriverId
- `DELETE /admin/requests/:id` — Delete request

### Support Tickets (`/api/support-tickets`)
- `GET /support-tickets` — Client: list own tickets; Admin: list all tickets
- `POST /support-tickets` — Client: create ticket (type, message, requestId optional)
- `PATCH /support-tickets/:id/reply` — Admin: reply to ticket
- `PATCH /support-tickets/:id/status` — Admin: update ticket status
- `DELETE /support-tickets/:id` — Admin: delete ticket

## Frontend Pages

### Client Role (`/client/*`)
- `/client` — Dashboard (طلباتي) — list requests with status badges + unread offer notifications
- `/client/request/new` — Create request wizard (clientType, locations, times, notes, shifts)
- `/client/request/:id` — Request detail + offer list + select offer
- `/client/profile` — Client profile
- `/client/support` — Support tickets (create + view replies)

### Driver Role (`/driver/*`)
- `/driver/dashboard` — Available requests (OPEN + BIDDING) + my offers + selected jobs
- `/driver/request/:id/offer` — Submit/view offer
- `/driver/profile` — Driver profile

### Admin Role (`/admin/*`)
- `/admin` — Dashboard with stats/analytics
- `/admin/requests` — All requests with status filter + edit/delete
- `/admin/drivers` — Driver CRUD
- `/admin/offers` — All offers
- `/admin/clients` — Client list
- `/admin/settings` — Admin settings
- `/admin/support` — Support ticket management (reply, change status, delete)

## Important Notes

- After running codegen, `lib/api-zod/src/index.ts` must be manually set to `export * from "./generated/api";` only — orval overwrites it with a broken dual-export
- Default admin loginCode: `ADMIN2024` (seeded on first run via SQL)
- Driver loginCode format: 8 uppercase alphanumeric chars (e.g. `D6RM8GMW`)
- 50 SAR deducted from driver balance when client selects their offer
- Soft-delete for drivers: sets status=DELETED and deletedAt timestamp
- IDOR protection: `select-offer` requires `clientId == request.clientId` (null-owner requests are blocked)
- Codegen command: `pnpm --filter @workspace/api-spec codegen`
