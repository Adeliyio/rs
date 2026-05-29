-- Migration: 00006_create_audit_log_protection
-- Description: Trigger to prevent UPDATE or DELETE on audit_log rows (append-only)
-- Reverse: DROP TRIGGER audit_log_immutable ON audit_log; DROP FUNCTION prevent_audit_log_mutation();

CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only. UPDATE and DELETE operations are not permitted.';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_immutable
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_log_mutation();
