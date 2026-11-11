const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const crypto = require('node:crypto')
const { spawnSync } = require('node:child_process')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')

// Compile production modules in memory; nothing here touches a database or network.
function load(relative, overrides = {}, cache = new Map(), env = {}, extra = {}) {
  const filename = path.join(root, relative)
  if (cache.has(filename)) return cache.get(filename)
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    fileName: filename,
  }).outputText
  const module = { exports: {} }
  const localRequire = name => {
    if (Object.prototype.hasOwnProperty.call(overrides, name)) return overrides[name]
    if (name.startsWith('@/')) return load('src/' + name.slice(2) + '.ts', overrides, cache, env, extra)
    if (name.startsWith('./')) return load(path.join(path.dirname(relative), name + '.ts'), overrides, cache, env, extra)
    return require(name)
  }
  vm.runInNewContext(output, {
    module, exports: module.exports, require: localRequire, process: { env },
    Date, Map, Set, Error, SyntaxError, Buffer, URL, JSON, Math, console, Response, setTimeout, AbortSignal, encodeURIComponent, ...extra,
  }, { filename })
  cache.set(filename, module.exports)
  return module.exports
}

const KEY = 'test-only-invite-token-key-0123456789abcdef'
const plain = value => JSON.parse(JSON.stringify(value))

// ─── Token ────────────────────────────────────────────────────────────────────
test('token: issued link token round-trips and is stored only hashed and encrypted', () => {
  const tokens = load('src/lib/invitations/token.ts', {}, new Map(), { INVITE_TOKEN_KEY: KEY })
  const issued = tokens.issueToken()
  assert.match(issued.token, /^[A-Za-z0-9_-]{22}$/)
  assert.equal(issued.tokenHash, crypto.createHash('sha256').update(issued.token).digest('hex'))
  assert.ok(!issued.tokenEnc.includes(issued.token))
  assert.equal(tokens.decryptToken(issued.tokenEnc), issued.token)
  assert.equal(tokens.inviteUrl(issued.token, 'https://example.test/'), 'https://example.test/i/' + issued.token)
})

test('token: every token is unique and two encryptions of one token differ', () => {
  const tokens = load('src/lib/invitations/token.ts', {}, new Map(), { INVITE_TOKEN_KEY: KEY })
  const seen = new Set(Array.from({ length: 500 }, () => tokens.generateToken()))
  assert.equal(seen.size, 500)
  assert.notEqual(tokens.encryptToken('a'.repeat(22)), tokens.encryptToken('a'.repeat(22)))
})

test('token: malformed, tampered and wrong-key values are refused', () => {
  const tokens = load('src/lib/invitations/token.ts', {}, new Map(), { INVITE_TOKEN_KEY: KEY })
  for (const bad of ['', 'short', 'a'.repeat(23), 'a'.repeat(21) + '/', null, undefined, 42, '../../etc/passwd']) {
    assert.equal(tokens.isTokenShape(bad), false)
  }
  const issued = tokens.issueToken()
  const parts = issued.tokenEnc.split('.')
  const flipped = parts[3][0] === 'A' ? 'B' : 'A'
  assert.throws(() => tokens.decryptToken([parts[0], parts[1], parts[2], flipped + parts[3].slice(1)].join('.')))
  assert.throws(() => tokens.decryptToken('v0.' + parts.slice(1).join('.')), /unreadable/)
  const other = load('src/lib/invitations/token.ts', {}, new Map(), { INVITE_TOKEN_KEY: KEY + 'x' })
  assert.throws(() => other.decryptToken(issued.tokenEnc))
})

test('token: a missing or short encryption key fails loudly instead of storing weak data', () => {
  for (const env of [{}, { INVITE_TOKEN_KEY: 'too-short' }]) {
    const tokens = load('src/lib/invitations/token.ts', {}, new Map(), env)
    assert.throws(() => tokens.encryptToken('a'.repeat(22)), /INVITE_TOKEN_KEY/)
  }
})

// ─── Phone and contact ────────────────────────────────────────────────────────
test('phone: common Philippine formats normalise to one value', () => {
  const { normalizePhone } = load('src/lib/invitations/phone.ts')
  for (const input of ['09171234567', '0917 123 4567', '0917-123-4567', '9171234567', '639171234567', '+639171234567', '+63 917 123 4567', '(0917) 123.4567']) {
    assert.equal(normalizePhone(input), '+639171234567', input)
  }
  assert.equal(normalizePhone('+1 415 555 0123'), '+14155550123')
})

test('phone: invalid numbers are rejected, not guessed', () => {
  const { normalizePhone } = load('src/lib/invitations/phone.ts')
  for (const input of ['', '   ', '12345', '0917123456', '091712345678', '+63 2 8123 4567', 'call me', '0917123456a', '+12']) {
    assert.equal(normalizePhone(input), null, input)
  }
})

test('contact: one field accepts an email or a phone and nothing else', () => {
  const { normalizeContact } = load('src/lib/invitations/phone.ts')
  assert.deepEqual(plain(normalizeContact('  Maria@Example.COM ')), { kind: 'email', value: 'maria@example.com' })
  assert.deepEqual(plain(normalizeContact('0917 123 4567')), { kind: 'phone', value: '+639171234567' })
  for (const input of ['maria', 'maria@', '@example.com', 'a@b', 'mar ia@example.com', '%', "' OR 1=1 --"]) {
    assert.equal(normalizeContact(input), null, input)
  }
})

// ─── RSVP rules ───────────────────────────────────────────────────────────────
const policyModule = () => load('src/lib/invitations/policy.ts')
const base = { attending: 'yes', partySize: 1, companions: [], acknowledged: true }

test('rsvp: guest uses 2 of 3 seats and names the extra guest', () => {
  const { inviteRsvpSchema, checkInviteRsvp } = policyModule()
  const input = inviteRsvpSchema.parse({ ...base, partySize: 2, companions: ['  Jose Rizal '], dietary: ' no pork ', songRequest: '' })
  const result = checkInviteRsvp(input, 3)
  assert.equal(result.ok, true)
  assert.deepEqual(plain(result.values), { attending: true, partySize: 2, companions: ['Jose Rizal'], dietary: 'no pork' })
})

test('rsvp: declining needs no party size and stores none', () => {
  const { inviteRsvpSchema, checkInviteRsvp } = policyModule()
  const result = checkInviteRsvp(inviteRsvpSchema.parse({ attending: 'no', acknowledged: true, message: 'Sorry!' }), 2)
  assert.deepEqual(plain(result), { ok: true, values: { attending: false, partySize: 0, companions: [], message: 'Sorry!' } })
})

