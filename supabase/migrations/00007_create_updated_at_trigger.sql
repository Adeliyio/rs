-- Migration: 00007_create_updated_at_trigger
-- Description: Auto-update updated_at on tables that have it
-- Reverse: DROP TRIGGER on each table, then DROP FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- cases
CREATE TRIGGER trg_cases_updated_at
  BEFORE UPDATE ON cases
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- documents
CREATE TRIGGER trg_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- letters
CREATE TRIGGER trg_letters_updated_at
  BEFORE UPDATE ON letters
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- sequences
CREATE TRIGGER trg_sequences_updated_at
  BEFORE UPDATE ON sequences
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- packets
CREATE TRIGGER trg_packets_updated_at
  BEFORE UPDATE ON packets
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- outcomes
CREATE TRIGGER trg_outcomes_updated_at
  BEFORE UPDATE ON outcomes
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- subscriptions
CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
