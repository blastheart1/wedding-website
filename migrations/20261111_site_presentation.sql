-- Additive, non-destructive revision-11 CMS extension.
-- Review against the intended database and take a backup before applying.
-- This file is NOT automatically run by next build or application startup.
BEGIN;
ALTER TABLE wedding_config ADD COLUMN IF NOT EXISTS site_presentation text;
COMMIT;