test('rsvp: party size above the invitation seats is rejected', () => {
  const { inviteRsvpSchema, checkInviteRsvp } = policyModule()
  const input = inviteRsvpSchema.parse({ ...base, partySize: 3, companions: ['Guest One', 'Guest Two'] })
  const result = checkInviteRsvp(input, 2)
  assert.equal(result.ok, false)
  assert.match(result.message, /2 seats/)
  assert.equal(checkInviteRsvp(inviteRsvpSchema.parse({ ...base, partySize: 2, companions: ['Guest One'] }), 1).ok, false)
})

test('rsvp: extra guests must each be named, no more and no fewer', () => {
  const { inviteRsvpSchema, checkInviteRsvp } = policyModule()
  assert.equal(checkInviteRsvp(inviteRsvpSchema.parse({ ...base, partySize: 2 }), 3).ok, false)
  assert.equal(checkInviteRsvp(inviteRsvpSchema.parse({ ...base, partySize: 1, companions: ['Stowaway Guest'] }), 3).ok, false)
  assert.equal(inviteRsvpSchema.safeParse({ ...base, partySize: 2, companions: ['x'] }).success, false)
})

test('rsvp: acknowledgement is required and cannot be faked with other truthy values', () => {
  const { inviteRsvpSchema } = policyModule()
  for (const acknowledged of [false, undefined, 'true', 1, null]) {
    const parsed = inviteRsvpSchema.safeParse({ ...base, acknowledged })
    assert.equal(parsed.success, false, String(acknowledged))
  }
  assert.match(inviteRsvpSchema.safeParse({ ...base, acknowledged: false }).error.errors[0].message, /confirm/)
})

test('rsvp: malformed input is rejected at the boundary', () => {
  const { inviteRsvpSchema } = policyModule()
  for (const bad of [
    { ...base, attending: 'maybe' }, { ...base, partySize: 0 }, { ...base, partySize: 1.5 }, { ...base, partySize: 21 },
    { ...base, partySize: '2' }, { ...base, companions: 'Jose' }, { ...base, message: 'x'.repeat(2001) }, { ...base, dietary: 'x'.repeat(501) },
  ]) assert.equal(inviteRsvpSchema.safeParse(bad).success, false, JSON.stringify(bad).slice(0, 60))
})

// ─── Deadline ─────────────────────────────────────────────────────────────────
test('deadline: the day ends at midnight in Manila whatever the visitor timezone', () => {
  const { deadlineInstant, isPastDeadline } = policyModule()
  const end = Date.UTC(2027, 0, 27, 16) // 28 Jan 00:00 Manila
  for (const text of ['January 27, 2027', 'Jan 27, 2027', 'january 27 2027', 'January 27th, 2027', '2027-01-27', '  January 27, 2027 ']) {
    assert.equal(deadlineInstant(text), end, text)
  }
  assert.equal(isPastDeadline('January 27, 2027', end - 1), false)
  assert.equal(isPastDeadline('January 27, 2027', end), true)
})

test('deadline: unreadable or impossible dates enforce nothing', () => {
  const { deadlineInstant, isPastDeadline } = policyModule()
  for (const text of [null, undefined, '', 'soon', 'February 30, 2027', '2027-13-01', 'Smarch 3, 2027', '27/01/2027']) {
    assert.equal(deadlineInstant(text), null, String(text))
    assert.equal(isPastDeadline(text, Date.UTC(2099, 0, 1)), false)
  }
})

test('names: first name and plus count', () => {
  const { firstName, plusCount } = policyModule()
  assert.equal(firstName('  Maria Clara Santos '), 'Maria')
  assert.equal(firstName(''), '')
  assert.deepEqual([1, 2, 5, 0].map(plusCount), [0, 1, 4, 0])
})

// ─── Settings ─────────────────────────────────────────────────────────────────
test('settings: templates fill known placeholders and drop unknown ones', () => {
  const { renderTemplate, DEFAULT_INVITE_SETTINGS } = load('src/lib/invitations/settings.ts')
  assert.equal(renderTemplate(DEFAULT_INVITE_SETTINGS.previewTitle, { firstName: 'Maria' }), "Maria, you're invited")
  assert.equal(renderTemplate('Hi {firstName} {secret}, see {link}', { firstName: 'Maria', link: 'L' }), 'Hi Maria , see L')
  assert.equal(renderTemplate('{constructor}{__proto__}', {}).includes('function'), false)
})

test('settings: defaults are valid and stored JSON is validated, not trusted', () => {
  const { parseInviteSettings, inviteSettingsSchema, DEFAULT_INVITE_SETTINGS } = load('src/lib/invitations/settings.ts')
  assert.equal(inviteSettingsSchema.safeParse(DEFAULT_INVITE_SETTINGS).success, true)
  assert.equal(parseInviteSettings(JSON.stringify({ previewTitle: 'Hello {firstName}' })).previewTitle, 'Hello {firstName}')
  assert.equal(parseInviteSettings(JSON.stringify({ previewTitle: 'Hello' })).acknowledgement, DEFAULT_INVITE_SETTINGS.acknowledgement)
  for (const raw of [null, '', '{not json', JSON.stringify({ previewTitle: '' }), JSON.stringify({ dos: 'nope' }), JSON.stringify({ previewImageUrl: 'javascript:alert(1)' })]) {
    assert.deepEqual(plain(parseInviteSettings(raw)), plain(DEFAULT_INVITE_SETTINGS), String(raw))
  }
})

// ─── Migration runner (offline only) ──────────────────────────────────────────
const runMigrate = (...args) => spawnSync(process.execPath, [path.join(root, 'scripts/migrate.cjs'), ...args], { cwd: root, encoding: 'utf8', env: { ...process.env, DATABASE_URL: '' } })

test('migration: offline plan lists both files in order and applies nothing', () => {
  const result = runMigrate('--plan')
  assert.equal(result.status, 0, result.stderr)
  const plan = JSON.parse(result.stdout)
  assert.equal(plan.applied, false)
  assert.deepEqual(plan.migrations.map(item => item.file), ['migrations/20261111_site_presentation.sql', 'migrations/20261112_invitations.sql'])
  const statements = plan.migrations[1].statements
  assert.ok(statements.every(sql => /^(CREATE (TABLE|UNIQUE INDEX|INDEX) IF NOT EXISTS |ALTER TABLE rsvps (ADD COLUMN IF NOT EXISTS |ALTER COLUMN email DROP NOT NULL))/.test(sql)), 'only idempotent additive statements')
  assert.ok(!statements.some(sql => /\b(DROP TABLE|DROP COLUMN|DELETE FROM|UPDATE [a-z_]+ SET|TRUNCATE|INSERT INTO)\b/i.test(sql)))
  assert.equal(JSON.parse(runMigrate('--plan', '--file=20261112_invitations.sql').stdout).migrations.length, 1)
})

test('migration: apply without a target host, unknown flags and unknown files are refused before any connection', () => {
  for (const args of [['--apply'], ['--apply', '--check'], ['--force'], ['--plan', '--file=nope.sql']]) {
    const result = runMigrate(...args)
    assert.equal(result.status, 1, args.join(' '))
    assert.match(result.stderr, /^(Choose one|Applying requires)/)
  }
})

