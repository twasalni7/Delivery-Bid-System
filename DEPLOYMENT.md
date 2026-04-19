# Deployment Guide for Delivery Bid System

## Deploying to Vercel (Frontend + API)

This project deploys **both** the React frontend and the Express API to Vercel.  
The React app is served as a static site and the Express API runs as a Vercel Serverless Function.

### Step-by-step

1. **Create a Vercel Account** — Sign up at [vercel.com](https://vercel.com) if you haven't already.

2. **Import Project** — Click **New Project** → import the `twasalni7/Delivery-Bid-System` GitHub repository.

3. **Deploy from the repository root** — set the Vercel **Root Directory** to the project root (`/home/runner/work/Delivery-Bid-System/Delivery-Bid-System` in this checkout), **not** `artifacts/delivery-bidding`.

4. **Leave build settings at their defaults** — the `vercel.json` in the repo root already configures:
   - Install command: `pnpm install --no-frozen-lockfile`
   - Build command: `pnpm --filter @workspace/api-server run build && BASE_PATH=/ pnpm --filter @workspace/delivery-bidding run build`
   - Output directory: `artifacts/delivery-bidding/dist/public`

   > **Important:** this repository is **not** deployed to Vercel as an API-only Express app.  
   > It is a **hybrid deployment**:
   > - React frontend → static files in `artifacts/delivery-bidding/dist/public`
   > - Express API → serverless function at `api/index.mjs`
   >
   > Do **not** replace the root `vercel.json` with an API-only config inside `artifacts/api-server`, and do **not** change the Vercel Root Directory to `artifacts/api-server` unless you intentionally want to deploy the API by itself on another platform.

5. **Set Environment Variables** — go to **Project → Settings → Environment Variables** and add:

   | Variable | Description | Example |
   |---|---|---|
   | `SUPABASE_DATABASE_URL` | Supabase Transaction Pooler connection string (port **6543**) | `postgresql://postgres:[password]@db.[ref].supabase.co:6543/postgres` |
   | `SESSION_SECRET` | A long random secret for signing session cookies | `openssl rand -hex 32` output |
   | `NODE_ENV` | Set to `production` | `production` |

   > **Where to find `SUPABASE_DATABASE_URL`:**  
   > Supabase dashboard → your project → **Connect** → **Transaction Pooler** → copy the connection string.  
   > Replace `[YOUR-PASSWORD]` with your database password.

6. **Deploy** — click **Deploy**. Vercel will build and deploy the project.

7. **Re-deploy when schema changes** — if you add new Supabase tables, run `node scripts/apply-rls.mjs` locally (with `SUPABASE_DATABASE_URL` set) then re-deploy.

---

## Deploying to Render (API only)

If you prefer to host the API separately on Render:

1. Sign up at [render.com](https://render.com).
2. Click **New → Web Service** and connect the GitHub repository.
3. Render picks up the `render.yaml` configuration automatically.
4. Add the same environment variables in the Render dashboard:
   - `SUPABASE_DATABASE_URL`
   - `SESSION_SECRET`
   - `NODE_ENV` = `production`
5. Click **Create Web Service**.

---

## Supabase Database Setup

1. Create a Supabase project at [supabase.com](https://supabase.com).
2. Run the Drizzle migration to create all tables:
   ```
   SUPABASE_DATABASE_URL="postgresql://..." pnpm --filter @workspace/db run push
   ```
3. Apply Row Level Security policies:
   ```
   SUPABASE_DATABASE_URL="postgresql://..." node scripts/apply-rls.mjs
   ```
4. Seed the default admin account (`ADMIN2024` login code):
   ```
   SUPABASE_DATABASE_URL="postgresql://..." pnpm --filter @workspace/db run seed
   ```

---

## Common Issues

- **Build fails with "PORT is required"** — this is fixed; `PORT` and `BASE_PATH` are now optional during the Vercel build.
- **Vercel says `No Output Directory named "public" found`** — this usually means Vercel was pointed at the wrong **Root Directory** or the build/output settings were overridden in the dashboard. The expected frontend output is `artifacts/delivery-bidding/dist/public`, generated only when the repo-root build runs.
- **Vercel says it cannot find the entrypoint in the output directory** — for this repo, the API entrypoint is the generated repo-root file `api/index.mjs`, not `src/index.js` inside `artifacts/api-server`. If Vercel is looking for a file inside `artifacts/api-server`, the project was configured as API-only by mistake.
- **500 errors on API routes** — make sure `SUPABASE_DATABASE_URL` and `SESSION_SECRET` are set in Vercel env vars.
- **Sessions not persisting** — the session store uses the Supabase PostgreSQL database (`user_sessions` table). Make sure the database is reachable and `SUPABASE_DATABASE_URL` is correct.
- **React routes show 404 on refresh** — the `vercel.json` includes a catch-all rewrite to `index.html`, which fixes this automatically.
- **Build keeps failing in Vercel** — double-check that the **Root Directory** is the repository root and that you did not override the install/build/output settings from `vercel.json`.
- **Someone suggested adding `artifacts/api-server/vercel.json` with `@vercel/node`** — that advice does **not** match this repository's checked-in deployment model. Keep the existing root `vercel.json` for Vercel, and use Render if you want an API-only deployment target.
- **Supabase connection fails in production** — use the **Transaction Pooler** connection string on port **6543** for `SUPABASE_DATABASE_URL`.
- **Deployment succeeds but the app returns 500** — this usually means `SUPABASE_DATABASE_URL`, `SESSION_SECRET`, or `NODE_ENV=production` is missing or incorrect.
