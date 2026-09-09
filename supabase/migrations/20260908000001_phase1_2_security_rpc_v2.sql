-- supabase/migrations/20260908_phase1_1_security_rpc_v2.sql
-- ============================================================================
-- REPORT v2 Phase 1.1 Security Remediation
-- Fixes: Badge bypass in RPCs, explicit state machine, search_path safety
-- ============================================================================
-- CHANGES FROM 20260908_security_and_rls.sql:
--   1. update_fir_status_secure: REMOVED badge-only authorization bypass.
--      Authorization: auth.uid() -> police_officers table (NOT client badge).
--   2. verify_legal_section_secure: Same badge bypass removed.
--   3. All SECURITY DEFINER functions: SET search_path = public added.
--   4. Explicit state machine transition matrix.
--   5. police_officers INSERT restricted to service_role only.
--
-- DEPLOYMENT (manual Supabase steps required for each station):
--   a) Create Supabase Auth user:
--      Email: <stationcode_no_dashes_lowercase>@police.internal
--      e.g. TN-CHN-001 -> tnchn001@police.internal
--      Password: set securely via Supabase Auth UI (NEVER police123)
--   b) Insert into police_officers:
--      INSERT INTO police_officers
--        (auth_uid, station_code, badge_number, officer_name, rank, is_active)
--      VALUES ('<UUID from auth.users>', 'TN-CHN-001', 'SHO-4102', 'Name', 'SHO', true);
-- ============================================================================

SET search_path = public;

-- 1. RESTRICT police_officers (prevent self-registration by authenticated users)
DROP POLICY IF EXISTS "Service role manages officer records" ON police_officers;
DROP POLICY IF EXISTS "Officers can view own officer profile" ON police_officers;

CREATE POLICY "Officers can view own officer profile"
  ON police_officers FOR SELECT TO authenticated
  USING (auth_uid = auth.uid());

-- No INSERT policy for 'authenticated' role.
-- Only service_role (Supabase admin API) can create officer records.

