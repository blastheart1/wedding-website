/**
 * Database access for invitation code. The shared client is configured with
 * `cache: 'no-store'` so every query reaches the database; this module keeps
 * a single import point so a regression test can guard that guarantee.
 */
export { getDb as getInviteDb, schema } from '@/lib/db'
