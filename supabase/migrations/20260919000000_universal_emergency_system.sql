-- supabase/migrations/20260919000000_universal_emergency_system.sql
-- ============================================================================
-- REPORT Universal Emergency System — Database Schema & RPC Functions
-- Adds Emergency Taxonomy, Threat Evolution, Incident Facts, Append-Only
-- Timeline, SafeTag Hardware Gateway Ingestion, and Police Incident Management.
-- ============================================================================

SET search_path = public;

-- 1. EXTEND sos_records TABLE WITH INCIDENT INTELLIGENCE FIELDS
DO $$
BEGIN
  -- emergency_type
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sos_records' AND column_name = 'emergency_type'
  ) THEN
    ALTER TABLE sos_records ADD COLUMN emergency_type TEXT NOT NULL DEFAULT 'OTHER_CRITICAL_EMERGENCY';
  END IF;

  -- priority
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sos_records' AND column_name = 'priority'
  ) THEN
    ALTER TABLE sos_records ADD COLUMN priority TEXT NOT NULL DEFAULT 'HIGH';
    ALTER TABLE sos_records ADD CONSTRAINT sos_records_priority_check
      CHECK (priority IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW'));
  END IF;

  -- threat_level
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sos_records' AND column_name = 'threat_level'
  ) THEN
    ALTER TABLE sos_records ADD COLUMN threat_level TEXT NOT NULL DEFAULT 'ACTIVE_THREAT';
    ALTER TABLE sos_records ADD CONSTRAINT sos_records_threat_level_check
      CHECK (threat_level IN (
        'UNKNOWN',
        'SUSPICIOUS_ACTIVITY',
        'ACTIVE_THREAT',
        'CRITICAL_THREAT',
        'ACKNOWLEDGED',
        'RESOLVED'
      ));
  END IF;

  -- victim_status
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sos_records' AND column_name = 'victim_status'
  ) THEN
    ALTER TABLE sos_records ADD COLUMN victim_status TEXT NOT NULL DEFAULT 'REQUIRES_ASSISTANCE';
  END IF;

  -- incident_facts
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sos_records' AND column_name = 'incident_facts'
  ) THEN
    ALTER TABLE sos_records ADD COLUMN incident_facts JSONB NOT NULL DEFAULT '{}'::jsonb;
  END IF;

  -- incident_timeline
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sos_records' AND column_name = 'incident_timeline'
  ) THEN
    ALTER TABLE sos_records ADD COLUMN incident_timeline JSONB NOT NULL DEFAULT '[]'::jsonb;
  END IF;

  -- source
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sos_records' AND column_name = 'source'
  ) THEN
    ALTER TABLE sos_records ADD COLUMN source TEXT NOT NULL DEFAULT 'WEB_QUICKSHIELD';
  END IF;

  -- safetag_device_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sos_records' AND column_name = 'safetag_device_id'
  ) THEN
    ALTER TABLE sos_records ADD COLUMN safetag_device_id TEXT;
  END IF;

  -- safetag_event_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sos_records' AND column_name = 'safetag_event_id'
  ) THEN
    ALTER TABLE sos_records ADD COLUMN safetag_event_id TEXT;
  END IF;
END $$;

-- Indexes for incident status and threat level
CREATE INDEX IF NOT EXISTS idx_sos_records_threat_priority
  ON sos_records (nearest_station_code, threat_level, priority, created_at DESC);

-- 2. SAFETAG PHYSICAL DEVICES TABLE
CREATE TABLE IF NOT EXISTS safetag_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  device_id TEXT NOT NULL UNIQUE,
  device_name TEXT NOT NULL DEFAULT 'REPORT SafeTag',
  firmware_version TEXT NOT NULL DEFAULT '1.0.0-ESP32',
  battery_level INTEGER DEFAULT 100 CHECK (battery_level >= 0 AND battery_level <= 100),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  paired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE safetag_devices ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE safetag_devices FROM anon, public;
GRANT SELECT, INSERT, UPDATE ON TABLE safetag_devices TO anon, authenticated;

-- Citizen can manage own paired SafeTag devices
DROP POLICY IF EXISTS "Citizens manage own SafeTag devices" ON safetag_devices;
CREATE POLICY "Citizens manage own SafeTag devices"
  ON safetag_devices
  FOR ALL
  TO authenticated
  USING (auth.uid() IS NOT NULL AND user_id = auth.uid())
  WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- Allow anon to register demo / simulator tags if unauthenticated
DROP POLICY IF EXISTS "Anon SafeTag simulator access" ON safetag_devices;
CREATE POLICY "Anon SafeTag simulator access"
  ON safetag_devices
  FOR SELECT
  TO anon
  USING (device_id LIKE 'SIM_%');

