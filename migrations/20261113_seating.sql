-- Seat plan: tables on the floor, who sits where, and the plan's settings.
-- Creates three empty tables and their indexes. No existing table, column or
-- row is read or changed. Idempotent.
-- Review against the intended database before applying.
-- This file is NOT automatically run by next build or application startup.
BEGIN;
CREATE TABLE IF NOT EXISTS seating_tables (
  id serial PRIMARY KEY,
  label varchar(60) NOT NULL,
  shape varchar(20) NOT NULL DEFAULT 'round',
  chairs integer NOT NULL DEFAULT 10,
  x integer NOT NULL DEFAULT 0,
  y integer NOT NULL DEFAULT 0,
  rotation integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS seating_assignments (
  id serial PRIMARY KEY,
  invitation_id integer NOT NULL REFERENCES invitations (id) ON DELETE CASCADE,
  person_index integer NOT NULL DEFAULT 0,
  table_id integer NOT NULL REFERENCES seating_tables (id) ON DELETE CASCADE,
  chair integer NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS seating_assignments_person_unique ON seating_assignments (invitation_id, person_index);
CREATE UNIQUE INDEX IF NOT EXISTS seating_assignments_chair_unique ON seating_assignments (table_id, chair);
CREATE TABLE IF NOT EXISTS seating_plan (
  id serial PRIMARY KEY,
  data text NOT NULL,
  updated_at timestamp NOT NULL DEFAULT now()
);
COMMIT;