test('migration: schema.ts and the SQL file describe the same new columns', () => {
  const sql = fs.readFileSync(path.join(root, 'migrations/20261112_invitations.sql'), 'utf8')
  const schema = fs.readFileSync(path.join(root, 'src/lib/schema.ts'), 'utf8')
  const section = (source, start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)))
  const declared = [...section(schema, "'invitations',", '// Shared (cross-instance)').matchAll(/\('([a-z_]+)'/g)].map(match => match[1])
    .filter(name => !/^(invitations|invitation_events|invite_settings)$/.test(name) && !/_(unique|idx)$/.test(name))
  assert.ok(declared.length > 25)
  for (const column of [...declared, 'party_size', 'companions', 'acknowledged_at', 'window_start']) {
    assert.match(sql, new RegExp('\\b' + column + '\\b'), column)
  }
})

// ─── Guest flow (in-memory store; no database) ────────────────────────────────
const service = load('src/lib/invitations/service.ts', {}, new Map(), { INVITE_TOKEN_KEY: KEY })
const tokenLib = load('src/lib/invitations/token.ts', {}, new Map(), { INVITE_TOKEN_KEY: KEY })
const BROWSER = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'
const NOW = new Date(Date.UTC(2026, 11, 1, 4))

function memoryStore(options = {}) {
  const token = tokenLib.generateToken()
  const state = {
    token, lookups: 0, writes: 0, events: [], opens: 0, rsvp: null, deadline: 'January 27, 2027',
    invitation: { id: 7, guestName: 'Maria Clara Santos', email: null, seats: 3, status: 'active', tokenHash: tokenLib.hashToken(token),
      firstOpenedAt: null, lastOpenedAt: null, respondedAt: null },
    ...options,
  }
  const store = {
    async findByTokenHash(hash) { state.lookups++; return state.forceReturn || hash === state.invitation.tokenHash ? { ...state.invitation } : null },
    async findRsvp() { return state.rsvp && { ...state.rsvp } },
    async saveRsvp(invitation, values, existing, now) {
      state.writes++
      state.rsvp = { id: 1, attending: values.attending, partySize: values.partySize, companions: values.companions,
        dietary: values.dietary ?? null, songRequest: values.songRequest ?? null, message: values.message ?? null,
        updatedAt: now, createdAt: existing?.createdAt ?? now }
    },
    async markResponded(id, now) { state.invitation.respondedAt = now },
    async recordOpen(id, now) { state.opens++; state.invitation.firstOpenedAt ??= now; state.invitation.lastOpenedAt = now },
    async recordEvent(id, type) { state.events.push(type) },
    async deadlineText() { return state.deadline },
  }
  return { state, store }
}
const answer = { attending: 'yes', partySize: 2, companions: ['Jose Rizal'], acknowledged: true }

test('flow: guest opens the link, RSVPs for 2 of 3 seats, then edits before the deadline', async () => {
  const { state, store } = memoryStore()
  const view = await service.loadInviteView(store, state.token, NOW)
  assert.deepEqual(plain(view), { firstName: 'Maria', guestName: 'Maria Clara Santos', seats: 3, plus: 2, canEdit: true, deadline: 'January 27, 2027', response: null })

  const first = await service.submitInviteRsvp(store, state.token, answer, NOW)
  assert.equal(first.status, 200)
  assert.equal(first.body.data.response.partySize, 2)
  assert.deepEqual(plain(first.body.data.response.companions), ['Jose Rizal'])
  assert.equal(state.invitation.respondedAt, NOW)

  const later = new Date(NOW.getTime() + 86_400_000)
  const second = await service.submitInviteRsvp(store, state.token, { attending: 'no', acknowledged: true }, later)
  assert.equal(second.status, 200)
  assert.equal(second.body.data.response.attending, false)
  assert.equal(second.body.data.response.partySize, 0)
  assert.equal(state.invitation.respondedAt, NOW, 'first response time is kept')
  assert.deepEqual(state.events, ['responded', 'updated'])
  assert.equal(state.writes, 2)
})

test('flow: unknown, malformed and revoked links are indistinguishable and write nothing', async () => {
  const unknown = memoryStore()
  const revoked = memoryStore()
  revoked.state.invitation.status = 'revoked'
  const results = [
    await service.submitInviteRsvp(unknown.store, tokenLib.generateToken(), answer, NOW),
    await service.submitInviteRsvp(unknown.store, 'not-a-token', answer, NOW),
    await service.submitInviteRsvp(revoked.store, revoked.state.token, answer, NOW),
  ]
  for (const result of results) assert.deepEqual(plain(result), plain(results[0]))
  assert.equal(results[0].status, 404)
  assert.equal(unknown.state.writes + revoked.state.writes, 0)
  assert.equal(await service.loadInviteView(revoked.store, revoked.state.token, NOW), null)
})

test('flow: malformed tokens never reach the database', async () => {
  const { state, store } = memoryStore()
  for (const bad of ['', 'x', "' OR 1=1 --", 'a'.repeat(200), null, undefined, { $ne: null }]) {
    assert.equal(await service.resolveInvitation(store, bad), null)
  }
  assert.equal(state.lookups, 0)
})

test('flow: a row whose stored hash does not match the link is refused', async () => {
  const { state, store } = memoryStore({ forceReturn: true })
  assert.equal(await service.resolveInvitation(store, tokenLib.generateToken()), null)
  assert.ok(await service.resolveInvitation(store, state.token))
})

test('flow: seats come from the invitation, never from the request', async () => {
  const { state, store } = memoryStore()
  const result = await service.submitInviteRsvp(store, state.token,
    { ...answer, partySize: 4, companions: ['A Guest', 'B Guest', 'C Guest'], seats: 99 }, NOW)
  assert.equal(result.status, 400)
  assert.match(result.body.error, /3 seats/)
  assert.equal(state.writes, 0)
})

test('flow: after the deadline nothing can be created or changed, but the answer stays visible', async () => {
  const { state, store } = memoryStore()
  await service.submitInviteRsvp(store, state.token, answer, NOW)
  const after = new Date(Date.UTC(2027, 0, 27, 16))
  const result = await service.submitInviteRsvp(store, state.token, { attending: 'no', acknowledged: true }, after)
  assert.equal(result.status, 403)
  assert.equal(state.writes, 1)
  const view = await service.loadInviteView(store, state.token, after)
  assert.equal(view.canEdit, false)
  assert.equal(view.response.attending, true)
})

test('flow: missing acknowledgement or bad input is rejected before any write', async () => {
  const { state, store } = memoryStore()
  for (const payload of [{ ...answer, acknowledged: false }, { ...answer, acknowledged: undefined }, null, 'yes', [], { attending: 'yes' }]) {
    const result = await service.submitInviteRsvp(store, state.token, payload, NOW)
    assert.equal(result.status, 400)
  }
  assert.equal(state.writes, 0)
  assert.deepEqual(state.events, [])
})

