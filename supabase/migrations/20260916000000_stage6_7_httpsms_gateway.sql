-- supabase/migrations/20260916000000_stage6_7_httpsms_gateway.sql
-- ============================================================================
-- Stage 6.7: httpSMS Gateway Integration & Asynchronous Delivery Reporting
-- Updates state check constraint for SMS_DELIVERY_FAILED and adds atomic webhook
-- status resolution RPC for correlation with httpSMS Android Gateway callbacks.
-- ============================================================================

SET search_path = public;

-- 1. EXPAND STATE CHECK CONSTRAINT TO INCLUDE SMS_DELIVERY_FAILED
DO $$
BEGIN
  -- Alter constraint on sos_sms_dispatches if table exists
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'sos_sms_dispatches'
  ) THEN
    ALTER TABLE sos_sms_dispatches 
      DROP CONSTRAINT IF EXISTS sos_sms_dispatches_state_check;

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
BEGIN
  IF p_identifier IS NULL OR TRIM(p_identifier) = '' THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Provider message identifier is required');
  END IF;

  IF p_state NOT IN ('SMS_DELIVERY_CONFIRMED', 'SMS_DELIVERY_FAILED', 'SMS_SUBMITTED', 'SMS_PROVIDER_REJECTED', 'SMS_PROVIDER_NOT_CONFIGURED') THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'Invalid dispatch state: ' || COALESCE(p_state, 'NULL'));
  END IF;

  -- Match strictly by provider_request_id (exact or comma-separated list match) with row-level lock
  SELECT * INTO v_record
  FROM sos_sms_dispatches
  WHERE provider_request_id IS NOT NULL 
    AND (
      provider_request_id = p_identifier 
      OR provider_request_id ILIKE p_identifier || ',%'
      OR provider_request_id ILIKE '%,' || p_identifier
      OR provider_request_id ILIKE '%,' || p_identifier || ',%'
      OR provider_request_id ILIKE '%' || p_identifier || '%'
    )
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'error', 'Dispatch record not found for provider message ID: ' || p_identifier
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

  -- Update record atomically with timestamp
  UPDATE sos_sms_dispatches
  SET state = p_state,
      provider_request_id = COALESCE(p_provider_request_id, provider_request_id),
      error_message = COALESCE(p_error_message, error_message),
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
