-- Migration: 00005_create_rls_policies
-- Description: Enable RLS on all tables and create access policies per database-schema-rules.md §9
-- Reverse: DROP POLICY on each table, then ALTER TABLE ... DISABLE ROW LEVEL SECURITY

-- =============================================================================
-- Enable RLS on ALL tables
-- =============================================================================

ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE letters ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE packets ENABLE ROW LEVEL SECURITY;
ALTER TABLE deadline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE tavily_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- cases: direct user_id ownership check + soft-delete filter
-- =============================================================================

CREATE POLICY "Users can select own non-deleted cases"
  ON cases FOR SELECT
  USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "Users can insert own cases"
  ON cases FOR INSERT
  WITH CHECK (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "Users can update own non-deleted cases"
  ON cases FOR UPDATE
  USING (auth.uid() = user_id AND deleted_at IS NULL)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own non-deleted cases"
  ON cases FOR DELETE
  USING (auth.uid() = user_id AND deleted_at IS NULL);

-- =============================================================================
-- documents: ownership via cases join
-- =============================================================================

CREATE POLICY "Users can select own documents"
  ON documents FOR SELECT
  USING (
    auth.uid() = (SELECT user_id FROM cases WHERE id = documents.case_id AND deleted_at IS NULL)
  );

CREATE POLICY "Users can insert own documents"
  ON documents FOR INSERT
  WITH CHECK (
    auth.uid() = (SELECT user_id FROM cases WHERE id = documents.case_id AND deleted_at IS NULL)
  );

CREATE POLICY "Users can update own documents"
  ON documents FOR UPDATE
  USING (
    auth.uid() = (SELECT user_id FROM cases WHERE id = documents.case_id AND deleted_at IS NULL)
  )
  WITH CHECK (
    auth.uid() = (SELECT user_id FROM cases WHERE id = documents.case_id AND deleted_at IS NULL)
  );

CREATE POLICY "Users can delete own documents"
  ON documents FOR DELETE
  USING (
    auth.uid() = (SELECT user_id FROM cases WHERE id = documents.case_id AND deleted_at IS NULL)
  );

-- =============================================================================
-- letters: ownership via cases join
-- =============================================================================

CREATE POLICY "Users can select own letters"
  ON letters FOR SELECT
  USING (
    auth.uid() = (SELECT user_id FROM cases WHERE id = letters.case_id AND deleted_at IS NULL)
  );

CREATE POLICY "Users can insert own letters"
  ON letters FOR INSERT
  WITH CHECK (
    auth.uid() = (SELECT user_id FROM cases WHERE id = letters.case_id AND deleted_at IS NULL)
  );

CREATE POLICY "Users can update own letters"
  ON letters FOR UPDATE
  USING (
    auth.uid() = (SELECT user_id FROM cases WHERE id = letters.case_id AND deleted_at IS NULL)
  )
  WITH CHECK (
    auth.uid() = (SELECT user_id FROM cases WHERE id = letters.case_id AND deleted_at IS NULL)
  );

CREATE POLICY "Users can delete own letters"
  ON letters FOR DELETE
  USING (
    auth.uid() = (SELECT user_id FROM cases WHERE id = letters.case_id AND deleted_at IS NULL)
  );

-- =============================================================================
-- sequences: ownership via cases join
-- =============================================================================

CREATE POLICY "Users can select own sequences"
  ON sequences FOR SELECT
  USING (
    auth.uid() = (SELECT user_id FROM cases WHERE id = sequences.case_id AND deleted_at IS NULL)
  );

CREATE POLICY "Users can insert own sequences"
  ON sequences FOR INSERT
  WITH CHECK (
    auth.uid() = (SELECT user_id FROM cases WHERE id = sequences.case_id AND deleted_at IS NULL)
  );

CREATE POLICY "Users can update own sequences"
  ON sequences FOR UPDATE
  USING (
    auth.uid() = (SELECT user_id FROM cases WHERE id = sequences.case_id AND deleted_at IS NULL)
  )
  WITH CHECK (
    auth.uid() = (SELECT user_id FROM cases WHERE id = sequences.case_id AND deleted_at IS NULL)
  );

CREATE POLICY "Users can delete own sequences"
  ON sequences FOR DELETE
  USING (
    auth.uid() = (SELECT user_id FROM cases WHERE id = sequences.case_id AND deleted_at IS NULL)
  );

-- =============================================================================
-- packets: ownership via cases join
-- =============================================================================

CREATE POLICY "Users can select own packets"
  ON packets FOR SELECT
  USING (
    auth.uid() = (SELECT user_id FROM cases WHERE id = packets.case_id AND deleted_at IS NULL)
  );

CREATE POLICY "Users can insert own packets"
  ON packets FOR INSERT
  WITH CHECK (
    auth.uid() = (SELECT user_id FROM cases WHERE id = packets.case_id AND deleted_at IS NULL)
  );

CREATE POLICY "Users can update own packets"
  ON packets FOR UPDATE
  USING (
    auth.uid() = (SELECT user_id FROM cases WHERE id = packets.case_id AND deleted_at IS NULL)
  )
  WITH CHECK (
    auth.uid() = (SELECT user_id FROM cases WHERE id = packets.case_id AND deleted_at IS NULL)
  );

CREATE POLICY "Users can delete own packets"
  ON packets FOR DELETE
  USING (
    auth.uid() = (SELECT user_id FROM cases WHERE id = packets.case_id AND deleted_at IS NULL)
  );

-- =============================================================================
-- deadline_events: ownership via cases join
-- =============================================================================

CREATE POLICY "Users can select own deadline events"
  ON deadline_events FOR SELECT
  USING (
    auth.uid() = (SELECT user_id FROM cases WHERE id = deadline_events.case_id AND deleted_at IS NULL)
  );

CREATE POLICY "Users can insert own deadline events"
  ON deadline_events FOR INSERT
  WITH CHECK (
    auth.uid() = (SELECT user_id FROM cases WHERE id = deadline_events.case_id AND deleted_at IS NULL)
  );

CREATE POLICY "Users can update own deadline events"
  ON deadline_events FOR UPDATE
  USING (
    auth.uid() = (SELECT user_id FROM cases WHERE id = deadline_events.case_id AND deleted_at IS NULL)
  )
  WITH CHECK (
    auth.uid() = (SELECT user_id FROM cases WHERE id = deadline_events.case_id AND deleted_at IS NULL)
  );

CREATE POLICY "Users can delete own deadline events"
  ON deadline_events FOR DELETE
  USING (
    auth.uid() = (SELECT user_id FROM cases WHERE id = deadline_events.case_id AND deleted_at IS NULL)
  );

-- =============================================================================
-- case_status_history: ownership via cases join
-- =============================================================================

CREATE POLICY "Users can select own case status history"
  ON case_status_history FOR SELECT
  USING (
    auth.uid() = (SELECT user_id FROM cases WHERE id = case_status_history.case_id AND deleted_at IS NULL)
  );

CREATE POLICY "Users can insert own case status history"
  ON case_status_history FOR INSERT
  WITH CHECK (
    auth.uid() = (SELECT user_id FROM cases WHERE id = case_status_history.case_id AND deleted_at IS NULL)
  );

CREATE POLICY "Users can update own case status history"
  ON case_status_history FOR UPDATE
  USING (
    auth.uid() = (SELECT user_id FROM cases WHERE id = case_status_history.case_id AND deleted_at IS NULL)
  )
  WITH CHECK (
    auth.uid() = (SELECT user_id FROM cases WHERE id = case_status_history.case_id AND deleted_at IS NULL)
  );

CREATE POLICY "Users can delete own case status history"
  ON case_status_history FOR DELETE
  USING (
    auth.uid() = (SELECT user_id FROM cases WHERE id = case_status_history.case_id AND deleted_at IS NULL)
  );

-- =============================================================================
-- outcomes: ownership via cases join
-- =============================================================================

CREATE POLICY "Users can select own outcomes"
  ON outcomes FOR SELECT
  USING (
    auth.uid() = (SELECT user_id FROM cases WHERE id = outcomes.case_id AND deleted_at IS NULL)
  );

CREATE POLICY "Users can insert own outcomes"
  ON outcomes FOR INSERT
  WITH CHECK (
    auth.uid() = (SELECT user_id FROM cases WHERE id = outcomes.case_id AND deleted_at IS NULL)
  );

CREATE POLICY "Users can update own outcomes"
  ON outcomes FOR UPDATE
  USING (
    auth.uid() = (SELECT user_id FROM cases WHERE id = outcomes.case_id AND deleted_at IS NULL)
  )
  WITH CHECK (
    auth.uid() = (SELECT user_id FROM cases WHERE id = outcomes.case_id AND deleted_at IS NULL)
  );

CREATE POLICY "Users can delete own outcomes"
  ON outcomes FOR DELETE
  USING (
    auth.uid() = (SELECT user_id FROM cases WHERE id = outcomes.case_id AND deleted_at IS NULL)
  );

-- =============================================================================
-- subscriptions: direct user_id ownership check
-- =============================================================================

CREATE POLICY "Users can select own subscriptions"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscriptions"
  ON subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscriptions"
  ON subscriptions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own subscriptions"
  ON subscriptions FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================================================
-- waitlist_entries: INSERT for any authenticated, SELECT only via service role
-- =============================================================================

CREATE POLICY "Authenticated users can insert waitlist entries"
  ON waitlist_entries FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- No SELECT/UPDATE/DELETE policies for waitlist_entries.
-- Only the service role (which bypasses RLS) can read waitlist data.

-- =============================================================================
-- Service-role-only tables: audit_log, webhook_events, tavily_cache, login_attempts
-- No user policies — RLS is enabled but only service role (which bypasses RLS) can access.
-- =============================================================================

-- audit_log: no user policies (service role only)
-- webhook_events: no user policies (service role only)
-- tavily_cache: no user policies (service role only)
-- login_attempts: no user policies (service role only)
