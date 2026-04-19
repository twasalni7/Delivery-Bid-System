# Deployment Guide for Delivery Bid System

## Deploying to Vercel (Frontend + API)

This project deploys **both** the React frontend and the Express API to Vercel.  
The React app is served as a static site and the Express API runs as a Vercel Serverless Function.

### Step-by-step

1. **Create a Vercel Account** — Sign up at [vercel.com](https://vercel.com) if you haven't already.

2. **Import Project** — Click **New Project** → import the `twasalni7/Delivery-Bid-System` GitHub repository.

3. **Leave build settings at their defaults** — the `vercel.json` in the repo already configures:
   - Install command: `pnpm install --no-frozen-lockfile`
   - Build command: `BASE_PATH=/ pnpm run build`
   - Output directory: `artifacts/delivery-bidding/dist/public`

4. **Set Environment Variables** — go to **Project → Settings → Environment Variables** and add:

   | Variable | Description | Example |
   |---|---|---|
   | `SUPABASE_DATABASE_URL` | Supabase Transaction Pooler connection string (port **6543**) | `postgresql://postgres:[password]@db.[ref].supabase.co:6543/postgres` |
   | `SESSION_SECRET` | A long random secret for signing session cookies | `openssl rand -hex 32` output |
   | `NODE_ENV` | Set to `production` | `production` |

   > **Where to find `SUPABASE_DATABASE_URL`:**  
   > Supabase dashboard → your project → **Connect** → **Transaction Pooler** → copy the connection string.  
   > Replace `[YOUR-PASSWORD]` with your database password.

5. **Deploy** — click **Deploy**. Vercel will build and deploy the project.

6. **Re-deploy when schema changes** — if you add new Supabase tables, run `node scripts/apply-rls.mjs` locally (with `SUPABASE_DATABASE_URL` set) then re-deploy.

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
- **500 errors on API routes** — make sure `SUPABASE_DATABASE_URL` and `SESSION_SECRET` are set in Vercel env vars.
- **Sessions not persisting** — the session store uses the Supabase PostgreSQL database (`user_sessions` table). Make sure the database is reachable and `SUPABASE_DATABASE_URL` is correct.
- **React routes show 404 on refresh** — the `vercel.json` includes a catch-all rewrite to `index.html`, which fixes this automatically.