-- 3. APPEND INCIDENT EVENT RPC
-- Atomically appends an event to the incident timeline
CREATE OR REPLACE FUNCTION append_incident_event(
  p_sos_id UUID,
  p_event_type TEXT,
  p_description TEXT,
  p_actor TEXT DEFAULT 'CITIZEN',
  p_source TEXT DEFAULT 'WEB_QUICKSHIELD',
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record RECORD;
  v_event JSONB;
  v_now TIMESTAMPTZ;
BEGIN
  v_now := NOW();
  IF p_sos_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'p_sos_id is required');
  END IF;

  SELECT * INTO v_record FROM sos_records WHERE id = p_sos_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'SOS incident record not found');
  END IF;

  v_event := jsonb_build_object(
    'event_id', gen_random_uuid(),
    'event_type', COALESCE(p_event_type, 'FACT_UPDATE'),
    'description', COALESCE(p_description, 'Incident updated'),
    'actor', COALESCE(p_actor, 'CITIZEN'),
    'source', COALESCE(p_source, 'WEB_QUICKSHIELD'),
    'timestamp', v_now,
    'metadata', COALESCE(p_metadata, '{}'::jsonb)
  );

  UPDATE sos_records
  SET incident_timeline = incident_timeline || v_event
  WHERE id = p_sos_id
  RETURNING * INTO v_record;

  RETURN jsonb_build_object(
    'success', TRUE,
    'sos_id', p_sos_id,
    'event', v_event,
    'total_events', jsonb_array_length(v_record.incident_timeline)
  );
END;
$$;

-- 4. UPDATE INCIDENT FACTS RPC
-- Merges known facts (weapons, suspects count, victim status) and appends a timeline entry
CREATE OR REPLACE FUNCTION update_incident_facts(
  p_sos_id UUID,
  p_facts JSONB,
  p_actor TEXT DEFAULT 'CITIZEN',
  p_source TEXT DEFAULT 'ADAPTIVE_INTERVIEW'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record RECORD;
  v_merged_facts JSONB;
  v_event JSONB;
  v_now TIMESTAMPTZ;
  v_priority TEXT;
BEGIN
  v_now := NOW();
  IF p_sos_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'p_sos_id is required');
  END IF;

  SELECT * INTO v_record FROM sos_records WHERE id = p_sos_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'SOS incident record not found');
  END IF;

  -- Deep merge facts
  v_merged_facts := v_record.incident_facts || COALESCE(p_facts, '{}'::jsonb);

  -- Automatic priority calculation: if weapon reported or suspects >= 3, escalate priority to CRITICAL
  v_priority := v_record.priority;
  IF (v_merged_facts->>'weapon_visible') = 'true'
     OR (v_merged_facts->>'weapon_reported') = 'true'
     OR (v_merged_facts->>'suspects_count') IN ('3+', 'many')
     OR (v_merged_facts->>'immediate_physical_threat') = 'true' THEN
    v_priority := 'CRITICAL';
  END IF;

  v_event := jsonb_build_object(
    'event_id', gen_random_uuid(),
    'event_type', 'FACTS_UPDATED',
    'description', 'Incident details updated: ' || COALESCE(p_facts::text, ''),
    'actor', COALESCE(p_actor, 'CITIZEN'),
    'source', COALESCE(p_source, 'ADAPTIVE_INTERVIEW'),
    'timestamp', v_now,
    'facts', p_facts
  );

  UPDATE sos_records
  SET incident_facts = v_merged_facts,
      priority = v_priority,
      incident_timeline = incident_timeline || v_event
  WHERE id = p_sos_id
  RETURNING * INTO v_record;

  RETURN jsonb_build_object(
    'success', TRUE,
    'sos_id', p_sos_id,
    'facts', v_record.incident_facts,
    'priority', v_record.priority
  );
END;
$$;

