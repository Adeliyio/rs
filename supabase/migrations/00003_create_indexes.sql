-- Migration: 00003_create_indexes
-- Description: Create all required indexes per database-schema-rules.md §3
-- Reverse: DROP INDEX for each index created below

-- User lookups (even with RLS, these speed up queries)
CREATE INDEX idx_cases_user_id ON cases (user_id);
CREATE INDEX idx_cases_payment ON cases (user_id, payment_status);
CREATE INDEX idx_documents_case_id ON documents (case_id);
CREATE INDEX idx_letters_case_id ON letters (case_id);
CREATE INDEX idx_sequences_case_id ON sequences (case_id);
CREATE INDEX idx_packets_case_id ON packets (case_id);

-- Deadline engine
CREATE INDEX idx_deadline_events_date ON deadline_events (deadline_date) WHERE fired_at IS NULL;

-- Waitlist demand signal
CREATE INDEX idx_waitlist_state_wedge ON waitlist_entries (state, wedge);

-- Outcome tracking
CREATE INDEX idx_outcomes_case_id ON outcomes (case_id);

-- Audit log (query by case for debugging)
CREATE INDEX idx_audit_log_case_id ON audit_log (case_id);
CREATE INDEX idx_audit_log_created_at ON audit_log (created_at);