-- 2. REPLACE update_fir_status_secure WITHOUT BADGE BYPASS
DROP FUNCTION IF EXISTS update_fir_status_secure(TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION update_fir_status_secure(
  p_fir_id        TEXT,
  p_new_status    TEXT,
  p_officer_notes TEXT DEFAULT NULL,
  p_officer_badge TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_status  TEXT;
  v_fir_station     TEXT;
  v_calling_uid     UUID;
  v_officer_station TEXT;
  v_officer_badge   TEXT;
  v_official_no     TEXT;
  v_year            INT := EXTRACT(YEAR FROM NOW());
  v_seq             INT;
  v_history_entry   JSONB;
  v_transition_ok   BOOLEAN := FALSE;
BEGIN
  -- Step 1: Require authenticated caller
  v_calling_uid := auth.uid();
  IF v_calling_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required: no authenticated session'
      USING ERRCODE = '42501';
  END IF;

  -- Step 2: Load FIR record
  SELECT status, station_code, official_fir_no
    INTO v_current_status, v_fir_station, v_official_no
    FROM firs WHERE id = p_fir_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FIR record % not found', p_fir_id USING ERRCODE = 'P0002';
  END IF;

  -- Step 3: Authorize via police_officers table (NOT via client-supplied badge)
  SELECT po.station_code, po.badge_number
    INTO v_officer_station, v_officer_badge
    FROM police_officers po
   WHERE po.auth_uid = v_calling_uid AND po.is_active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Access Denied: Calling user is not a registered active officer'
      USING ERRCODE = '42501';
  END IF;

  IF v_officer_station IS DISTINCT FROM v_fir_station THEN
    RAISE EXCEPTION 'Access Denied: Officer station % not authorised for FIR at station %',
      v_officer_station, v_fir_station USING ERRCODE = '42501';
  END IF;

  -- Step 4: Validate status value
  IF p_new_status NOT IN ('submitted','investigating','resolved','closed','fake_fir') THEN
    RAISE EXCEPTION 'Invalid status: %. Allowed values: submitted, investigating, resolved, closed, fake_fir',
      p_new_status USING ERRCODE = '22023';
  END IF;

  -- Step 5: Explicit state machine transition matrix
  --   submitted    -> investigating  (police formally open investigation)
  --   submitted    -> fake_fir       (police immediately flag as false)
  --   investigating -> resolved      (case resolved)
  --   investigating -> closed        (administratively closed)
  --   investigating -> fake_fir      (found false during investigation)
  --   resolved     -> closed         (finalized post-resolution)
  --   ALL OTHER TRANSITIONS ARE DENIED.
  v_transition_ok := (
    (v_current_status = 'submitted'     AND p_new_status = 'investigating') OR
    (v_current_status = 'submitted'     AND p_new_status = 'fake_fir')      OR
    (v_current_status = 'investigating' AND p_new_status = 'resolved')      OR
    (v_current_status = 'investigating' AND p_new_status = 'closed')        OR
    (v_current_status = 'investigating' AND p_new_status = 'fake_fir')      OR
    (v_current_status = 'resolved'      AND p_new_status = 'closed')
  );

  IF NOT v_transition_ok THEN
    RAISE EXCEPTION 'Illegal state transition: % -> % is not permitted by workflow',
      v_current_status, p_new_status USING ERRCODE = '22023';
  END IF;

  -- Step 6: Assign official FIR number server-side (only when investigation begins)
  -- (SUPERSEDED in Phase 1.2: Atomic sequence counter in 20260909_phase1_2_concurrency_and_counters.sql)
  IF p_new_status = 'investigating' AND v_official_no IS NULL THEN
    -- In Phase 1.2, this is handled atomically by get_next_fir_sequence()
    v_official_no := v_fir_station || '/' || v_year || '/0001';
  END IF;

  -- Step 7: Immutable audit trail (badge from server, not client input)
  v_history_entry := jsonb_build_object(
    'timestamp',       NOW(),
    'from_status',     v_current_status,
    'to_status',       p_new_status,
    'officer_badge',   v_officer_badge,
    'officer_station', v_officer_station,
    'notes',           COALESCE(p_officer_notes, ''),
    'caller_uid',      v_calling_uid
  );

  -- Step 8: Update
  UPDATE firs
     SET status          = p_new_status,
         official_fir_no = COALESCE(official_fir_no, v_official_no),
         updated_at      = NOW(),
         status_history  = COALESCE(status_history, '[]'::jsonb)
                           || jsonb_build_array(v_history_entry)
   WHERE id = p_fir_id;

  RETURN jsonb_build_object(
    'success', TRUE, 'fir_id', p_fir_id,
    'status', p_new_status, 'official_fir_no', v_official_no, 'updated_at', NOW()
  );
END;
$$;

-- 3. REPLACE verify_legal_section_secure WITHOUT BADGE BYPASS
DROP FUNCTION IF EXISTS verify_legal_section_secure(TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION verify_legal_section_secure(
  p_fir_id        TEXT,
  p_section       TEXT,
  p_act           TEXT DEFAULT 'BNS 2023',
  p_officer_badge TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fir_station     TEXT;
  v_calling_uid     UUID;
  v_officer_station TEXT;
  v_officer_badge   TEXT;
  v_verified_entry  JSONB;
BEGIN
  v_calling_uid := auth.uid();
  IF v_calling_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  SELECT station_code INTO v_fir_station FROM firs WHERE id = p_fir_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FIR % not found', p_fir_id USING ERRCODE = 'P0002';
  END IF;

  -- Authorize via police_officers table, NOT via client-supplied badge
  SELECT po.station_code, po.badge_number
    INTO v_officer_station, v_officer_badge
    FROM police_officers po
   WHERE po.auth_uid = v_calling_uid AND po.is_active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Access Denied: Caller is not a registered active officer'
      USING ERRCODE = '42501';
  END IF;

  IF v_officer_station IS DISTINCT FROM v_fir_station THEN
    RAISE EXCEPTION 'Access Denied: Officer at station % cannot verify sections for station % FIR',
      v_officer_station, v_fir_station USING ERRCODE = '42501';
  END IF;

  v_verified_entry := jsonb_build_object(
    'act',                      p_act,
    'section',                  p_section,
    'verifiedByPolice',         TRUE,
    'verifiedByOfficerBadge',   v_officer_badge,
    'verifiedByOfficerStation', v_officer_station,
    'verifiedAt',               NOW(),
    'callerUid',                v_calling_uid
  );

  UPDATE firs
     SET verified_sections = COALESCE(verified_sections, '[]'::jsonb)
                             || jsonb_build_array(v_verified_entry),
         verified_by_badge = v_officer_badge,
         verified_at       = NOW(),
         updated_at        = NOW()
   WHERE id = p_fir_id;

  RETURN jsonb_build_object('success', TRUE, 'fir_id', p_fir_id, 'verified_entry', v_verified_entry);
END;
$$;

-- 4. Grant: authenticated only, anon cannot call these RPCs
REVOKE ALL ON FUNCTION update_fir_status_secure FROM anon, public;
REVOKE ALL ON FUNCTION verify_legal_section_secure FROM anon, public;
GRANT EXECUTE ON FUNCTION update_fir_status_secure TO authenticated;
GRANT EXECUTE ON FUNCTION verify_legal_section_secure TO authenticated;