-- 5. EVOLVE THREAT LEVEL RPC
-- Governs state transitions with strict anti-downgrade controls
CREATE OR REPLACE FUNCTION evolve_threat_level(
  p_sos_id UUID,
  p_new_level TEXT,
  p_reason TEXT,
  p_actor TEXT DEFAULT 'SYSTEM',
  p_source TEXT DEFAULT 'CRISIS_INTELLIGENCE_ENGINE'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record RECORD;
  v_old_level TEXT;
  v_now TIMESTAMPTZ;
  v_event JSONB;
BEGIN
  v_now := NOW();
  IF p_sos_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'p_sos_id is required');
  END IF;

  IF p_new_level NOT IN ('UNKNOWN', 'SUSPICIOUS_ACTIVITY', 'ACTIVE_THREAT', 'CRITICAL_THREAT', 'ACKNOWLEDGED', 'RESOLVED') THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Invalid threat level: ' || COALESCE(p_new_level, 'NULL'));
  END IF;

  SELECT * INTO v_record FROM sos_records WHERE id = p_sos_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'SOS incident not found');
  END IF;

  v_old_level := v_record.threat_level;

  -- Block illegal downgrades: Cannot revert from CRITICAL_THREAT to SUSPICIOUS_ACTIVITY or UNKNOWN
  IF v_old_level = 'CRITICAL_THREAT' AND p_new_level IN ('SUSPICIOUS_ACTIVITY', 'UNKNOWN') THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Illegal threat downgrade from CRITICAL_THREAT to ' || p_new_level
    );
  END IF;

  -- Cannot re-activate once resolved
  IF v_old_level = 'RESOLVED' AND p_new_level != 'RESOLVED' THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Cannot evolve threat level on a resolved incident'
    );
  END IF;

  v_event := jsonb_build_object(
    'event_id', gen_random_uuid(),
    'event_type', 'THREAT_EVOLVED',
    'description', 'Threat evolved from ' || v_old_level || ' to ' || p_new_level || ': ' || COALESCE(p_reason, 'No reason specified'),
    'actor', COALESCE(p_actor, 'SYSTEM'),
    'source', COALESCE(p_source, 'CRISIS_INTELLIGENCE_ENGINE'),
    'timestamp', v_now,
    'old_level', v_old_level,
    'new_level', p_new_level
  );

  UPDATE sos_records
  SET threat_level = p_new_level,
      incident_timeline = incident_timeline || v_event
  WHERE id = p_sos_id
  RETURNING * INTO v_record;

  RETURN jsonb_build_object(
    'success', TRUE,
    'sos_id', p_sos_id,
    'old_level', v_old_level,
    'new_level', p_new_level,
    'timestamp', v_now
  );
END;
$$;

-- 6. INGEST SAFETAG BLE EVENT RPC
-- Ingests hardware / simulator triggers idempotently
CREATE OR REPLACE FUNCTION ingest_safetag_event(
  p_device_id TEXT,
  p_event_id TEXT,
  p_event_type TEXT,
  p_battery INTEGER DEFAULT 100,
  p_lat DOUBLE PRECISION DEFAULT 0.0,
  p_lng DOUBLE PRECISION DEFAULT 0.0,
  p_accuracy DOUBLE PRECISION DEFAULT 10.0,
  p_station_code TEXT DEFAULT 'ONLINE',
  p_station_name TEXT DEFAULT 'Jurisdictional Police'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_id UUID;
  v_emergency_type TEXT;
  v_threat_level TEXT;
  v_priority TEXT;
  v_record RECORD;
  v_timeline JSONB;
  v_now TIMESTAMPTZ;
  v_maps_url TEXT;
BEGIN
  v_now := NOW();
  IF p_device_id IS NULL OR p_event_id IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'device_id and event_id are required');
  END IF;

  -- 1. Idempotency Gate: Check if event_id already ingested
  SELECT id INTO v_existing_id FROM sos_records WHERE safetag_event_id = p_event_id;
  IF FOUND THEN
    SELECT * INTO v_record FROM sos_records WHERE id = v_existing_id;
    RETURN jsonb_build_object(
      'success', TRUE,
      'idempotent', TRUE,
      'sos_id', v_record.id,
      'message', 'SafeTag event already processed idempotently'
    );
  END IF;

  -- 2. Map SafeTag Event Type to Emergency Taxonomy
  IF p_event_type = 'SOS_PHYSICAL_THREAT' THEN
    v_emergency_type := 'IMMEDIATE_PHYSICAL_THREAT';
    v_threat_level := 'CRITICAL_THREAT';
    v_priority := 'CRITICAL';
  ELSIF p_event_type = 'SOS_MEDICAL' THEN
    v_emergency_type := 'MEDICAL_EMERGENCY';
    v_threat_level := 'ACTIVE_THREAT';
    v_priority := 'HIGH';
  ELSE
    v_emergency_type := 'OTHER_CRITICAL_EMERGENCY';
    v_threat_level := 'ACTIVE_THREAT';
    v_priority := 'HIGH';
  END IF;

  v_maps_url := 'https://www.google.com/maps?q=' || p_lat::text || ',' || p_lng::text;

  v_timeline := jsonb_build_array(
    jsonb_build_object(
      'event_id', gen_random_uuid(),
      'event_type', 'SAFETAG_TRIGGER',
      'description', 'Physical SafeTag trigger: ' || p_event_type || ' (battery ' || p_battery || '%)',
      'actor', 'CITIZEN',
      'source', 'SAFETAG_HARDWARE',
      'timestamp', v_now
    )
  );

  INSERT INTO sos_records (
    user_id,
    latitude,
    longitude,
    accuracy,
    nearest_station_code,
    nearest_station_name,
    maps_url,
    message,
    status,
    emergency_type,
    priority,
    threat_level,
    victim_status,
    incident_facts,
    incident_timeline,
    source,
    safetag_device_id,
    safetag_event_id,
    created_at
  ) VALUES (
    auth.uid(),
    p_lat,
    p_lng,
    p_accuracy,
    UPPER(TRIM(p_station_code)),
    TRIM(p_station_name),
    v_maps_url,
    '🚨 SAFETAG EMERGENCY: ' || p_event_type || ' activated via BLE tag',
    'active',
    v_emergency_type,
    v_priority,
    v_threat_level,
    'REQUIRES_ASSISTANCE',
    jsonb_build_object('battery', p_battery, 'safetag_event_type', p_event_type),
    v_timeline,
    'SAFETAG_HARDWARE',
    p_device_id,
    p_event_id,
    v_now
  ) RETURNING * INTO v_record;

  -- Update device last seen
  UPDATE safetag_devices
  SET last_seen_at = v_now, battery_level = p_battery
  WHERE device_id = p_device_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'idempotent', FALSE,
    'sos_id', v_record.id,
    'emergency_type', v_emergency_type,
    'threat_level', v_threat_level,
    'priority', v_priority
  );
