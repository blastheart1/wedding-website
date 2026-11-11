#!/usr/bin/env node
// Explicit, idempotent migration runner for the legacy schema-push repo.
// No network or writes by default. Applying requires both --apply and --target-host.
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { spawnSync } = require('node:child_process')
const dotenv = require('dotenv')
const root = path.resolve(__dirname, '..')

// Ordered. Each file is pinned by SHA-256: an edited file is refused until this
// list is reviewed and updated. `creates` is what the read-only audit reports as
// missing while the migration is pending; anything else missing blocks the run.
const MIGRATIONS = [
  {
    file: 'migrations/20261111_site_presentation.sql',
    sha256: 'ac8a49838c46c24f104c71bf732fb8c9f7dcc1565a65b57ae60fbed65efe6226',
    summary: ['wedding_config.site_presentation TEXT NULL'],
    creates: { tables: [], columns: ['wedding_config.site_presentation'] },
    extraPending: () => false,
  },
  {
    file: 'migrations/20261112_invitations.sql',
    sha256: 'd740fc8d716a2a53fb2a644c0397c55e246842d8d2ac4be8b899317154426a97',
    summary: [
      'new empty tables: invitations, invitation_events, invite_settings, rate_limits',
      'rsvps: nullable invitation_id, party_size, companions, acknowledged_at, updated_at',
      'rsvps.email: NOT NULL removed (unique index kept)',
    ],
    creates: {
      tables: ['invitations', 'invitation_events', 'invite_settings', 'rate_limits'],
      columns: ['rsvps.invitation_id', 'rsvps.party_size', 'rsvps.companions', 'rsvps.acknowledged_at', 'rsvps.updated_at'],
    },
    extraPending: database => database.rsvpEmailNullable === false,
  },
]

function readStatements(migration) {
  const raw = fs.readFileSync(path.join(root, migration.file), 'utf8')
  if (crypto.createHash('sha256').update(raw).digest('hex') !== migration.sha256) {
    throw new Error('Migration content changed. Review and update the guarded runner before applying.')
  }
  return raw.replace(/^\s*--.*$/gm, '').split(';').map(sql => sql.trim())
    .filter(sql => sql && !['BEGIN', 'COMMIT'].includes(sql.toUpperCase()))
}

function isPending(migration, database) {
  return migration.creates.tables.some(table => database.missingTables.includes(table)) ||
    migration.creates.columns.some(column => database.missingColumns.includes(column)) ||
    migration.extraPending(database)
}

function audit() {
  const check = spawnSync(process.execPath, [path.join(root, 'scripts/check-infrastructure.cjs'), '--database'], {
    cwd: root, encoding: 'utf8', timeout: 45_000,
  })
  let result
  try { result = JSON.parse(check.stdout) } catch { throw new Error('Read-only schema check did not complete. No migration was applied.') }
  if (!result.database?.reachable) throw new Error('Database is not reachable. No migration was applied.')
  return result.database
}

async function main() {
  const args = process.argv.slice(2)
  const apply = args.includes('--apply')
  const check = args.includes('--check')
  const plan = args.includes('--plan') || (!apply && !check)
  const valueOf = prefix => args.find(arg => arg.startsWith(prefix))?.slice(prefix.length)
  const targetHost = valueOf('--target-host=')
  const onlyFile = valueOf('--file=')
  if (args.some(arg => !['--apply', '--check', '--plan'].includes(arg) && !arg.startsWith('--target-host=') && !arg.startsWith('--file=')) ||
      [args.includes('--apply'), args.includes('--check'), args.includes('--plan')].filter(Boolean).length > 1) {
    throw new Error('Choose one of --plan, --check, or --apply --target-host=<exact database hostname> [--file=<migration file>].')
  }
  // Fail before any database connection if the irreversible mode lacks a target check.
  if (apply && !targetHost) throw new Error('Applying requires --apply --target-host=<exact database hostname>. No migration was applied.')
  const selected = onlyFile ? MIGRATIONS.filter(migration => migration.file === onlyFile || path.basename(migration.file) === onlyFile) : MIGRATIONS
  if (!selected.length) throw new Error('Choose one of the known migration files with --file=. No migration was applied.')
  const statements = new Map(MIGRATIONS.map(migration => [migration.file, readStatements(migration)]))
  if (plan) {
    console.log(JSON.stringify({ mode: 'offline plan', applied: false, migrations: selected.map(migration => ({
      file: migration.file, changes: migration.summary, statements: statements.get(migration.file),
    })) }, null, 2))
    return
  }

  const envPath = path.join(root, '.env.local')
  const env = { ...(fs.existsSync(envPath) ? dotenv.parse(fs.readFileSync(envPath)) : {}), ...process.env }
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is missing. No migration was applied.')
  if (apply && new URL(env.DATABASE_URL).hostname !== targetHost) {
    throw new Error('The expected target host does not match DATABASE_URL. No migration was applied.')
  }
  const before = audit()
  // Only objects that a known pending migration creates may be absent.
  const expectedTables = new Set(MIGRATIONS.flatMap(migration => migration.creates.tables))
  const expectedColumns = new Set(MIGRATIONS.flatMap(migration => migration.creates.columns))
  const unexpectedTables = before.missingTables.filter(table => !expectedTables.has(table))
  const unexpectedColumns = before.missingColumns.filter(column => !expectedColumns.has(column))
  if (unexpectedTables.length || unexpectedColumns.length || !before.rsvpEmailUnique || !before.guestEmailUnique) {
    console.log(JSON.stringify({ mode: 'baseline blocked', applied: false, missingTables: unexpectedTables, missingColumns: unexpectedColumns,
      rsvpEmailUnique: before.rsvpEmailUnique, guestEmailUnique: before.guestEmailUnique }, null, 2))
    throw new Error('Existing schema is incomplete. Review baseline setup; this runner never seeds or repairs unrelated tables.')
  }
  const pending = selected.filter(migration => isPending(migration, before))
  if (!apply || !pending.length) {
    console.log(JSON.stringify({ mode: apply ? 'already current' : 'read-only check', applied: false,
      pending: pending.map(migration => migration.file) }, null, 2))
    if (check && pending.length) process.exitCode = 1
    return
  }

  const { neon } = require('@neondatabase/serverless')
  const sql = neon(env.DATABASE_URL)
  const applied = []
  // One transaction per file, in order. A failure stops before the next file.
  for (const migration of pending) {
    await sql.transaction(statements.get(migration.file).map(statement => sql(statement, [])), {
      readOnly: false, fetchOptions: { signal: AbortSignal.timeout(30000) },
    })
    if (isPending(migration, audit())) throw new Error('Migration outcome is uncertain. Re-run --check before any retry.')
    applied.push(migration.file)
  }
  console.log(JSON.stringify({ mode: 'applied', applied: true, files: applied }, null, 2))
}

main().catch(error => {
  // Only show our own diagnostic strings. External database messages may contain secrets.
  const safe = /^(Choose one|Applying requires|Migration content|DATABASE_URL is missing|The expected target|Read-only schema|Database is not reachable|Existing schema is incomplete|Migration outcome)/.test(error?.message || '')
  console.error(safe ? error.message : 'Migration did not complete. Its outcome may be uncertain; run --check before retrying. No credentials were logged.')
  process.exitCode = 1
})
