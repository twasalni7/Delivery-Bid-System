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
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React + Vite + Tailwind CSS (shadcn/ui components)
- **Routing**: Wouter (client-side)
- **Font**: Cairo (Arabic-optimized)
- **Direction**: RTL (Right-to-Left)

## Artifacts

- **delivery-bidding** (`/`) — Main React + Vite frontend app (Arabic/RTL)
- **api-server** (`/api`) — Express backend API

## Key Features

### 3 Roles
1. **Client (عميل)** — Create commute requests with: homeLocation, workLocation, phone, numberOfPeople, workingDaysPerWeek, morningTime, eveningTime. View offers per request, select a driver.
2. **Driver (سائق)** — Login by name (auto-register). View open requests, submit offers (price, car type, nationality). Minimum 50 SAR balance required to bid. 50 SAR deducted when selected.
3. **Admin (مدير)** — View platform stats, manage all requests (change status), manage driver balances, view all offers.

### Status Flow
`OPEN (مفتوح)` → `SELECTED (تم الاختيار)` → `ACTIVE (نشط)` → `COMPLETED (مكتمل)`

### Business Logic
- When client selects an offer: request status → SELECTED, selectedDriverId set, driver balance −50 SAR
- Admin can manually change request status to any value
- Driver cannot bid if balance < 50 SAR

## DB Schema (Drizzle)

### Tables
- `requests_table` — CommuteRequest (homeLocation, workLocation, phone, numberOfPeople, workingDaysPerWeek, morningTime, eveningTime, status, selectedDriverId)
- `drivers_table` — Driver (name, balance, carType, nationality)
- `offers_table` — Offer (requestId, driverId, price, carType, nationality)
- `transactions_table` — Transaction (driverId, amount, type)

## API Routes

- `GET/POST /api/requests` — List/create commute requests
- `GET /api/requests/:id` — Get single request
- `PATCH /api/requests/:id/status` — Update status (admin)
- `POST /api/requests/:id/select-offer` — Select an offer (deducts 50 SAR)
- `GET /api/requests/:id/offers` — List offers for a request
- `POST /api/drivers/login` — Login/register driver by name
- `GET /api/drivers` — List all drivers
- `GET /api/drivers/:id` — Get single driver
- `PATCH /api/drivers/:id/balance` — Add balance (admin)
- `GET /api/drivers/:id/transactions` — Driver transaction history
- `POST /api/offers` — Create offer
- `GET /api/offers` — List all offers (admin)
- `GET /api/admin/stats` — Platform statistics

## Frontend Pages

- `/` — Home (role selection cards in Arabic)
- `/client` — Client Dashboard (table of commute requests)
- `/client/request/new` — Create Request form
- `/client/request/:id` — Request Details + offers table + select driver
- `/driver` — Driver Login
- `/driver/dashboard` — Driver Dashboard (open requests table)
- `/driver/request/:id` — Submit Offer form
- `/admin` — Admin Dashboard (stats)
- `/admin/requests` — Manage Requests (filter + status change)
- `/admin/drivers` — Manage Drivers (add balance dialog)
- `/admin/offers` — All Offers table

## Design

- **Theme**: Industrial Yellow (HSL 45 93% 47%) primary color
- **Corners**: Sharp (radius 0.1rem)
- **Font**: Cairo (Arabic Google Font)
- **Direction**: RTL throughout (html[dir="rtl"], lang="ar")

## Important Notes

- After running codegen, `lib/api-zod/src/index.ts` must be manually set to `export * from "./generated/api";` only — orval regenerates it with conflicting exports
- Driver session stored in localStorage key: `swiftbid_driver_id`
- No authentication — client portal is open access, admin is open, driver uses name-based login
