-- Migration: 00004_create_unique_constraints
-- Description: Create unique constraints per database-schema-rules.md §6
-- Reverse: DROP CONSTRAINT / DROP INDEX for each constraint below

-- One waitlist entry per person per state per wedge
ALTER TABLE waitlist_entries
  ADD CONSTRAINT uq_waitlist_email_state_wedge
  UNIQUE (email, state, wedge);

-- One active case per user per combination (prevent duplicates)
-- Not a table-level unique because users may have historical resolved/closed cases
CREATE UNIQUE INDEX uq_active_case
  ON cases (user_id, wedge, jurisdiction)
  WHERE status NOT IN ('resolved', 'closed') AND deleted_at IS NULL;

-- Audit log correlation (unique per correlation_id for idempotent audit entries)
CREATE UNIQUE INDEX uq_audit_correlation
  ON audit_log (correlation_id);
