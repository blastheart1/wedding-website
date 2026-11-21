-- Named plus ones: the people the couple names for each guest, as a JSON list.
-- Adds one nullable column to invitations. No existing row is read or changed:
-- an invitation without the list behaves exactly as before. Idempotent.
-- Apply this BEFORE deploying the code that reads it: the guest page selects the column.
-- This file is NOT automatically run by next build or application startup.
BEGIN;
ALTER TABLE invitations ADD COLUMN IF NOT EXISTS plus_ones text;
COMMIT;
