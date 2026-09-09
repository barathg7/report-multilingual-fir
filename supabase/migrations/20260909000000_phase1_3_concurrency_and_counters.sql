-- supabase/migrations/20260909_phase1_2_concurrency_and_counters.sql
-- ============================================================================
-- REPORT v2 Phase 1.2 — Concurrency Hardening & Atomic Sequence Counters
-- Fixes:
--   1. Replaces non-atomic MAX numbering in official FIR numbering with atomic counter table
--   2. Enforces unique, collision-resistant ACK / reference generation server-side
--   3. Adds DB unique constraints on official_fir_no and submission_id
--   4. Eliminates race conditions under simultaneous police approvals and filings
-- ============================================================================

SET search_path = public;

-- 1. FIRS TABLE HARDENING: DEFAULT UUID & UNIQUE CONSTRAINTS
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'firs') THEN
    -- Ensure default UUID generation for id if not present
    ALTER TABLE firs ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;

    -- Ensure submission_id column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'firs' AND column_name = 'submission_id') THEN
      ALTER TABLE firs ADD COLUMN submission_id TEXT;
    END IF;

    -- Ensure official_fir_no column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'firs' AND column_name = 'official_fir_no') THEN
      ALTER TABLE firs ADD COLUMN official_fir_no TEXT;
    END IF;
  END IF;
END $$;

-- Enforce strict database-level uniqueness (concurrency safety guarantee)
CREATE UNIQUE INDEX IF NOT EXISTS idx_firs_official_fir_no 
  ON firs (official_fir_no) 
  WHERE official_fir_no IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_firs_submission_id 
  ON firs (submission_id) 
  WHERE submission_id IS NOT NULL;


-- 2. ATOMIC COUNTERS TABLE
-- Holds the last assigned sequence per station, counter type ('official' | 'ack'), and year.
CREATE TABLE IF NOT EXISTS fir_counters (
  station_code  TEXT NOT NULL,
  counter_type  TEXT NOT NULL CHECK (counter_type IN ('official', 'ack')),
  year_val      INT NOT NULL,
  current_val   BIGINT NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (station_code, counter_type, year_val)
);

-- Enable RLS: Internal counter table accessible exclusively via SECURITY DEFINER functions
ALTER TABLE fir_counters ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON fir_counters FROM anon, authenticated, public;


-- 3. ATOMIC SEQUENCE GENERATOR FUNCTION
-- Concurrency safe: Acquires an exclusive row lock on (station_code, counter_type, year_val).
-- Simultaneous requests wait on the row lock and receive strictly sequential, distinct numbers.
CREATE OR REPLACE FUNCTION get_next_fir_sequence(
  p_station_code TEXT,
  p_counter_type TEXT,
  p_year         INT
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_val     BIGINT;
  v_initial_seed BIGINT := 0;
  v_clean_st     TEXT;
BEGIN
  v_clean_st := UPPER(TRIM(COALESCE(p_station_code, 'ONLINE')));

  -- Seed initial counter from existing firs records if no entry exists yet
  IF NOT EXISTS (
    SELECT 1 FROM fir_counters
     WHERE station_code = v_clean_st
       AND counter_type = p_counter_type
       AND year_val     = p_year
  ) THEN
    IF p_counter_type = 'official' THEN
      SELECT COALESCE(
        MAX(CASE
          WHEN official_fir_no ~ ('^' || v_clean_st || '/' || p_year || '/[0-9]+$')
          THEN CAST(SUBSTRING(official_fir_no FROM '[0-9]+$') AS BIGINT)
          ELSE 0
        END), 0)
        INTO v_initial_seed
        FROM firs
       WHERE station_code = v_clean_st AND official_fir_no IS NOT NULL;

    ELSIF p_counter_type = 'ack' THEN
      SELECT COALESCE(
        MAX(CASE
          WHEN submission_id ~ ('^ACK/' || v_clean_st || '/' || p_year || '/[0-9]+$')
          THEN CAST(SUBSTRING(submission_id FROM '[0-9]+$') AS BIGINT)
          ELSE 0
        END), 0)
        INTO v_initial_seed
        FROM firs
       WHERE (station_code = v_clean_st OR v_clean_st = 'ONLINE') AND submission_id IS NOT NULL;
    END IF;

    -- Upsert seed row
    INSERT INTO fir_counters (station_code, counter_type, year_val, current_val, updated_at)
    VALUES (v_clean_st, p_counter_type, p_year, v_initial_seed, NOW())
    ON CONFLICT (station_code, counter_type, year_val) DO NOTHING;
  END IF;

  -- Atomic increment using row-level locking
  UPDATE fir_counters
     SET current_val = current_val + 1,
         updated_at  = NOW()
   WHERE station_code = v_clean_st
     AND counter_type = p_counter_type
     AND year_val     = p_year
  RETURNING current_val INTO v_next_val;

  RETURN v_next_val;
END;
$$;


-- 4. SERVER-SIDE ACKNOWLEDGMENT ID TRIGGER
-- Assigns canonical collision-resistant ACK number server-side upon complaint filing.
CREATE OR REPLACE FUNCTION set_fir_submission_id_trg()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year    INT := EXTRACT(YEAR FROM NOW());
  v_seq     BIGINT;
  v_station TEXT;
BEGIN
  -- Assign canonical human-readable submission ACK if:
  -- 1) status is submitted AND
  -- 2) submission_id is null, empty, or a client temporary draft/pending reference
  IF NEW.status = 'submitted' AND (
    NEW.submission_id IS NULL OR
    NEW.submission_id = '' OR
    NEW.submission_id LIKE 'DRAFT-%' OR
    NEW.submission_id LIKE 'ACK-PENDING-%'
  ) THEN
    v_station := UPPER(TRIM(COALESCE(NEW.station_code, 'ONLINE')));
    v_seq     := get_next_fir_sequence(v_station, 'ack', v_year);
    NEW.submission_id := 'ACK/' || v_station || '/' || v_year::TEXT || '/' || LPAD(v_seq::TEXT, 6, '0');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_fir_submission_id ON firs;
