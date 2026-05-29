-- Migration: 00001_create_enums
-- Description: Create custom enum types for the Resolvaio schema
-- Reverse: DROP TYPE case_status, payment_status, parse_status, wedge_type;

CREATE TYPE case_status AS ENUM ('intake', 'generated', 'sent', 'awaiting', 'escalation_drafted', 'resolved', 'closed');
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'refunded');
CREATE TYPE parse_status AS ENUM ('pending', 'parsed', 'confirmed', 'failed');
CREATE TYPE wedge_type AS ENUM ('deposit', 'subscription');