test('tracking: link-preview robots are never counted as the guest opening the link', async () => {
  const { state, store } = memoryStore()
  for (const agent of ['facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)', 'Mozilla/5.0 (compatible; Instagram 300.0)', 'WhatsApp/2.23', 'TelegramBot (like TwitterBot)', 'curl/8.4.0', '', null, undefined]) {
    assert.equal(await service.recordInviteOpen(store, state.token, agent, NOW), false, String(agent))
  }
  assert.equal(state.opens, 0)
  assert.deepEqual(state.events, [])
})

test('tracking: real visits are counted; repeat visits within 30 minutes add no extra timeline entry', async () => {
  const { state, store } = memoryStore()
  const at = minutes => new Date(NOW.getTime() + minutes * 60_000)
  assert.equal(await service.recordInviteOpen(store, state.token, BROWSER, at(0)), true)
  await service.recordInviteOpen(store, state.token, BROWSER, at(5))
  await service.recordInviteOpen(store, state.token, BROWSER, at(40))
  assert.equal(state.opens, 3)
  assert.deepEqual(state.events, ['opened', 'opened'])
  assert.equal(state.invitation.firstOpenedAt.getTime(), at(0).getTime())
  assert.equal(await service.recordInviteOpen(store, tokenLib.generateToken(), BROWSER, at(41)), false)
})

test('guest page and endpoints: no token logging, no indexing, no caching', () => {
  const read = file => fs.readFileSync(path.join(root, file), 'utf8')
  const page = read('src/app/i/[token]/page.tsx')
  assert.match(page, /index: false/)
  assert.match(page, /referrer: 'no-referrer'/)
  for (const file of ['src/app/api/invite/[token]/rsvp/route.ts', 'src/app/api/invite/[token]/open/route.ts', 'src/app/i/[token]/page.tsx', 'src/lib/invitations/service.ts', 'src/lib/invitations/store.ts']) {
    const source = read(file)
    assert.ok(!/console\.(log|debug|info)/.test(source), file)
    assert.ok(!/console\.\w+\([^)]*(token|params)/.test(source), file + ' must not log the token')
  }
  assert.match(read('src/app/api/invite/[token]/open/route.ts'), /status: 204/)
})

// ─── Styled QR: every code must scan back to the exact link ───────────────────
const { Resvg } = require('@resvg/resvg-js')
const jsQR = require('jsqr')
const qr = load('src/lib/invitations/qr.ts', { qrcode: require('qrcode') })

function scan(svg, width, withFonts = false) {
  // System fonts are only needed to draw the monogram text, and loading them is slow.
  const image = new Resvg(svg, { fitTo: { mode: 'width', value: width }, font: { loadSystemFonts: withFonts } }).render()
  return jsQR(new Uint8ClampedArray(image.pixels), image.width, image.height)?.data ?? null
}

test('qr: styled codes decode to the exact invitation link at print and phone sizes', () => {
  const bases = ['https://luisandbee.wedding', 'https://a.co', 'https://a-very-long-preview-subdomain.vercel.app']
  for (const base of bases) {
    for (let index = 0; index < 6; index++) {
      const link = tokenLib.inviteUrl(tokenLib.generateToken(), base)
      for (const width of [220, 480, 1024]) {
        assert.equal(scan(qr.renderQrSvg(link), width), link, `${base} at ${width}px`)
      }
      if (index === 0) assert.equal(scan(qr.renderQrSvg(link, { monogram: 'L&B' }), 480, true), link, `${base} with monogram text`)
    }
  }
})

test('qr: the centre is cleared, the corners are custom markers, and the monogram is escaped', () => {
  const link = tokenLib.inviteUrl(tokenLib.generateToken(), 'https://luisandbee.wedding')
  const layout = qr.qrLayout(link)
  assert.equal(layout.viewBox, layout.size + 8)
  assert.equal((layout.size - layout.centre.side) % 2, 0)
  assert.ok(layout.centre.side / layout.size < 0.3)
  const svg = qr.renderQrSvg(link, { monogram: '<script>&"' })
  assert.ok(!svg.includes('<script>'))
  assert.equal((svg.match(/rx="2\.2"/g) || []).length, 3)
  const lo = layout.centre.start + 4, hi = lo + layout.centre.side
  for (const match of svg.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)"/g)) {
    const [x, y] = [Number(match[1]), Number(match[2])]
    assert.ok(!(x > lo && x < hi && y > lo && y < hi), 'no dot inside the centre square')
  }
  assert.equal(qr.coupleMonogram(' luis ', 'Bee'), 'L&B')
  assert.equal(qr.coupleMonogram('', 'Bee'), 'B')
})

test('qr: alignment markers sit at the standard positions and are drawn solid', () => {
  const sorted = list => plain(list).map(pair => pair.join(',')).sort()
  assert.deepEqual(sorted(qr.alignmentCentres(21)), [])
  assert.deepEqual(sorted(qr.alignmentCentres(25)), ['18,18'])
  assert.deepEqual(sorted(qr.alignmentCentres(41)), ['34,34'])
  assert.deepEqual(sorted(qr.alignmentCentres(45)), ['22,22', '22,38', '22,6', '38,22', '38,38', '6,22'].sort())
  const link = tokenLib.inviteUrl(tokenLib.generateToken(), 'https://luisandbee.wedding')
  assert.ok((qr.renderQrSvg(link).match(/rx="1\.2"/g) || []).length >= 1, 'solid alignment marker present')
})

// ─── Admin input ──────────────────────────────────────────────────────────────
const adminSchemas = load('src/lib/invitations/admin-schemas.ts')

test('admin: a guest is stored with normalised contacts and seats', () => {
  const guest = adminSchemas.guestInputSchema.parse({ guestName: '  Maria Santos ', email: ' Maria@Example.com', phone: '0917 123 4567', seats: 3 })
  assert.deepEqual(plain(guest), { guestName: 'Maria Santos', email: 'maria@example.com', phone: '+639171234567', seats: 3 })
  assert.deepEqual(plain(adminSchemas.guestInputSchema.parse({ guestName: 'Jo Cruz', email: '', phone: '  ' })), { guestName: 'Jo Cruz', email: null, phone: null, seats: 1 })
})

