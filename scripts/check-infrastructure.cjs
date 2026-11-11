#!/usr/bin/env node
// Read-only readiness audit. Never executes DDL/DML, seeds, or migrations.
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
const dotenv = require('dotenv')
const { getTableColumns, getTableName, is } = require('drizzle-orm')
const { PgTable } = require('drizzle-orm/pg-core')
const root = path.resolve(__dirname, '..')
const envPath = path.join(root, '.env.local')
const env = { ...(fs.existsSync(envPath) ? dotenv.parse(fs.readFileSync(envPath)) : {}), ...process.env }
const required = ['DATABASE_URL', 'JWT_SECRET', 'ADMIN_PASSWORD_HASH']
const uploads = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET', 'NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME']
const report = {
  mode: process.argv.includes('--database') ? 'read-only database metadata' : 'offline configuration',
  missingRequiredEnvironment: required.filter(key => !env[key]),
  missingUploadEnvironment: uploads.filter(key => !env[key]),
  jwtSecretStrongLength: Buffer.byteLength(env.JWT_SECRET || '') >= 32,
  // In .env files Next.js expands a dollar sign, so a bcrypt hash is written there with each one escaped by a backslash. Accept that form.
  adminPasswordHashValidFormat: /^\$2[aby]\$\d\d\$/.test((env.ADMIN_PASSWORD_HASH || '').split(String.fromCharCode(92, 36)).join(String.fromCharCode(36))),
  cloudinaryNamesMatch: !!env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_CLOUD_NAME === env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  database: null,
}

function loadSchema() {
  const filename = path.join(root, 'src/lib/schema.ts')
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: filename,
  }).outputText
  const loaded = new Module(filename, module)
  loaded.filename = filename
  loaded.paths = Module._nodeModulePaths(path.dirname(filename))
  loaded._compile(output, filename)
  return Object.values(loaded.exports).filter(value => is(value, PgTable))
}

async function main() {
  if (process.argv.includes('--database')) {
    if (!env.DATABASE_URL) throw new Error('DATABASE_URL is missing')
    const { neon } = require('@neondatabase/serverless')
    const sql = neon(env.DATABASE_URL)
    // Neon sends a PostgreSQL READ ONLY transaction for every audit query.
    const [columns, indexes] = await sql.transaction([
      sql("SELECT table_name, column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema = 'public'", []),
      sql("SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename IN ('rsvps', 'guest_list')", []),
    ], { readOnly: true, fetchOptions: { signal: AbortSignal.timeout(15000) } })
    const missingTables = [], missingColumns = []
    for (const table of loadSchema()) {
      const name = getTableName(table)
      const actual = new Set(columns.filter(row => row.table_name === name).map(row => row.column_name))
      if (actual.size === 0) { missingTables.push(name); continue }
      for (const column of Object.values(getTableColumns(table))) {
        if (!actual.has(column.name)) missingColumns.push(name + '.' + column.name)
      }
    }
    const hasEmailUnique = table => indexes.some(row => row.tablename === table && /CREATE UNIQUE INDEX/i.test(row.indexdef) && /\(email\)/i.test(row.indexdef))
    report.database = {
      reachable: true, readOnly: true, missingTables, missingColumns,
      rsvpEmailUnique: hasEmailUnique('rsvps'),
      guestEmailUnique: hasEmailUnique('guest_list'),
      // Informational for the invitations migration; never affects the exit code.
      rsvpEmailNullable: columns.some(row => row.table_name === 'rsvps' && row.column_name === 'email' && row.is_nullable === 'YES'),
    }
    if (process.argv.includes('--public-content') && !missingTables.includes('wedding_config')) {
      const wanted = ['partner1', 'partner2', 'wedding_date', 'ceremony_time', 'reception_time', 'ceremony_venue', 'reception_venue', 'location', 'dress_code', 'rsvp_access_mode']
      const present = new Set(columns.filter(row => row.table_name === 'wedding_config').map(row => row.column_name))
      const selected = wanted.filter(name => present.has(name))
      if (selected.length) {
        const [publicRows] = await sql.transaction([
          sql('SELECT ' + selected.join(', ') + ' FROM wedding_config LIMIT 1', []),
        ], { readOnly: true, fetchOptions: { signal: AbortSignal.timeout(15000) } })
        report.database.publicConfig = publicRows[0] || null
      }
      const mediaColumns = ['hero_video_url', 'hero_bg_url', 'story_bg_url', 'countdown_bg_url', 'details_bg_url', 'gallery_bg_url', 'faq_bg_url', 'rsvp_bg_url'].filter(name => present.has(name))
      if (mediaColumns.length) {
        const selection = mediaColumns.map(name => "(COALESCE(TRIM(" + name + "), '') <> '') AS " + name).join(', ')
        const [presence] = await sql.transaction([sql('SELECT ' + selection + ' FROM wedding_config LIMIT 1', [])], { readOnly: true, fetchOptions: { signal: AbortSignal.timeout(15000) } })
        report.database.publicMediaConfigured = presence[0] || null
      }
    }
  }
  console.log(JSON.stringify(report, null, 2))
  const db = report.database
  if (report.missingRequiredEnvironment.length || report.missingUploadEnvironment.length || !report.jwtSecretStrongLength || !report.adminPasswordHashValidFormat ||
      !report.cloudinaryNamesMatch || (db && (db.missingTables.length || db.missingColumns.length || !db.rsvpEmailUnique || !db.guestEmailUnique))) process.exitCode = 1
}

main().catch(error => {
  // Never print connection strings, credentials, raw server errors, or guest data.
  report.database = { reachable: false, readOnly: true, errorType: error?.constructor?.name || 'Error', errorCode: typeof error?.code === 'string' ? error.code : undefined }
  console.log(JSON.stringify(report, null, 2))
  process.exitCode = 1
})
