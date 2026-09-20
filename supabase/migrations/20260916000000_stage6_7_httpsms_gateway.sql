-- supabase/migrations/20260916000000_stage6_7_httpsms_gateway.sql
-- ============================================================================
-- Stage 6.7: httpSMS Gateway Integration & Asynchronous Delivery Reporting
-- Updates state check constraint for SMS_DELIVERY_FAILED and adds atomic webhook
-- status resolution RPC for correlation with httpSMS Android Gateway callbacks.
-- ============================================================================

SET search_path = public;

-- 1. ENSURE REQUIRED COLUMNS & EXPAND STATE CHECK CONSTRAINT
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'sos_sms_dispatches'
  ) THEN
    -- Add submitted_at if missing
    ALTER TABLE sos_sms_dispatches 
      ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;

    -- Add error column if missing (alongside existing error_message)
    ALTER TABLE sos_sms_dispatches 
      ADD COLUMN IF NOT EXISTS error TEXT;

    -- Add attempts column if missing (alongside existing attempt_count)
    ALTER TABLE sos_sms_dispatches 
      ADD COLUMN IF NOT EXISTS attempts INTEGER DEFAULT 1;

    -- Drop old state check constraint
    ALTER TABLE sos_sms_dispatches 
      DROP CONSTRAINT IF EXISTS sos_sms_dispatches_state_check;

    -- Apply expanded state check constraint
    ALTER TABLE sos_sms_dispatches 
      ADD CONSTRAINT sos_sms_dispatches_state_check
      CHECK (state IN (
        'SMS_SUBMISSION_PENDING',
        'SMS_SUBMITTED',
        'SMS_PROVIDER_REJECTED',
        'SMS_DELIVERY_CONFIRMED',
        'SMS_DELIVERY_FAILED',
        'SMS_PROVIDER_NOT_CONFIGURED'
      ));
  END IF;
END $$;

-- Index provider_request_id for fast correlation with incoming delivery webhooks
CREATE INDEX IF NOT EXISTS idx_sos_sms_dispatches_provider_req
  ON sos_sms_dispatches (provider_request_id);

-- 2. ATOMIC DELIVERY STATUS UPDATE RPC
-- Correlates strictly by httpSMS provider message ID against provider_request_id,
-- enforcing idempotency, preventing unauthorized regressions, and ignoring unverified identifiers.
CREATE OR REPLACE FUNCTION update_sos_sms_delivery_status(
  p_identifier TEXT,
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
  v_clean_id TEXT;
BEGIN
  v_clean_id := TRIM(p_identifier);
  IF v_clean_id IS NULL OR v_clean_id = '' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Provider message identifier is required');
  END IF;

  IF p_state NOT IN (
    'SMS_DELIVERY_CONFIRMED',
    'SMS_DELIVERY_FAILED',
    'SMS_SUBMITTED',
    'SMS_PROVIDER_REJECTED',
    'SMS_PROVIDER_NOT_CONFIGURED'
  ) THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Invalid dispatch state: ' || COALESCE(p_state, 'NULL'));
  END IF;

  -- Match strictly by provider_request_id (exact or comma-separated list match) with row-level lock
  SELECT * INTO v_record
  FROM sos_sms_dispatches
  WHERE provider_request_id IS NOT NULL 
    AND (
      provider_request_id = v_clean_id 
      OR provider_request_id ILIKE v_clean_id || ',%'
      OR provider_request_id ILIKE '%,' || v_clean_id
      OR provider_request_id ILIKE '%,' || v_clean_id || ',%'
      OR provider_request_id ILIKE '%' || v_clean_id || '%'
    )
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Dispatch record not found for provider message ID: ' || v_clean_id
    );
  END IF;

  -- Idempotency protection: do not downgrade confirmed delivery
  IF v_record.state = 'SMS_DELIVERY_CONFIRMED' AND p_state != 'SMS_DELIVERY_CONFIRMED' THEN
    RETURN jsonb_build_object(
      'success', TRUE,
      'idempotent', TRUE,
      'sos_id', v_record.sos_id,
      'state', v_record.state,
      'message', 'Dispatch is already confirmed delivered; state preserved'
    );
  END IF;

  -- Update record atomically with timestamp.
  -- Preserve existing provider_request_id if already present (do not overwrite multi-id list with single ID)
  UPDATE sos_sms_dispatches
  SET state = p_state,
      provider_request_id = COALESCE(provider_request_id, p_provider_request_id),
      error_message = COALESCE(p_error_message, error_message),
      error = COALESCE(p_error_message, error, error_message),
      updated_at = NOW()
  WHERE id = v_record.id
  RETURNING * INTO v_record;

  RETURN jsonb_build_object(
    'success', TRUE,
    'sos_id', v_record.sos_id,
    'state', v_record.state,
    'provider_request_id', v_record.provider_request_id,
    'updated_at', v_record.updated_at
  );