test('admin: bad names, contacts and seat counts are rejected with a clear message', () => {
  const parse = input => adminSchemas.guestInputSchema.safeParse(input)
  assert.match(parse({ guestName: 'Jo Cruz', email: 'not-an-email' }).error.errors[0].message, /email/)
  assert.match(parse({ guestName: 'Jo Cruz', phone: '12345' }).error.errors[0].message, /phone/)
  for (const bad of [{ guestName: 'J' }, { guestName: 'Jo Cruz', seats: 0 }, { guestName: 'Jo Cruz', seats: 21 }, { guestName: 'Jo Cruz', seats: 1.5 }, { guestName: 'x'.repeat(256) }, {}]) {
    assert.equal(parse(bad).success, false, JSON.stringify(bad).slice(0, 40))
  }
  assert.equal(adminSchemas.bulkInputSchema.safeParse({ guests: [] }).success, false)
  assert.equal(adminSchemas.bulkInputSchema.safeParse({ guests: Array.from({ length: 501 }, () => ({ guestName: 'Jo Cruz' })) }).success, false)
})

test('admin: update actions accept only known shapes', () => {
  const { updateInputSchema } = adminSchemas
  assert.equal(updateInputSchema.parse({ action: 'shared', id: 4, channel: 'messenger' }).channel, 'messenger')
  assert.equal(updateInputSchema.parse({ action: 'edit', id: 4, guestName: 'Jo Cruz', email: '', phone: '09171234567', seats: 2 }).phone, '+639171234567')
  for (const bad of [{ action: 'shared', id: 4, channel: 'sms' }, { action: 'delete', id: 4 }, { action: 'revoke', id: -1 }, { action: 'revoke', id: '4' }, { action: 'edit', id: 4 }, { id: 4 }]) {
    assert.equal(updateInputSchema.safeParse(bad).success, false, JSON.stringify(bad))
  }
})

test('admin: pasted lists become guests, with plus counts and per-line errors', () => {
  const { guests, errors } = adminSchemas.parseBulkLines([
    'Maria Santos, maria@example.com, 2',
    'Jose Rizal\t0917 123 4567',
    'Ana Cruz; +1',
    '',
    'Pedro Penduko, pedro@example.com, 0918 123 4567, 1',
    'X',
    'Dupe Guest, maria@example.com',
    'Bad Mail, nope@',
  ].join('\n'))
  assert.deepEqual(plain(guests), [
    { guestName: 'Maria Santos', email: 'maria@example.com', phone: null, seats: 3 },
    { guestName: 'Jose Rizal', email: null, phone: '+639171234567', seats: 1 },
    { guestName: 'Ana Cruz', email: null, phone: null, seats: 2 },
    { guestName: 'Pedro Penduko', email: 'pedro@example.com', phone: '+639181234567', seats: 2 },
  ])
  assert.deepEqual(plain(errors.map(issue => issue.line)), [6, 7, 8])
  assert.match(errors[1].message, /more than once/)
  assert.deepEqual(plain(adminSchemas.parseBulkLines('  \n\n')), { guests: [], errors: [] })
})

// ─── Public status lookup ─────────────────────────────────────────────────────
const lookup = load('src/lib/invitations/lookup.ts')

function lookupHarness(rows = {}) {
  const state = { counts: new Map(), keys: [], finds: 0, emails: [], requests: [], emailWorks: true }
  const deps = {
    async hit(key) { state.keys.push(key); const next = (state.counts.get(key) ?? 0) + 1; state.counts.set(key, next); return next },
    async findByContact(contact) { state.finds++; return rows[contact.value] ?? null },
    async emailLink(id) { state.emails.push(id); return state.emailWorks },
    async requestLink(id) { state.requests.push(id) },
  }
  return { state, deps }
}
const guests = {
  'maria@example.com': { id: 1, status: 'active', hasEmail: true, responded: true },
  '+639171234567': { id: 2, status: 'active', hasEmail: false, responded: false },
  'gone@example.com': { id: 3, status: 'revoked', hasEmail: true, responded: false },
}

test('lookup: an invited guest with an email is told their status and emailed their link once', async () => {
  const { state, deps } = lookupHarness(guests)
  const first = await lookup.lookupStatus(deps, ' Maria@Example.com ', '1.1.1.1', NOW)
  assert.deepEqual(plain(first), { status: 200, body: { success: true, data: { found: true, responded: true, delivery: 'email' } } })
  const again = await lookup.lookupStatus(deps, 'maria@example.com', '1.1.1.1', NOW)
  assert.equal(again.body.data.delivery, 'recent')
  assert.deepEqual(state.emails, [1], 'repeating the lookup must not send another email')
  assert.deepEqual(state.requests, [])
})

test('lookup: a guest without an email, or whose email fails, is flagged for the couple to message', async () => {
  const phone = lookupHarness(guests)
  const result = await lookup.lookupStatus(phone.deps, '0917 123 4567', '1.1.1.1', NOW)
  assert.deepEqual(plain(result.body.data), { found: true, responded: false, delivery: 'manual' })
  assert.deepEqual(phone.state.requests, [2])
  assert.deepEqual(phone.state.emails, [])
  const failing = lookupHarness(guests)
  failing.state.emailWorks = false
  assert.equal((await lookup.lookupStatus(failing.deps, 'maria@example.com', '1.1.1.1', NOW)).body.data.delivery, 'manual')
  assert.deepEqual(failing.state.requests, [1])
})

