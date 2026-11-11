# Revision 11 infrastructure validation

## Commands

- `node --test scripts/test-rsvp.cjs`: production RSVP handlers compiled in memory,
  with fake database/network dependencies. No guest data, network or database writes.
- `node scripts/check-infrastructure.cjs`: offline environment presence/format audit.
  Values and secrets are never printed. A nonzero exit indicates incomplete readiness.
- `node scripts/check-infrastructure.cjs --database`: explicit read-only PostgreSQL
  metadata check against the selected DATABASE_URL. All queries use READ ONLY transactions.
- Add `--public-content` only to inspect public wedding settings and media presence;
  it does not query RSVP records or the private guest list.
- `npx tsc --noEmit`, `npm run lint`, `npm run build`: application validation.
  Build success is not evidence of database reachability, migration completion or uploads.

## Required deployment configuration

The admin uses ADMIN_PASSWORD_HASH (bcrypt), not the obsolete ADMIN_PASSWORD.
Set JWT_SECRET to a strong random value of at least 32 bytes. Do not change existing
production secrets as part of this UI migration. DATABASE_URL supplies Neon/Drizzle.

Cloudinary uploads need CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY,
CLOUDINARY_API_SECRET and matching NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME. Existing public
image URLs can render even when upload credentials are absent. NEXT_PUBLIC_BASE_URL
should match the deployed site. Verify deployment environment separately from .env.local.

The repository has no committed Vercel project binding or CI workflow. Confirm the
hosting project, branch and environment before deploying; repository edits do not
authorize a push or deployment.

## RSVP guarantees and limits

Both email lookup and submission apply the same guest allow/block and open/mixed/
invite-only policy. Submission reloads the policy, normalizes email/name, validates
lengths, ignores forged access/seat fields, and uses the email unique index to prevent
duplicate insertion. A database failure fails closed with a retryable error.

The email gate is invitation lookup, not proof of mailbox ownership. Names and seats
for an allowed email remain part of the legacy API contract. The rate limiter is
bounded and per process; it is not a distributed anti-abuse service, CAPTCHA, or
identity-verification flow. A platform-level rate limit or verified invitation token
is a separate hardening project. RSVP editing and deadline enforcement were not
implemented by the old API and are not added by this integration.

Tests cover direct POST bypass, blocked/uninvited submissions, policy changes after
lookup, changed email, duplicate/race handling, malformed/overlong input, database
failures, successful/declined responses and throttling. They do not insert synthetic
guests into the real database.

## Database changes

See `migrations/README.md`. The optional site_presentation column is additive.
Do not run db:push, db:migrate or db:seed against a shared/live database as a test.
