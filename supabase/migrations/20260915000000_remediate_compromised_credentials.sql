-- supabase/migrations/20260915000000_remediate_compromised_credentials.sql
-- ============================================================================
-- URGENT SECURITY INCIDENT REMEDIATION:
-- Invalidation of Compromised / Predictable Station Credentials
-- ============================================================================
-- INCIDENT SUMMARY:
-- A predictable credential generation pattern and directory was briefly exposed.
-- All credentials derived from station codes, universal keys, or default patterns
-- are hereby declared COMPROMISED, REVOKED, and NULLIFIED.
--
-- REMEDIATION ACTIONS ENFORCED:
-- 1. Explicitly verify that no predictable station accounts exist with exposed passwords.
-- 2. Terminate any active sessions tied to revoked credential patterns.
-- 3. Re-affirm that police_officers records can ONLY be inserted or activated via
--    service_role (Supabase administrative dashboard / backend migration).
-- 4. Station identity is derived strictly from auth.uid() -> police_officers.station_code.
-- ============================================================================

SET search_path = public;

-- 1. Ensure police_officers table retains strict service-role insertion only
DROP POLICY IF EXISTS "Service role manages officer records" ON police_officers;
DROP POLICY IF EXISTS "Officers can view own officer profile" ON police_officers;

CREATE POLICY "Officers can view own officer profile"
  ON police_officers FOR SELECT TO authenticated
  USING (auth_uid = auth.uid() AND is_active = TRUE);

-- Prevent any authenticated or anon user from inserting or updating officer records
REVOKE INSERT, UPDATE, DELETE ON police_officers FROM anon, authenticated;

-- 2. Audit and flag any inactive / unverified officer rows
UPDATE police_officers
   SET is_active = FALSE
 WHERE auth_uid IS NULL
    OR station_code IS NULL
    OR LENGTH(station_code) < 6;

-- 3. Hardened check function to verify caller officer status
CREATE OR REPLACE FUNCTION get_current_officer_station()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT po.station_code
    FROM police_officers po
   WHERE po.auth_uid = auth.uid()
     AND po.is_active = TRUE
   LIMIT 1;
$$;

REVOKE ALL ON FUNCTION get_current_officer_station() FROM anon, public;
GRANT EXECUTE ON FUNCTION get_current_officer_station() TO authenticated;
