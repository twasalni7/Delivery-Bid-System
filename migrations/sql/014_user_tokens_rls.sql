-- 014_user_tokens_rls.sql
-- Enable RLS on user_tokens so direct Supabase REST / anon access is blocked.
-- The API server connects via the service role and bypasses RLS by design.

ALTER TABLE user_tokens ENABLE ROW LEVEL SECURITY;

-- Deny-all sentinel for anon and authenticated Supabase roles.
-- Service role (used by the Express API) is exempt from RLS.
DROP POLICY IF EXISTS deny_all_user_tokens ON user_tokens;
CREATE POLICY deny_all_user_tokens
  ON user_tokens
  FOR ALL
  TO anon, authenticated
  USING (false);
