-- Migration: 00008_create_law_monitor_tables.sql
-- Purpose: Add tables for the automated law monitoring system.
-- Reverse: DROP TABLE statute_monitor_alerts; DROP TABLE statute_monitor_runs; DROP TYPE monitor_run_status; DROP TYPE alert_severity; DROP TYPE alert_status;

/* ------------------------------------------------------------------ */
/*  Enums                                                             */
/* ------------------------------------------------------------------ */

CREATE TYPE monitor_run_status AS ENUM (
  'running',
  'completed',
  'failed'
);

CREATE TYPE alert_severity AS ENUM (
  'info',
  'warning',
  'critical'
);

CREATE TYPE alert_status AS ENUM (
  'new',
  'acknowledged',
  'dismissed'
);

/* ------------------------------------------------------------------ */
/*  statute_monitor_runs — tracks each monitoring cycle               */
/* ------------------------------------------------------------------ */

CREATE TABLE statute_monitor_runs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at    timestamptz NOT NULL DEFAULT now(),
  completed_at  timestamptz,
  statutes_checked integer NOT NULL DEFAULT 0,
  changes_detected integer NOT NULL DEFAULT 0,
  status        monitor_run_status NOT NULL DEFAULT 'running',
  error         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

/* ------------------------------------------------------------------ */
/*  statute_monitor_alerts — one row per detected change              */
/* ------------------------------------------------------------------ */

CREATE TABLE statute_monitor_alerts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id          uuid NOT NULL REFERENCES statute_monitor_runs(id) ON DELETE CASCADE,
  statute_id      text NOT NULL,
  citation        text NOT NULL,
  jurisdiction    text NOT NULL,
  kb_entry_id     text NOT NULL,
  change_summary  text NOT NULL,
  change_details  jsonb NOT NULL DEFAULT '{}',
  severity        alert_severity NOT NULL DEFAULT 'info',
  confidence      numeric(3,2) NOT NULL DEFAULT 0.00,
  source_urls     text[] NOT NULL DEFAULT '{}',
  status          alert_status NOT NULL DEFAULT 'new',
  acknowledged_at timestamptz,
  acknowledged_by text,
  dismiss_reason  text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

/* ------------------------------------------------------------------ */
/*  Indexes                                                           */
/* ------------------------------------------------------------------ */

-- Query alerts by status for admin dashboard
CREATE INDEX idx_monitor_alerts_status ON statute_monitor_alerts (status);

-- Query alerts by run
CREATE INDEX idx_monitor_alerts_run_id ON statute_monitor_alerts (run_id);

-- Query alerts by statute for dedup window
CREATE INDEX idx_monitor_alerts_statute ON statute_monitor_alerts (statute_id, created_at DESC);

-- Query runs by status and date
CREATE INDEX idx_monitor_runs_status ON statute_monitor_runs (status, started_at DESC);

/* ------------------------------------------------------------------ */
/*  RLS — service role only (admin/worker context)                    */
/* ------------------------------------------------------------------ */

ALTER TABLE statute_monitor_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE statute_monitor_alerts ENABLE ROW LEVEL SECURITY;

-- No user-facing RLS policies: these tables are accessed only via
-- the service-role client in workers and admin API routes.
-- Admin reads are gated by requireAdmin() in the API route layer.