CREATE TRIGGER trg_set_fir_submission_id
  BEFORE INSERT OR UPDATE OF status, submission_id
  ON firs
  FOR EACH ROW
  EXECUTE FUNCTION set_fir_submission_id_trg();


-- 5. SECURE STATUS MUTATION RPC (STATE MACHINE GUARD + ATOMIC OFFICIAL FIR NUMBER)
-- Overrides update_fir_status_secure from Phase 1.1:
-- Implements atomic sequence assignment via get_next_fir_sequence(...)
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
  v_seq             BIGINT;
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
  --   submitted     -> investigating  (police formally open investigation)
  --   submitted     -> fake_fir       (police immediately flag as false)
  --   investigating -> resolved       (case resolved)
  --   investigating -> closed         (administratively closed)
  --   investigating -> fake_fir       (found false during investigation)
  --   resolved      -> closed         (finalized post-resolution)
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

  -- Step 6: Atomic Official FIR Number Assignment (Concurrency Safe)
  -- Assigned strictly when moving into 'investigating' and only if not already assigned.
  IF p_new_status = 'investigating' AND v_official_no IS NULL THEN
    v_seq := get_next_fir_sequence(v_fir_station, 'official', v_year);
    v_official_no := v_fir_station || '/' || v_year || '/' || LPAD(v_seq::TEXT, 4, '0');
  END IF;

  -- Step 7: Immutable audit trail (badge and station from DB, never client input)
  v_history_entry := jsonb_build_object(
    'timestamp',       NOW(),
    'from_status',     v_current_status,
    'to_status',       p_new_status,
    'officer_badge',   v_officer_badge,
    'officer_station', v_officer_station,
    'notes',           COALESCE(p_officer_notes, ''),
    'caller_uid',      v_calling_uid
  );

  -- Step 8: Update FIR record
  UPDATE firs
     SET status          = p_new_status,
         official_fir_no = COALESCE(official_fir_no, v_official_no),
         updated_at      = NOW(),
         status_history  = COALESCE(status_history, '[]'::jsonb)
                           || jsonb_build_array(v_history_entry)
   WHERE id = p_fir_id;

  RETURN jsonb_build_object(
    'success',         TRUE,
    'fir_id',          p_fir_id,
    'status',          p_new_status,
    'official_fir_no', v_official_no,
    'updated_at',      NOW()
  );
END;
$$;

-- Grant execution to authenticated officers only
REVOKE ALL ON FUNCTION update_fir_status_secure FROM anon, public;
GRANT EXECUTE ON FUNCTION update_fir_status_secure TO authenticated;
