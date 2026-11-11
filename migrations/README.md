# Wedding database changes

The existing repository used Drizzle schema push and had no checked-in Drizzle
migration journal or snapshot. This revision does not fabricate a past migration
history or attempt to replay an initial schema over an existing database.

## Revision 11 extension: existing database

`20261111_site_presentation.sql` adds one nullable text column,
`wedding_config.site_presentation`, for validated JSON presentation settings.
It does not change existing records, RSVP fields, guests, gallery, FAQ or games.

The explicit runner is `node scripts/migrate.cjs` (also `npm run db:migrate`
when using the updated package scripts):

1. `node scripts/migrate.cjs --plan`: offline plan, no connection and no changes.
2. `node scripts/migrate.cjs --check`: PostgreSQL READ ONLY metadata check.
   Exit 1 means the migration is pending or the baseline is incomplete.
3. Select the intended staging database explicitly, verify its hostname privately,
   take the normal database backup, and review the SQL.
4. Only when that database change is authorized, run:
   `node scripts/migrate.cjs --apply --target-host=EXACT_DATABASE_HOSTNAME`
5. Re-run `node scripts/migrate.cjs --check`, then test CMS save/read on staging.

The runner refuses an incorrect target hostname, altered SQL, absent baseline
tables/columns or missing email unique indexes. It changes only the optional column
and is idempotent. It is not called by application startup, build or tests.
Do not log or paste the full database URL. If apply has an uncertain outcome,
check before retrying.

The public application reads older schemas without this optional column. New
presentation settings cannot be saved until the migration is applied. This tolerance
is not evidence that the deployment migration has completed.

## Genuinely empty development database

For an explicitly selected empty, disposable development database, the existing
`npm run db:push` followed by `npm run db:seed` creates the schema from
`src/lib/schema.ts` and minimal wedding config. Then run
`node scripts/check-infrastructure.cjs --database`.
These are deliberate setup writes, not validation tests. Never run them against
an existing shared or production database merely to make a build pass.

## Future history

Before introducing Drizzle-generated migration history to an existing database,
establish and review its actual schema baseline/snapshot. Do not mark an unexecuted
initial migration as applied. The guarded additive runner provides the reproducible
existing-database path for this one change without inventing that baseline.

## Personal invitations: existing database

`20261112_invitations.sql` creates four empty tables (`invitations`,
`invitation_events`, `invite_settings`, `rate_limits`), adds five nullable columns
to `rsvps`, and removes NOT NULL from `rsvps.email` (the unique index stays).
It reads and changes no existing row.

The runner now handles an ordered list of files, each pinned by SHA-256. An edited
SQL file is refused until `scripts/migrate.cjs` is reviewed and updated.

- `node scripts/migrate.cjs --plan` shows every file; add `--file=<name>` for one.
- `node scripts/migrate.cjs --check` lists the pending files (exit 1 if any).
- `node scripts/migrate.cjs --apply --target-host=EXACT_HOST [--file=<name>]`
  applies pending files in order, one transaction per file.

**Order matters: apply this migration before deploying the code that uses it.**
The application names every `rsvps` column when it inserts, so new code against
an unmigrated database fails RSVP submissions and the admin RSVP list. The reverse
is safe: old code ignores the new tables and columns.

Before applying, take the snapshot used by the rollback:

```sql
CREATE TABLE rsvps_backup_20261112 AS SELECT * FROM rsvps;
```

Rollback (only after confirming no RSVP has a null email):

```sql
ALTER TABLE rsvps DROP COLUMN IF EXISTS invitation_id, DROP COLUMN IF EXISTS party_size,
  DROP COLUMN IF EXISTS companions, DROP COLUMN IF EXISTS acknowledged_at, DROP COLUMN IF EXISTS updated_at;
ALTER TABLE rsvps ALTER COLUMN email SET NOT NULL;
DROP TABLE IF EXISTS invitation_events, invitations, invite_settings, rate_limits;
```
