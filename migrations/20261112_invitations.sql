-- Personal invitations: links, QR, tracking, plus seats, acknowledgement.
-- Creates four empty tables, adds five nullable columns to rsvps, and makes
-- rsvps.email optional (guests invited by Messenger/Instagram have no email).
-- No existing row is read or changed. Idempotent.
-- Review against the intended database and take a backup before applying.
-- This file is NOT automatically run by next build or application startup.
BEGIN;
CREATE TABLE IF NOT EXISTS invitations (
  id serial PRIMARY KEY,
  guest_name varchar(255) NOT NULL,
  email varchar(255),
  phone varchar(32),
  seats integer NOT NULL DEFAULT 1,
  token_hash varchar(64) NOT NULL,
  token_enc text NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'active',
  guest_list_id integer,
  sent_at timestamp,
  last_channel varchar(20),
  first_opened_at timestamp,
  last_opened_at timestamp,
  open_count integer NOT NULL DEFAULT 0,
  responded_at timestamp,
  link_requested_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS invitations_token_hash_unique ON invitations (token_hash);
CREATE UNIQUE INDEX IF NOT EXISTS invitations_email_unique ON invitations (email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS invitations_phone_unique ON invitations (phone) WHERE phone IS NOT NULL;
CREATE TABLE IF NOT EXISTS invitation_events (
  id serial PRIMARY KEY,
  invitation_id integer NOT NULL REFERENCES invitations (id) ON DELETE CASCADE,
  type varchar(40) NOT NULL,
  channel varchar(20),
  meta text,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS invitation_events_invitation_idx ON invitation_events (invitation_id);
CREATE TABLE IF NOT EXISTS invite_settings (
  id serial PRIMARY KEY,
  data text NOT NULL,
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS rate_limits (
  key varchar(255) PRIMARY KEY,
  window_start timestamp NOT NULL,
  count integer NOT NULL DEFAULT 0
);
ALTER TABLE rsvps ADD COLUMN IF NOT EXISTS invitation_id integer;
ALTER TABLE rsvps ADD COLUMN IF NOT EXISTS party_size integer;
ALTER TABLE rsvps ADD COLUMN IF NOT EXISTS companions text;
ALTER TABLE rsvps ADD COLUMN IF NOT EXISTS acknowledged_at timestamp;
ALTER TABLE rsvps ADD COLUMN IF NOT EXISTS updated_at timestamp;
CREATE UNIQUE INDEX IF NOT EXISTS rsvps_invitation_unique ON rsvps (invitation_id) WHERE invitation_id IS NOT NULL;
ALTER TABLE rsvps ALTER COLUMN email DROP NOT NULL;
COMMIT;
