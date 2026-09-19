-- supabase/migrations/20260915100000_stage6_6_1_durable_sms_idempotency.sql
-- ============================================================================
-- Stage 6.6.1: Database-Backed Durable Idempotency & Atomic Claim for SOS SMS
-- ============================================================================

SET search_path = public;

-- 1. DURABLE SMS DISPATCH RECORD TABLE
CREATE TABLE IF NOT EXISTS sos_sms_dispatches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sos_id TEXT NOT NULL UNIQUE,
  station_code TEXT NOT NULL,
  recipient_count INTEGER NOT NULL DEFAULT 3,
  masked_recipients JSONB NOT NULL DEFAULT '[]'::jsonb,
  provider_request_id TEXT,
  state TEXT NOT NULL DEFAULT 'SMS_SUBMISSION_PENDING'
    CHECK (state IN (
      'SMS_SUBMISSION_PENDING',
      'SMS_SUBMITTED',
      'SMS_PROVIDER_REJECTED',
      'SMS_DELIVERY_CONFIRMED'
    )),
  error_message TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient lookup and station-level reporting
CREATE INDEX IF NOT EXISTS idx_sos_sms_dispatches_sos_id
  ON sos_sms_dispatches (sos_id);

CREATE INDEX IF NOT EXISTS idx_sos_sms_dispatches_station_state
  ON sos_sms_dispatches (station_code, state, created_at DESC);

-- Enable RLS
ALTER TABLE sos_sms_dispatches ENABLE ROW LEVEL SECURITY;

-- Revoke all direct public mutations
REVOKE ALL ON TABLE sos_sms_dispatches FROM anon, public;
GRANT SELECT ON TABLE sos_sms_dispatches TO authenticated;

-- Policy: Only station officers or admins may inspect dispatch status
DROP POLICY IF EXISTS "Station officers can inspect station SMS dispatches" ON sos_sms_dispatches;
CREATE POLICY "Station officers can inspect station SMS dispatches"
  ON sos_sms_dispatches
  FOR SELECT
  TO authenticated
  USING (
    auth.jwt() IS NOT NULL AND (
      (auth.jwt()->'app_metadata'->>'station_code' = sos_sms_dispatches.station_code)
      OR EXISTS (
        SELECT 1 FROM police_officers po
        WHERE po.auth_uid = auth.uid()
          AND po.station_code = sos_sms_dispatches.station_code
          AND po.is_active = TRUE
      )
    )
  );

-- 2. ATOMIC CLAIM RPC FUNCTION
-- Atomically creates a pending dispatch record or evaluates existing state for duplicate/retry handling.
CREATE OR REPLACE FUNCTION claim_sos_sms_dispatch(
  p_sos_id TEXT,
  p_station_code TEXT,
  p_recipient_count INTEGER,
  p_masked_recipients JSONB,
  p_max_attempts INTEGER DEFAULT 2
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record RECORD;
BEGIN
  -- Validate required inputs
  IF p_sos_id IS NULL OR TRIM(p_sos_id) = '' THEN
    RETURN jsonb_build_object(
      'claimed', FALSE,
      'error', 'sos_id is required for claiming SMS dispatch'
    );
  END IF;

  -- 1. Check if record already exists with row-level locking
  SELECT * INTO v_record
  FROM sos_sms_dispatches
  WHERE sos_id = p_sos_id
  FOR UPDATE;

  IF NOT FOUND THEN
    -- First attempt: atomically claim row
    INSERT INTO sos_sms_dispatches (
      sos_id,
      station_code,
      recipient_count,
      masked_recipients,
      state,
      attempt_count,
      created_at,
      updated_at
    ) VALUES (
      p_sos_id,
      COALESCE(p_station_code, 'ONLINE'),
      COALESCE(p_recipient_count, 3),
      COALESCE(p_masked_recipients, '[]'::jsonb),
      'SMS_SUBMISSION_PENDING',
      1,
      NOW(),
      NOW()
    )
    RETURNING * INTO v_record;

    RETURN jsonb_build_object(
      'claimed', TRUE,
      'is_retry', FALSE,
      'state', v_record.state,
      'attempt_count', v_record.attempt_count,
      'message', 'SMS dispatch claimed successfully'
    );
  END IF;

  -- 2. If already submitted or delivery confirmed, reject duplicate request
  IF v_record.state IN ('SMS_SUBMITTED', 'SMS_DELIVERY_CONFIRMED') THEN
    RETURN jsonb_build_object(
      'claimed', FALSE,
      'is_retry', FALSE,
      'state', v_record.state,
      'attempt_count', v_record.attempt_count,
      'provider_request_id', v_record.provider_request_id,
      'message', 'Duplicate dispatch blocked: SOS alert already submitted for SMS delivery'
    );
  END IF;

  -- 3. If currently pending submission, reject in-flight concurrent execution
  IF v_record.state = 'SMS_SUBMISSION_PENDING' THEN
    RETURN jsonb_build_object(
      'claimed', FALSE,
      'is_retry', FALSE,
      'state', v_record.state,
      'attempt_count', v_record.attempt_count,
      'message', 'SMS dispatch is currently pending submission in flight'
    );
  END IF;

  -- 4. If previously rejected, evaluate controlled retry
  IF v_record.state = 'SMS_PROVIDER_REJECTED' THEN
    IF v_record.attempt_count >= p_max_attempts THEN
      RETURN jsonb_build_object(
        'claimed', FALSE,
        'is_retry', TRUE,
        'state', v_record.state,
        'attempt_count', v_record.attempt_count,
        'error_message', v_record.error_message,
        'message', 'Maximum retry attempts exceeded for this SOS alert'
      );
    ELSE
      -- Grant controlled retry claim and increment attempt counter
      UPDATE sos_sms_dispatches
      SET state = 'SMS_SUBMISSION_PENDING',
          attempt_count = attempt_count + 1,
          updated_at = NOW()
      WHERE sos_id = p_sos_id
      RETURNING * INTO v_record;

      RETURN jsonb_build_object(
        'claimed', TRUE,
        'is_retry', TRUE,
        'state', v_record.state,
        'attempt_count', v_record.attempt_count,
        'message', 'Controlled retry claim granted'
      );
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'claimed', FALSE,
    'state', v_record.state,
    'message', 'Unhandled dispatch state'
  );
END;
$$;

-- 3. UPDATE DISPATCH OUTCOME RPC FUNCTION
CREATE OR REPLACE FUNCTION update_sos_sms_dispatch(
  p_sos_id TEXT,
  p_state TEXT,
  p_provider_request_id TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record RECORD;
BEGIN
  UPDATE sos_sms_dispatches
  SET state = p_state,
      provider_request_id = COALESCE(p_provider_request_id, provider_request_id),
      error_message = p_error_message,
      updated_at = NOW()
  WHERE sos_id = p_sos_id
  RETURNING * INTO v_record;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Dispatch record not found');
  END IF;

  RETURN jsonb_build_object(
    'success', TRUE,
    'state', v_record.state,
    'provider_request_id', v_record.provider_request_id,
    'attempt_count', v_record.attempt_count
  );
END;
$$;
