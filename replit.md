# Workspace

## Overview

Full-stack delivery bidding system (SwiftBid) — a logistics marketplace where clients post delivery jobs, drivers bid competitively, and admins manage everything.

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

## Artifacts

- **delivery-bidding** (`/`) — Main React + Vite frontend app
- **api-server** (`/api`) — Express backend API

## Key Features

### 3 Roles
1. **Client** — Create delivery requests (pickup, dropoff, phone), view offers per request, select a driver
2. **Driver** — Login by name, view open requests, submit offers (price, car type, nationality). Minimum $50 balance required to bid. $50 deducted when selected.
3. **Admin** — Dashboard stats, manage all requests/drivers/offers, change statuses, add driver balance

### Status Flow
`OPEN → SELECTED → ACTIVE → COMPLETED`

## Database Schema (PostgreSQL)
- `drivers` — id, name, balance, car_type, nationality, created_at
- `requests` — id, pickup, dropoff, phone, status (enum), selected_driver_id, created_at
- `offers` — id, driver_id, request_id, price, car_type, nationality, created_at
- `transactions` — id, driver_id, amount, type, created_at

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec (Note: fix lib/api-zod/src/index.ts to `export * from "./generated/api";` after running codegen)
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Important Notes
- After running codegen, manually update `lib/api-zod/src/index.ts` to only contain `export * from "./generated/api";` (orval regenerates it with extra exports that cause conflicts)
- Driver session stored in localStorage (key: `swiftbid_driver_id`)
- No authentication — client portal is open, admin portal is open, driver portal uses name-based login

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
