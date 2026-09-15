-- supabase/migrations/20260912000000_stage6_3_sos_realtime_and_rls.sql
-- ============================================================================
-- REPORT v2 Stage 6.3 — Station-Aware SOS Model, RLS & Realtime Police Dispatch
-- ============================================================================

SET search_path = public;

-- 1. SOS RECORDS TABLE
CREATE TABLE IF NOT EXISTS sos_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION,
  nearest_station_code TEXT NOT NULL,
  nearest_station_name TEXT NOT NULL,
  maps_url TEXT NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ
);

-- Index for station-scoped querying and realtime filtering
CREATE INDEX IF NOT EXISTS idx_sos_records_station_status
  ON sos_records (nearest_station_code, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sos_records_user_id
  ON sos_records (user_id);

-- 2. ROW LEVEL SECURITY (RLS) HARDENING
ALTER TABLE sos_records ENABLE ROW LEVEL SECURITY;

-- Revoke all direct public access
REVOKE ALL ON TABLE sos_records FROM anon, public;
GRANT SELECT, INSERT, UPDATE ON TABLE sos_records TO anon, authenticated;

-- POLICY 1: CITIZEN INSERT
-- Citizens can insert their own SOS alert.
-- If authenticated, user_id must match auth.uid(). If anonymous, user_id may be null.
DROP POLICY IF EXISTS "Citizens can insert own SOS" ON sos_records;
CREATE POLICY "Citizens can insert own SOS"
  ON sos_records
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    (auth.uid() IS NULL AND user_id IS NULL)
    OR (auth.uid() IS NOT NULL AND user_id = auth.uid())
  );

-- POLICY 2: RESTRICTED SELECT (CITIZEN & STATION-SCOPED POLICE)
-- Public CANNOT view all citizen SOS records!
-- A citizen can view ONLY their own SOS records.
-- A police officer can view ONLY SOS records where nearest_station_code matches their assigned station.
-- Police must NOT receive every citizen's SOS simply because they are authenticated.
DROP POLICY IF EXISTS "Restricted SOS select access" ON sos_records;
CREATE POLICY "Restricted SOS select access"
  ON sos_records
  FOR SELECT
  TO anon, authenticated
  USING (
    -- 1. Citizen viewing their own SOS
    (auth.uid() IS NOT NULL AND user_id = auth.uid())
    OR
    -- 2. Police Station authorization via JWT claim or police_officers assignment
    (
      auth.jwt() IS NOT NULL AND (
        (auth.jwt()->'app_metadata'->>'station_code' = sos_records.nearest_station_code)
        OR EXISTS (
          SELECT 1 FROM police_officers po
          WHERE po.auth_uid = auth.uid()
            AND po.station_code = sos_records.nearest_station_code
            AND po.is_active = TRUE
        )
      )
    )
  );

-- POLICY 3: RESTRICTED UPDATE (CITIZEN CANCEL & STATION-SCOPED POLICE RESOLVE)
DROP POLICY IF EXISTS "Restricted SOS update access" ON sos_records;
CREATE POLICY "Restricted SOS update access"
  ON sos_records
  FOR UPDATE
  TO authenticated
  USING (
    -- Citizen updating own record
    (auth.uid() IS NOT NULL AND user_id = auth.uid())
    OR
    -- Police assigned to the station
    (
      auth.jwt() IS NOT NULL AND (
        (auth.jwt()->'app_metadata'->>'station_code' = sos_records.nearest_station_code)
        OR EXISTS (
          SELECT 1 FROM police_officers po
          WHERE po.auth_uid = auth.uid()
            AND po.station_code = sos_records.nearest_station_code
            AND po.is_active = TRUE
        )
      )
    )
  )
  WITH CHECK (
    -- Citizen can only cancel or update their own record
    (auth.uid() IS NOT NULL AND user_id = auth.uid() AND status IN ('cancelled', 'active'))
    OR
    -- Police can only acknowledge or resolve
    (
      auth.jwt() IS NOT NULL AND (
        (auth.jwt()->'app_metadata'->>'station_code' = sos_records.nearest_station_code)
        OR EXISTS (
          SELECT 1 FROM police_officers po
          WHERE po.auth_uid = auth.uid()
            AND po.station_code = sos_records.nearest_station_code
            AND po.is_active = TRUE
        )
      )
      AND status IN ('acknowledged', 'resolved')
    )
  );