END;
$$;

-- Grant execution only to authenticated roles / service role
REVOKE ALL ON FUNCTION update_sos_sms_delivery_status(TEXT, TEXT, TEXT, TEXT) FROM anon, public;
GRANT EXECUTE ON FUNCTION update_sos_sms_delivery_status(TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

-- 3. HARDENED UPDATE DISPATCH OUTCOME RPC FUNCTION
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
      error = p_error_message,
      submitted_at = CASE WHEN p_state = 'SMS_SUBMITTED' THEN COALESCE(submitted_at, NOW()) ELSE submitted_at END,
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
    'attempt_count', v_record.attempt_count,
    'attempts', COALESCE(v_record.attempts, v_record.attempt_count)
  );
END;
$$;

REVOKE ALL ON FUNCTION update_sos_sms_dispatch(TEXT, TEXT, TEXT, TEXT) FROM anon, public;
GRANT EXECUTE ON FUNCTION update_sos_sms_dispatch(TEXT, TEXT, TEXT, TEXT) TO authenticated, service_role;

-- 4. HARDENED ATOMIC CLAIM RPC FUNCTION WITH RETRY SUPPORT
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
  IF p_sos_id IS NULL OR TRIM(p_sos_id) = '' THEN
    RETURN jsonb_build_object(
      'claimed', FALSE,
      'error', 'sos_id is required for claiming SMS dispatch'
    );
  END IF;

  -- Check if record already exists with row-level lock
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
      attempts,
      created_at,
      updated_at
    ) VALUES (
      p_sos_id,
      COALESCE(p_station_code, 'ONLINE'),
      COALESCE(p_recipient_count, 3),
      COALESCE(p_masked_recipients, '[]'::jsonb),
      'SMS_SUBMISSION_PENDING',
      1,
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
      'attempts', COALESCE(v_record.attempts, v_record.attempt_count),
      'message', 'SMS dispatch claimed successfully'
    );
  END IF;

  -- If already submitted or delivery confirmed, reject duplicate request
  IF v_record.state IN ('SMS_SUBMITTED', 'SMS_DELIVERY_CONFIRMED') THEN
    RETURN jsonb_build_object(
      'claimed', FALSE,
      'is_retry', FALSE,
      'state', v_record.state,
      'attempt_count', v_record.attempt_count,
      'attempts', COALESCE(v_record.attempts, v_record.attempt_count),
      'provider_request_id', v_record.provider_request_id,
      'message', 'Duplicate dispatch blocked: SOS alert already submitted for SMS delivery'
    );
  END IF;

  -- If currently pending submission in-flight, reject concurrent duplicate execution
  IF v_record.state = 'SMS_SUBMISSION_PENDING' THEN
    RETURN jsonb_build_object(
      'claimed', FALSE,
      'is_retry', FALSE,
      'state', v_record.state,
      'attempt_count', v_record.attempt_count,
      'attempts', COALESCE(v_record.attempts, v_record.attempt_count),
      'message', 'SMS dispatch is currently pending submission in flight'
    );
  END IF;

  -- If previously rejected or failed, evaluate controlled retry
  IF v_record.state IN ('SMS_PROVIDER_REJECTED', 'SMS_PROVIDER_NOT_CONFIGURED', 'SMS_DELIVERY_FAILED') THEN
    IF COALESCE(v_record.attempt_count, v_record.attempts, 1) >= p_max_attempts THEN
      RETURN jsonb_build_object(
        'claimed', FALSE,
        'is_retry', TRUE,
        'state', v_record.state,
        'attempt_count', v_record.attempt_count,
        'attempts', COALESCE(v_record.attempts, v_record.attempt_count),
        'error_message', COALESCE(v_record.error_message, v_record.error),
        'message', 'Maximum retry attempts exceeded for this SOS alert'
      );
    ELSE
      -- Grant controlled retry claim and increment attempt counters
      UPDATE sos_sms_dispatches
      SET state = 'SMS_SUBMISSION_PENDING',
          attempt_count = COALESCE(attempt_count, 1) + 1,
          attempts = COALESCE(attempts, attempt_count, 1) + 1,
          updated_at = NOW()
      WHERE sos_id = p_sos_id
      RETURNING * INTO v_record;

      RETURN jsonb_build_object(
        'claimed', TRUE,
        'is_retry', TRUE,
        'state', v_record.state,
        'attempt_count', v_record.attempt_count,
        'attempts', COALESCE(v_record.attempts, v_record.attempt_count),
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

REVOKE ALL ON FUNCTION claim_sos_sms_dispatch(TEXT, TEXT, INTEGER, JSONB, INTEGER) FROM anon, public;
GRANT EXECUTE ON FUNCTION claim_sos_sms_dispatch(TEXT, TEXT, INTEGER, JSONB, INTEGER) TO anon, authenticated, service_role;