test('lookup: unknown and revoked contacts get the identical answer and reveal nothing', async () => {
  const { state, deps } = lookupHarness(guests)
  const unknown = await lookup.lookupStatus(deps, 'stranger@example.com', '1.1.1.1', NOW)
  const revoked = await lookup.lookupStatus(deps, 'gone@example.com', '2.2.2.2', NOW)
  assert.deepEqual(plain(unknown), plain(revoked))
  assert.deepEqual(plain(unknown.body.data), { found: false, responded: false, delivery: null })
  assert.deepEqual([state.emails, state.requests], [[], []])
  const text = JSON.stringify([unknown, await lookup.lookupStatus(deps, 'maria@example.com', '3.3.3.3', NOW)])
  assert.ok(!/Maria|seats|token|\/i\//i.test(text), 'no name, seat count or link in any lookup answer')
})

test('lookup: partial, malformed and non-text input never searches the guest list', async () => {
  const { state, deps } = lookupHarness(guests)
  for (const input of ['maria', 'maria@', 'mar', '%', '0917', "' OR 1=1 --", '', null, undefined, 42, { $ne: '' }, ['maria@example.com'], 'a'.repeat(300) + '@example.com']) {
    const result = await lookup.lookupStatus(deps, input, `10.0.0.${state.keys.length}`, NOW)
    assert.equal(result.status, 400, String(input))
  }
  assert.equal(state.finds, 0)
})

test('lookup: the sixth try in a window is refused, by address and by contact', async () => {
  const byIp = lookupHarness(guests)
  for (let attempt = 1; attempt <= 5; attempt++) assert.equal((await lookup.lookupStatus(byIp.deps, `guess${attempt}@example.com`, '9.9.9.9', NOW)).status, 200)
  assert.equal((await lookup.lookupStatus(byIp.deps, 'maria@example.com', '9.9.9.9', NOW)).status, 429)
  assert.equal(byIp.state.finds, 5)
  const byValue = lookupHarness(guests)
  for (let attempt = 1; attempt <= 5; attempt++) await lookup.lookupStatus(byValue.deps, 'maria@example.com', `8.8.8.${attempt}`, NOW)
  assert.equal((await lookup.lookupStatus(byValue.deps, 'maria@example.com', '8.8.8.99', NOW)).status, 429)
  assert.ok(byValue.state.keys.every(key => /^lookup:(ip|value):[0-9a-f]{40}$/.test(key)), 'rate-limit keys are hashes, never raw contacts or addresses')
})

// ─── Webhook signature ────────────────────────────────────────────────────────
const webhook = load('src/lib/invitations/webhook.ts')

test('webhook: only correctly signed, fresh requests are accepted', () => {
  const key = crypto.randomBytes(24)
  const secret = 'whsec_' + key.toString('base64')
  const nowMs = Date.UTC(2026, 10, 12)
  const timestamp = String(nowMs / 1000)
  const body = JSON.stringify({ type: 'email.delivered', data: { email_id: '4ef9a417-02e9-4d39-ad75-9611e0fcc33c' } })
  const sign = (content, k = key) => 'v1,' + crypto.createHmac('sha256', k).update(content).digest('base64')
  const headers = { id: 'msg_1', timestamp, signature: sign(`msg_1.${timestamp}.${body}`) }
  assert.equal(webhook.verifyWebhook(secret, headers, body, nowMs), true)
  assert.equal(webhook.verifyWebhook(secret, { ...headers, signature: 'v1,AAAA ' + headers.signature }, body, nowMs), true, 'any listed signature may match')
  assert.equal(webhook.verifyWebhook(secret, headers, body + ' ', nowMs), false, 'changed body')
  assert.equal(webhook.verifyWebhook(secret, { ...headers, id: 'msg_2' }, body, nowMs), false, 'changed id')
  assert.equal(webhook.verifyWebhook(secret, headers, body, nowMs + 6 * 60_000), false, 'stale')
  assert.equal(webhook.verifyWebhook(secret, { ...headers, signature: sign(`msg_1.${timestamp}.${body}`, crypto.randomBytes(24)) }, body, nowMs), false, 'wrong key')
  for (const missing of [undefined, '', 'whsec_']) assert.equal(webhook.verifyWebhook(missing, headers, body, nowMs), false)
  for (const field of ['id', 'timestamp', 'signature']) assert.equal(webhook.verifyWebhook(secret, { ...headers, [field]: null }, body, nowMs), false)
  assert.deepEqual(plain(webhook.parseDeliveryEvent(body)), { type: 'email_delivered', emailId: '4ef9a417-02e9-4d39-ad75-9611e0fcc33c' })
  for (const other of ['{', '{}', JSON.stringify({ type: 'email.opened', data: { email_id: 'abcdefgh' } }), JSON.stringify({ type: 'email.bounced', data: { email_id: '%" OR 1=1' } })]) {
    assert.equal(webhook.parseDeliveryEvent(other), null)
  }
})

// ─── Email template ───────────────────────────────────────────────────────────
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u

test('email: themed, personal, escaped, and free of emoji', () => {
  const { buildInviteEmail } = load('src/lib/invitations/email-template.ts')
  const input = { firstName: 'Maria', partner1: 'Luis', partner2: 'Bee', date: 'February 27, 2027', plus: 2, deadline: 'January 27, 2027',
    intro: 'We would love to have you with us.', subject: "Maria, you're invited", link: 'https://example.test/i/Ab3dE_fGh1jKlMn0pQrStU', qrImageUrl: 'https://example.test/i/Ab3dE_fGh1jKlMn0pQrStU/qr' }
  const email = buildInviteEmail(input)
  for (const expected of ['Dear Maria,', 'you and 2 guests', 'Please RSVP by January 27, 2027.', `href="${input.link}"`, `src="${input.qrImageUrl}"`, '#2E1F1A', '#FDFAF6', 'Open my invitation']) {
    assert.ok(email.html.includes(expected), expected)
  }
  assert.ok(email.text.includes(input.link))
  assert.ok(!EMOJI.test(email.html + email.text + email.subject))
  assert.ok(buildInviteEmail({ ...input, plus: 0 }).html.includes('reserved for you'))
  assert.ok(buildInviteEmail({ ...input, plus: 1 }).html.includes('you and 1 guest.'))

  const hostile = buildInviteEmail({ ...input, firstName: '<script>alert(1)</script>', intro: '"><img src=x onerror=alert(1)>', subject: 'Hi\r\nBcc: everyone@example.com', link: 'https://example.test/i/x"onmouseover="y' })
  assert.ok(!/<script>|<img src=x|onmouseover="y/.test(hostile.html))
  assert.ok(!/[\r\n]/.test(hostile.subject))
})

// ─── Admin routes refuse anyone without a session ─────────────────────────────
test('admin routes: every handler answers 401 and touches no data without a session', async () => {
  const touched = []
  const guarded = name => new Proxy({}, { get: (_target, property) => (property === 'DuplicateContactError' ? class extends Error {} : (...args) => { touched.push(`${name}.${String(property)}`); throw new Error('data access without a session') }) })
  const overrides = {
    'next/server': { NextResponse: { json: (body, init = {}) => ({ body, status: init.status ?? 200 }) } },
    '@/lib/auth': { isAdminRequest: async () => false },
    '@/lib/config': guarded('config'),
    '@/lib/invitations/admin-store': guarded('admin-store'),
    '@/lib/invitations/qr-png': guarded('qr-png'),
    '@/lib/invitations/send': guarded('send'),
    '@/lib/invitations/mailer': { isEmailConfigured: () => true },
  }
  const request = { json: async () => { touched.push('request.json'); return {} }, cookies: { get: () => undefined } }
  const routes = {
    'src/app/api/admin/invitations/route.ts': ['GET', 'POST', 'PATCH', 'DELETE'],
    'src/app/api/admin/invitations/[id]/route.ts': ['GET'],
    'src/app/api/admin/invitations/[id]/qr/route.ts': ['GET'],
    'src/app/api/admin/invitations/[id]/email/route.ts': ['GET'],
    'src/app/api/admin/invitations/settings/route.ts': ['GET', 'PUT'],
    'src/app/api/admin/invitations/import/route.ts': ['POST'],
    'src/app/api/admin/invitations/send/route.ts': ['POST'],
  }
  for (const [file, methods] of Object.entries(routes)) {
    const route = load(file, overrides, new Map(), { INVITE_TOKEN_KEY: KEY })
    for (const method of methods) {
      const response = await route[method](request, { params: { id: '1' } })
      assert.equal(response.status, 401, `${file} ${method}`)
      assert.equal(response.body.success, false)
    }
  }
  assert.deepEqual(touched, [])
})

// ─── Dashboard status helpers ─────────────────────────────────────────────────
test('dashboard: stages, filters and totals follow the invitation data', () => {
  const status = load('src/app/admin/invitations/_components/status.ts')
  const row = extra => ({ id: 1, guestName: 'Maria Santos', email: 'maria@example.com', phone: '+639171234567', seats: 3, status: 'active', sentAt: null, lastChannel: null,
    firstOpenedAt: null, lastOpenedAt: null, openCount: 0, respondedAt: null, linkRequestedAt: null, createdAt: '2026-11-11T00:00:00.000Z', response: null, ...extra })
  const response = (attending, partySize) => ({ attending, partySize, companions: [], dietary: null, songRequest: null, message: null, updatedAt: null })
  const list = [
    row({}), row({ sentAt: 'x' }), row({ sentAt: 'x', firstOpenedAt: 'x' }),
    row({ sentAt: 'x', firstOpenedAt: 'x', response: response(true, 2) }), row({ response: response(false, 0), linkRequestedAt: 'x' }),
    row({ status: 'revoked', sentAt: 'x', response: response(true, 3) }),
  ]
  assert.deepEqual(list.map(status.stageOf), ['not_sent', 'sent', 'opened', 'responded', 'responded', 'revoked'])
  assert.deepEqual(list.map(status.statusText), ['Not sent', 'Sent', 'Opened', 'Attending · 2', 'Declined', 'Revoked'])
  assert.deepEqual(plain(status.totalsOf(list)), { invited: 5, sent: 3, opened: 2, attending: 1, declined: 1, seatsGiven: 15, seatsUsed: 2, linkRequests: 1 })
  assert.equal(list.filter(item => status.matchesFilter(item, 'responded')).length, 2)
  assert.equal(status.matchesSearch(list[0], '0917'), false)
  assert.equal(status.matchesSearch(list[0], '917123'), true)
  assert.equal(status.matchesSearch(list[0], 'SANTOS'), true)
  assert.deepEqual([1, 2, 4].map(status.plusText), ['No plus', 'Plus 1', 'Plus 3'])
  assert.equal(status.eventLabel('shared', 'instagram'), 'Marked as sent via Instagram')
})

// ─── Interface rules: no emoji, no coloured borders, no hand-drawn icons ──────
test('interface: new screens use no emoji, no coloured borders and no hand-drawn icons', () => {
  const folders = ['src/app/admin/invitations', 'src/app/i', 'src/app/rsvp/find']
  const files = []
  const walk = dir => { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const full = path.join(dir, entry.name); if (entry.isDirectory()) walk(full); else if (/\.tsx?$/.test(entry.name)) files.push(full) } }
  folders.forEach(folder => walk(path.join(root, folder)))
  assert.ok(files.length >= 12)
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8')
    const name = path.relative(root, file)
    assert.ok(!EMOJI.test(source), name + ' contains an emoji')
    assert.ok(!/<svg|<path\b|<circle\b/.test(source), name + ' draws an icon by hand')
    const borders = source.match(/\bborder(?:-[trblxy])?-(?!t\b|b\b|l\b|r\b|x\b|y\b|0\b|black\/|transparent\b|\[1\.5px\]|b-\[|r-\[|ink2\/)[a-z]+[\w\/.\[\]-]*/g) || []
    assert.deepEqual(borders, [], name + ' has a coloured border: ' + borders.join(' '))
    assert.ok(!/console\.(log|debug|info)/.test(source), name)
  }
  const icons = files.flatMap(file => [...fs.readFileSync(file, 'utf8').matchAll(/from '([^']+)'/g)].map(match => match[1])).filter(source => /icon|lucide|heroicons|fontawesome/i.test(source))
  assert.ok(icons.every(source => source === 'lucide-react'), 'icons come only from lucide-react')
})

// ─── Fresh reads: found by the end-to-end run ─────────────────────────────────
test('database: queries are never served from the Next.js fetch cache', () => {
  const client = fs.readFileSync(path.join(root, 'src/lib/db.ts'), 'utf8')
  assert.match(client, /neon\(url,\s*\{\s*fetchOptions:\s*\{\s*cache:\s*'no-store'\s*\}\s*\}\)/, 'database queries must bypass the Next.js fetch cache')
  assert.match(fs.readFileSync(path.join(root, 'src/lib/invitations/db.ts'), 'utf8'), /export \{ getDb as getInviteDb, schema \} from '@\/lib\/db'/)
  const folders = ['src/lib/invitations', 'src/app/i', 'src/app/rsvp', 'src/app/api/invite', 'src/app/api/admin/invitations', 'src/app/api/webhooks', 'src/app/admin/invitations']
  const files = []
  const walk = dir => { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const full = path.join(dir, entry.name); if (entry.isDirectory()) walk(full); else if (/\.tsx?$/.test(entry.name)) files.push(full) } }
  folders.forEach(folder => walk(path.join(root, folder)))
  for (const file of files) {
    if (file.endsWith(path.join('invitations', 'db.ts'))) continue
    assert.ok(!/from '@\/lib\/db'/.test(fs.readFileSync(file, 'utf8')), path.relative(root, file) + ' must import the database through invitations/db')
  }
})

// ─── Email sender (provider replaced by a stand-in; nothing leaves this machine) ──
function mailerWith(env, respond = () => ({ ok: true, status: 200, json: async () => ({ id: 'email-id-123' }) })) {
  const calls = []
  const fetch = async (url, init) => { calls.push({ url, init, body: JSON.parse(init.body) }); return respond() }
  return { calls, mailer: load('src/lib/invitations/mailer.ts', {}, new Map(), env, { fetch }) }
}
const message = { to: 'guest@example.com', subject: 'You are invited', html: '<p>Hello</p>', text: 'Hello' }
const mailEnv = { RESEND_API_KEY: 're_test_key', INVITE_EMAIL_FROM: 'Luis & Bee <invites@example.test>' }

test('mailer: sends one authenticated request to the provider and returns its id', async () => {
  const { calls, mailer } = mailerWith({ ...mailEnv, INVITE_EMAIL_REPLY_TO: 'reply@example.test' })
  assert.equal(mailer.isEmailConfigured(), true)
  assert.equal(await mailer.sendEmail(message), 'email-id-123')
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, 'https://api.resend.com/emails')
  assert.equal(calls[0].init.method, 'POST')
  assert.equal(calls[0].init.headers.Authorization, 'Bearer re_test_key')
  assert.deepEqual(calls[0].body, { from: mailEnv.INVITE_EMAIL_FROM, to: ['guest@example.com'], subject: 'You are invited', html: '<p>Hello</p>', text: 'Hello', reply_to: 'reply@example.test' })
})

test('mailer: with a test recipient set, the guest is never emailed', async () => {
  const { calls, mailer } = mailerWith({ ...mailEnv, INVITE_EMAIL_TEST_RECIPIENT: 'me@example.test' })
  await mailer.sendEmail(message)
  assert.deepEqual(calls[0].body.to, ['me@example.test'])
  assert.equal(calls[0].body.subject, '[Test] You are invited')
  assert.ok(!JSON.stringify(calls[0].body).includes('guest@example.com'))
})

test('mailer: without configuration nothing is sent; a provider refusal is an error', async () => {
  for (const env of [{}, { RESEND_API_KEY: 're_test_key' }, { INVITE_EMAIL_FROM: 'x@example.test' }]) {
    const { calls, mailer } = mailerWith(env)
    assert.equal(mailer.isEmailConfigured(), false)
    await assert.rejects(mailer.sendEmail(message), error => error.name === 'EmailNotConfiguredError')
    assert.equal(calls.length, 0)
  }
  const refused = mailerWith(mailEnv, () => ({ ok: false, status: 422, json: async () => ({ message: 'domain not verified' }) }))
  await assert.rejects(refused.mailer.sendEmail(message), error => error.name === 'EmailSendError' && error.status === 422 && !/domain/.test(error.message))
})

// ─── Send flow ────────────────────────────────────────────────────────────────
function sendHarness(options = {}) {
  const state = { sent: [], shares: [], events: [], fail: false, ...options }
  const overrides = {
    '@/lib/config': { getWeddingConfig: async () => ({ partner1: 'Luis', partner2: 'Bee', weddingDate: '2027-02-27', rsvpDeadline: 'January 27, 2027' }) },
    './admin-store': {
      loadSettingsForAdmin: async () => load('src/lib/invitations/settings.ts').DEFAULT_INVITE_SETTINGS,
      recordShare: async (id, channel, type, meta) => { state.shares.push({ id, channel, type, meta }); return true },
      getInvitationDetail: async id => state.details?.[id] ?? null,
    },
    './mailer': { sendEmail: async email => { if (state.fail) throw new Error('provider down'); state.sent.push(email); return 'email-id-9' } },
    './store': { inviteStore: { recordEvent: async (id, type, channel, meta) => { state.events.push({ id, type, channel, meta }) } } },
  }
  const send = load('src/lib/invitations/send.ts', overrides, new Map(), { INVITE_TOKEN_KEY: KEY, NEXT_PUBLIC_BASE_URL: 'https://example.test' })
  return { state, send }
}
const guestDetail = extra => ({ id: 5, guestName: 'Maria Clara Santos', email: 'maria@example.com', seats: 3, status: 'active', sentAt: null, token: 'Ab3dE_fGh1jKlMn0pQrStU', ...extra })

test('send: the guest gets their own link, QR, plus count and deadline, and the send is recorded', async () => {
  const { state, send } = sendHarness()
  assert.deepEqual(plain(await send.sendInvitationEmail(guestDetail(), { resend: false })), { sent: true })
  const [email] = state.sent
  assert.equal(email.to, 'maria@example.com')
  assert.equal(email.subject, "Maria, you're invited to our wedding")
  for (const expected of ['Dear Maria,', 'https://example.test/i/Ab3dE_fGh1jKlMn0pQrStU"', 'https://example.test/i/Ab3dE_fGh1jKlMn0pQrStU/qr"', 'you and 2 guests', 'Please RSVP by January 27, 2027.', 'February 27, 2027']) {
    assert.ok(email.html.includes(expected), expected)
  }
  assert.deepEqual(plain(state.shares), [{ id: 5, channel: 'email', type: 'email_sent', meta: '{"emailId":"email-id-9"}' }])
  assert.deepEqual(plain((await send.composeInvitationEmail(guestDetail())).html), email.html, 'the preview is the same email that is sent')
})

test('send: revoked, no-email and already-sent guests are skipped without contacting the provider', async () => {
  const { state, send } = sendHarness()
  assert.match((await send.sendInvitationEmail(guestDetail({ status: 'revoked' }), { resend: true })).reason, /revoked/)
  assert.match((await send.sendInvitationEmail(guestDetail({ email: null }), { resend: true })).reason, /No email/)
  assert.match((await send.sendInvitationEmail(guestDetail({ sentAt: new Date() }), { resend: false })).reason, /Already sent/)
  assert.match((await send.sendInvitationEmailById(404, { resend: false })).reason, /no longer exists/)
  assert.deepEqual([state.sent.length, state.shares.length], [0, 0])
  assert.equal((await send.sendInvitationEmail(guestDetail({ sentAt: new Date() }), { resend: true })).sent, true)
})

test('send: a provider failure is logged on the timeline and never marked as sent', async () => {
  const { state, send } = sendHarness({ fail: true })
  const outcome = await send.sendInvitationEmail(guestDetail(), { resend: false })
  assert.deepEqual(plain(outcome), { sent: false, reason: 'The email could not be sent.' })
  assert.deepEqual(state.shares, [])
  assert.deepEqual(plain(state.events.map(event => [event.id, event.type, event.channel])), [[5, 'email_failed', 'email']])
})

test('mailer: simulation never contacts the provider, never overrides real settings, and is off in production', async () => {
  const simulated = mailerWith({ INVITE_EMAIL_SIMULATE: '1' })
  assert.equal(simulated.mailer.emailMode(), 'simulated')
  assert.match(await simulated.mailer.sendEmail(message), /^simulated-\d+$/)
  assert.equal(simulated.calls.length, 0)
  assert.equal(mailerWith({ ...mailEnv, INVITE_EMAIL_SIMULATE: '1' }).mailer.emailMode(), 'live')
  assert.equal(mailerWith({ INVITE_EMAIL_SIMULATE: '1', VERCEL_ENV: 'production' }).mailer.emailMode(), 'off')
  assert.equal(mailerWith({ INVITE_EMAIL_SIMULATE: 'true' }).mailer.emailMode(), 'off')
  assert.equal(mailerWith({}).mailer.emailMode(), 'off')
  const status = load('src/app/admin/invitations/_components/status.ts')
  assert.equal(status.eventLabel('email_sent', 'email', '{"emailId":"simulated-1","simulated":true}'), 'Email simulated (nothing sent)')
  assert.equal(status.eventLabel('email_sent', 'email', '{"emailId":"abc"}'), 'Email sent')
})

test('send: a preview may load the QR image from the address it is opened on, but links never change', async () => {
  const { send } = sendHarness()
  const preview = await send.composeInvitationEmail(guestDetail(), 'http://127.0.0.1:3190')
  assert.ok(preview.html.includes('src="http://127.0.0.1:3190/i/Ab3dE_fGh1jKlMn0pQrStU/qr"'))
  assert.ok(preview.html.includes('href="https://example.test/i/Ab3dE_fGh1jKlMn0pQrStU"'))
  assert.ok(!preview.html.includes('href="http://127.0.0.1'))
})