END;
$$;

-- 7. REVISE acknowledge_sos_secure & resolve_sos_secure TO APPEND TIMELINE EVENTS
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
  v_now             TIMESTAMPTZ;
  v_event           JSONB;
BEGIN
  v_now := NOW();
  v_calling_uid := auth.uid();
  IF v_calling_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required: no active police session' USING ERRCODE = '42501';
  END IF;

  SELECT nearest_station_code, status INTO v_sos_station, v_current_status
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

  v_event := jsonb_build_object(
    'event_id', gen_random_uuid(),
    'event_type', 'POLICE_ACKNOWLEDGED',
    'description', 'Police Command acknowledged alert (Officer ' || v_officer_badge || ')',
    'actor', 'POLICE',
    'source', 'POLICE_DASHBOARD',
    'timestamp', v_now,
    'badge', v_officer_badge,
    'station', v_sos_station
  );

  UPDATE sos_records
  SET status = 'acknowledged',
      threat_level = 'ACKNOWLEDGED',
      acknowledged_at = v_now,
      incident_timeline = incident_timeline || v_event
  WHERE id = p_sos_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'sos_id', p_sos_id,
    'status', 'acknowledged',
    'threat_level', 'ACKNOWLEDGED',
    'acknowledged_at', v_now,
    'officer_badge', v_officer_badge,
    'station_code', v_sos_station
  );
END;
$$;

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
  v_now             TIMESTAMPTZ;
  v_event           JSONB;
BEGIN
  v_now := NOW();
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

  v_event := jsonb_build_object(
    'event_id', gen_random_uuid(),
    'event_type', 'POLICE_RESOLVED',
    'description', 'Emergency incident marked resolved by station personnel. Notes: ' || COALESCE(p_officer_notes, 'None'),
    'actor', 'POLICE',
    'source', 'POLICE_DASHBOARD',
    'timestamp', v_now,
    'badge', v_officer_badge,
    'notes', p_officer_notes
  );

  UPDATE sos_records
  SET status = 'resolved',
      threat_level = 'RESOLVED',
      resolved_at = v_now,
      incident_timeline = incident_timeline || v_event
  WHERE id = p_sos_id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'sos_id', p_sos_id,
    'status', 'resolved',
    'threat_level', 'RESOLVED',
    'resolved_at', v_now,
    'officer_badge', v_officer_badge,
    'station_code', v_sos_station
  );
END;
$$;

-- Grant execute privileges
REVOKE ALL ON FUNCTION append_incident_event FROM anon, public;
GRANT EXECUTE ON FUNCTION append_incident_event TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION update_incident_facts FROM anon, public;
GRANT EXECUTE ON FUNCTION update_incident_facts TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION evolve_threat_level FROM anon, public;
GRANT EXECUTE ON FUNCTION evolve_threat_level TO authenticated, service_role;

REVOKE ALL ON FUNCTION ingest_safetag_event FROM anon, public;
GRANT EXECUTE ON FUNCTION ingest_safetag_event TO anon, authenticated, service_role;
