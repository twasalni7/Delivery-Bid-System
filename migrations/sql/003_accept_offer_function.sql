-- =====================================================================
-- Migration 003 — Atomic accept_offer DB Function
-- نظام توصّلني — دالة قبول العرض الذرية (مع قفل الصف)
-- =====================================================================
--
-- ⚠️  تحذير: راجع الأسماء على schema الفعلي، وشغّل على staging أولاً.
--            أخذ نسخة احتياطية قبل التنفيذ.
--
-- Purpose:
--   Wrap the "select offer" business logic inside a single Postgres
--   function that acquires a row-level lock on the request before
--   making any changes, ensuring that concurrent calls cannot double-
--   accept the same request.
--
-- Parameters:
--   p_request_id   INTEGER  — ID of the transport request
--   p_offer_id     INTEGER  — ID of the offer being accepted
--   p_client_id    INTEGER  — ID of the client accepting (ownership check)
--   p_driver_fee   REAL     — Platform fee deducted from driver balance
--                             (default 50.0, matches current business rule)
--
-- Returns: TABLE with updated request and driver data for the API response.
--
-- Usage (from the API server via Drizzle / raw SQL):
--   SELECT * FROM accept_offer(1, 3, 7, 50.0);
-- =====================================================================

CREATE OR REPLACE FUNCTION public.accept_offer(
  p_request_id  INTEGER,
  p_offer_id    INTEGER,
  p_client_id   INTEGER,
  p_driver_fee  REAL DEFAULT 50.0
)
RETURNS TABLE (
  request_id        INTEGER,
  request_status    TEXT,
  selected_driver_id INTEGER,
  driver_id_out     INTEGER,
  driver_balance    REAL
)
LANGUAGE plpgsql
SECURITY DEFINER   -- Runs with the function owner's privileges so it can
                   -- write to tables protected by the deny-all RLS policies
                   -- added in migration 001.  The API service role still
                   -- bypasses RLS directly, but this function is also callable
                   -- from contexts that hold only the anon/authenticated role.
AS $$
DECLARE
  v_request      requests%ROWTYPE;
  v_offer        offers%ROWTYPE;
  v_driver       drivers%ROWTYPE;
BEGIN
  -- 1. Lock the request row to prevent concurrent accepts
  SELECT * INTO v_request
    FROM requests
   WHERE id = p_request_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'REQUEST_NOT_FOUND: request % does not exist', p_request_id;
  END IF;

  -- 2. Ownership check
  IF v_request.client_id IS DISTINCT FROM p_client_id THEN
    RAISE EXCEPTION 'FORBIDDEN: caller % does not own request %',
                    p_client_id, p_request_id;
  END IF;

  -- 3. Status guard — must be OPEN
  IF v_request.status <> 'OPEN' THEN
    RAISE EXCEPTION 'REQUEST_NOT_OPEN: request % has status %',
                    p_request_id, v_request.status;
  END IF;

  -- 4. Validate offer belongs to request
  SELECT * INTO v_offer
    FROM offers
   WHERE id = p_offer_id
     AND request_id = p_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'OFFER_NOT_FOUND: offer % not found for request %',
                    p_offer_id, p_request_id;
  END IF;

  IF v_offer.status <> 'PENDING' THEN
    RAISE EXCEPTION 'OFFER_NOT_PENDING: offer % has status %',
                    p_offer_id, v_offer.status;
  END IF;

  -- 5. Lock and validate the driver
  SELECT * INTO v_driver
    FROM drivers
   WHERE id = v_offer.driver_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DRIVER_NOT_FOUND: driver % does not exist', v_offer.driver_id;
  END IF;

  IF v_driver.balance < p_driver_fee THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE: driver % balance %.2f < required %.2f',
                    v_driver.id, v_driver.balance, p_driver_fee;
  END IF;

  -- 6. Deduct platform fee from driver
  UPDATE drivers
     SET balance = balance - p_driver_fee
   WHERE id = v_driver.id;

  -- 7. Record the fee transaction
  INSERT INTO transactions (driver_id, amount, type)
  VALUES (v_driver.id, -p_driver_fee, 'fee');

  -- 8. Mark request as SELECTED
  UPDATE requests
     SET status            = 'SELECTED',
         selected_driver_id = v_driver.id,
         updated_at         = NOW()
   WHERE id = p_request_id;

  -- 9. Mark offer as SELECTED, cancel all other PENDING offers for this request
  UPDATE offers
     SET status = 'SELECTED'
   WHERE id = p_offer_id;

  UPDATE offers
     SET status = 'CANCELLED'
   WHERE request_id = p_request_id
     AND id         <> p_offer_id
     AND status     = 'PENDING';

  -- 10. Return updated values for the API response
  RETURN QUERY
    SELECT
      r.id                   AS request_id,
      r.status::TEXT         AS request_status,
      r.selected_driver_id,
      d.id                   AS driver_id_out,
      d.balance              AS driver_balance
    FROM requests r
    JOIN drivers  d ON d.id = r.selected_driver_id
   WHERE r.id = p_request_id;
END;
$$;

-- Grant execute to the API server role
-- (replace 'api_user' with the actual DB role used by your API server)
-- GRANT EXECUTE ON FUNCTION public.accept_offer(INTEGER, INTEGER, INTEGER, REAL) TO api_user;

-- ─────────────────────────────────────────────────────────────────────
-- Verification
-- ─────────────────────────────────────────────────────────────────────
-- SELECT proname, prosrc FROM pg_proc
--   WHERE proname = 'accept_offer' AND pronamespace = 'public'::regnamespace;
