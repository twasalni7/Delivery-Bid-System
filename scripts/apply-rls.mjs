/**
 * RLS Security Script for توصّلني
 * 
 * Run this whenever you add a new table or need to re-apply security policies.
 * Usage: node scripts/apply-rls.mjs
 * 
 * Architecture:
 *   - Express backend connects as postgres (superuser) → bypasses RLS automatically
 *   - No Supabase Auth used → auth.uid() is always NULL
 *   - Frontend never touches Supabase directly (only via Express API)
 * 
 * Security model:
 *   1. RLS enabled on all tables → blocks any direct Supabase REST API access
 *   2. anon + authenticated roles have ZERO table privileges → blocked at GRANT level too
 *   3. postgres/service_role bypass RLS → backend works fine
 *   4. All business logic enforced in Express middleware (requireAuth, IDOR checks)
 */

import pg from 'pg';
const { Pool } = pg;

const TABLES = [
  'admins',
  'clients',
  'drivers',
  'requests',
  'offers',
  'transactions',
  'support_tickets',
  'notifications',
  'user_sessions',
];

async function applyRLS() {
  const pool = new Pool({
    connectionString: process.env.SUPABASE_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    console.log('🔒 Applying RLS security policies to Supabase...\n');

    // Step 1: Enable RLS on all tables
    console.log('Step 1: Enabling RLS on all tables...');
    for (const table of TABLES) {
      await pool.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`);
      console.log(`  ✓ ${table}`);
    }

    // Step 2: Drop existing policies (clean slate)
    console.log('\nStep 2: Cleaning old policies...');
    await pool.query(`
      DO $$ 
      DECLARE pol RECORD;
      BEGIN
        FOR pol IN 
          SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public'
        LOOP
          EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
        END LOOP;
      END $$;
    `);
    console.log('  ✓ Old policies removed');

    // Step 3: Create service_role bypass policies for each table
    console.log('\nStep 3: Creating service_role bypass policies...');
    for (const table of TABLES) {
      await pool.query(`
        CREATE POLICY ${table}_service_role_all
          ON ${table} FOR ALL
          TO postgres, service_role
          USING (true) WITH CHECK (true);
      `);
      console.log(`  ✓ ${table}`);
    }

    // Step 4: Revoke all privileges from anon and authenticated
    console.log('\nStep 4: Revoking anon/authenticated privileges...');
    for (const table of TABLES) {
      await pool.query(`REVOKE ALL PRIVILEGES ON TABLE ${table} FROM anon, authenticated;`);
      console.log(`  ✓ ${table}`);
    }

    // Verify
    console.log('\n📊 Verification:');
    const rls = await pool.query(`
      SELECT tablename, rowsecurity as rls_enabled
      FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
    `);
    rls.rows.forEach(r => {
      const status = r.rls_enabled ? '🟢 ENABLED' : '🔴 DISABLED';
      console.log(`  ${status}  ${r.tablename}`);
    });

    const grants = await pool.query(`
      SELECT COUNT(*) as cnt FROM information_schema.role_table_grants
      WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated')
    `);
    console.log(`\n  anon/authenticated grants: ${grants.rows[0].cnt} (should be 0)`);

    const policies = await pool.query(`
      SELECT COUNT(*) as cnt FROM pg_policies WHERE schemaname = 'public'
    `);
    console.log(`  Active policies: ${policies.rows[0].cnt}`);

    console.log('\n✅ RLS security applied successfully!');
  } finally {
    await pool.end();
  }
}

applyRLS().catch(e => {
  console.error('❌ Error:', e.message);
  process.exit(1);
});
