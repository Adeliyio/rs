-- Migration: 00002_create_tables
-- Description: Create all 14 application tables
-- Reverse: DROP TABLE in reverse dependency order (see bottom of file)

-- 1. cases
CREATE TABLE cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  status case_status NOT NULL DEFAULT 'intake',
  wedge wedge_type NOT NULL,
  jurisdiction text NOT NULL,
  diagnostic_state jsonb,
  payment_status payment_status NOT NULL DEFAULT 'pending',
  paddle_transaction_id text,
  preview_shown_at timestamptz,
  refusal_trigger text,
  total_ai_cost decimal NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

-- 2. documents
CREATE TABLE documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES cases (id) ON DELETE CASCADE,
  file_path text NOT NULL,
  content_type text,
  parse_status parse_status NOT NULL DEFAULT 'pending',
  parsed_json jsonb,
  confirmed_json jsonb,
  authenticity_ack boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

-- 3. letters
CREATE TABLE letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES cases (id) ON DELETE CASCADE,
  content text NOT NULL,
  pdf_url text,
  grounding_context_ids text[],
  citation_validation jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

-- 4. sequences
CREATE TABLE sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES cases (id) ON DELETE CASCADE,
  vertical text NOT NULL,
  current_step integer NOT NULL DEFAULT 1,
  next_send_at timestamptz,
  steps jsonb NOT NULL,
  grounding_context_ids text[],
  citation_validation jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

-- 5. packets
CREATE TABLE packets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES cases (id) ON DELETE CASCADE,
  venue text NOT NULL,
  type text NOT NULL,
  bundle_url text,
  template_version text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

-- 6. deadline_events
CREATE TABLE deadline_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES cases (id) ON DELETE CASCADE,
  deadline_date date NOT NULL,
  timezone text NOT NULL,
  anchor_event text NOT NULL,
  prompt_message text NOT NULL,
  fired_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 7. case_status_history
CREATE TABLE case_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES cases (id) ON DELETE CASCADE,
  previous_status case_status NOT NULL,
  new_status case_status NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

-- 8. outcomes
CREATE TABLE outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL UNIQUE REFERENCES cases (id) ON DELETE CASCADE,
  stage text NOT NULL,
  outcome_category text NOT NULL,
  recovered_amount decimal,
  testimonial text,
  consent jsonb,
  outcome_verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 9. subscriptions
CREATE TABLE subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  paddle_subscription_id text NOT NULL UNIQUE,
  plan text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 10. waitlist_entries
CREATE TABLE waitlist_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  state text NOT NULL,
  wedge wedge_type NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 11. audit_log
CREATE TABLE audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid,
  user_id uuid,
  correlation_id uuid,
  generation_inputs_hash text,
  grounding_context_ids text[],
  model_version text,
  prompt_version text,
  citation_validation_result jsonb,
  ai_cost decimal,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 12. webhook_events
CREATE TABLE webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL UNIQUE,
  provider text NOT NULL,
  payload jsonb NOT NULL,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 13. tavily_cache
CREATE TABLE tavily_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query_hash text NOT NULL UNIQUE,
  domain_filter text,
  results jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

-- 14. login_attempts
CREATE TABLE login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  ip_address inet NOT NULL,
  user_agent text,
  success boolean NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

-- Reverse migration (manual):
-- DROP TABLE login_attempts;
-- DROP TABLE tavily_cache;
-- DROP TABLE webhook_events;
-- DROP TABLE audit_log;
-- DROP TABLE waitlist_entries;
-- DROP TABLE subscriptions;
-- DROP TABLE outcomes;
-- DROP TABLE case_status_history;
-- DROP TABLE deadline_events;
-- DROP TABLE packets;
-- DROP TABLE sequences;
-- DROP TABLE letters;
-- DROP TABLE documents;
-- DROP TABLE cases;