-- 3. SECURE ACKNOWLEDGE RPC FOR POLICE COMMAND
CREATE OR REPLACE FUNCTION acknowledge_sos_secure(
  p_sos_id UUID,
  p_officer_badge TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_calling_uid     UUID;
  v_officer_station TEXT;
  v_officer_badge   TEXT;
  v_sos_station     TEXT;
  v_current_status  TEXT;
BEGIN
  v_calling_uid := auth.uid();
  IF v_calling_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required: no active police session' USING ERRCODE = '42501';
  END IF;

  -- Load SOS record
  SELECT nearest_station_code, status INTO v_sos_station, v_current_status
  FROM sos_records WHERE id = p_sos_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SOS record % not found', p_sos_id USING ERRCODE = 'P0002';
  END IF;

  -- Authorize officer via police_officers or JWT metadata
  SELECT po.station_code, po.badge_number
    INTO v_officer_station, v_officer_badge
    FROM police_officers po
   WHERE po.auth_uid = v_calling_uid AND po.is_active = TRUE;

  IF NOT FOUND THEN
    IF (auth.jwt()->'app_metadata'->>'station_code' = v_sos_station) THEN
      v_officer_station := v_sos_station;
      v_officer_badge   := COALESCE(p_officer_badge, 'DUTY-OFFICER');
    ELSE
      RAISE EXCEPTION 'Access Denied: Calling user is not a registered active officer' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF v_officer_station IS DISTINCT FROM v_sos_station THEN
    RAISE EXCEPTION 'Access Denied: Officer station % not authorized for SOS at station %',
      v_officer_station, v_sos_station USING ERRCODE = '42501';
  END IF;

  IF v_current_status = 'resolved' THEN
    RAISE EXCEPTION 'Illegal transition: SOS alert is already resolved' USING ERRCODE = '22023';
  END IF;

  UPDATE sos_records
  SET status = 'acknowledged',
      acknowledged_at = NOW()
  WHERE id = p_sos_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'sos_id', p_sos_id,
    'status', 'acknowledged',
    'acknowledged_at', NOW(),
    'officer_badge', v_officer_badge,
    'station_code', v_sos_station
  );
END;
$$;

-- 4. SECURE RESOLVE RPC FOR POLICE COMMAND
CREATE OR REPLACE FUNCTION resolve_sos_secure(
  p_sos_id UUID,
  p_officer_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_calling_uid     UUID;
  v_officer_station TEXT;
  v_officer_badge   TEXT;
  v_sos_station     TEXT;
BEGIN
  v_calling_uid := auth.uid();
  IF v_calling_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required: no active police session' USING ERRCODE = '42501';
  END IF;

  SELECT nearest_station_code INTO v_sos_station
  FROM sos_records WHERE id = p_sos_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SOS record % not found', p_sos_id USING ERRCODE = 'P0002';
  END IF;

  SELECT po.station_code, po.badge_number
    INTO v_officer_station, v_officer_badge
    FROM police_officers po
   WHERE po.auth_uid = v_calling_uid AND po.is_active = TRUE;

  IF NOT FOUND THEN
    IF (auth.jwt()->'app_metadata'->>'station_code' = v_sos_station) THEN
      v_officer_station := v_sos_station;
      v_officer_badge   := 'DUTY-OFFICER';
    ELSE
      RAISE EXCEPTION 'Access Denied: Calling user is not a registered active officer' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF v_officer_station IS DISTINCT FROM v_sos_station THEN
    RAISE EXCEPTION 'Access Denied: Officer station % not authorized for SOS at station %',
      v_officer_station, v_sos_station USING ERRCODE = '42501';
  END IF;

  UPDATE sos_records
  SET status = 'resolved',
      resolved_at = NOW()
  WHERE id = p_sos_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'sos_id', p_sos_id,
    'status', 'resolved',
    'resolved_at', NOW(),
    'officer_badge', v_officer_badge,
    'station_code', v_sos_station
  );
END;
$$;

-- Grant execution to authenticated users
REVOKE ALL ON FUNCTION acknowledge_sos_secure FROM anon, public;
GRANT EXECUTE ON FUNCTION acknowledge_sos_secure TO authenticated;

REVOKE ALL ON FUNCTION resolve_sos_secure FROM anon, public;
GRANT EXECUTE ON FUNCTION resolve_sos_secure TO authenticated;

-- 5. SUPABASE REALTIME PUBLICATION
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE sos_records;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
