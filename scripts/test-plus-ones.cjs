const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { spawnSync } = require('node:child_process')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')

// Compile production modules in memory; nothing here touches a database or network.
function load(relative, overrides = {}, cache = new Map(), env = {}) {
  const filename = path.join(root, relative)
  if (cache.has(filename)) return cache.get(filename)
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    fileName: filename,
  }).outputText
  const module = { exports: {} }
  const localRequire = name => {
    if (Object.prototype.hasOwnProperty.call(overrides, name)) return overrides[name]
    if (name.startsWith('@/')) return load('src/' + name.slice(2) + '.ts', overrides, cache, env)
    if (name.startsWith('./')) return load(path.join(path.dirname(relative), name + '.ts'), overrides, cache, env)
    return require(name)
  }
  vm.runInNewContext(output, {
    module, exports: module.exports, require: localRequire, process: { env },
    Date, Map, Set, Error, SyntaxError, Buffer, URL, JSON, Math, console, Response, setTimeout, AbortSignal, RegExp, Array, Object, Number, String,
  }, { filename })
  cache.set(filename, module.exports)
  return module.exports
}

const plain = value => JSON.parse(JSON.stringify(value))
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8')
const KEY = 'test-only-invite-token-key-0123456789abcdef'

const cache = new Map()
const plus = load('src/lib/invitations/plus-ones.ts', {}, cache)
const policy = load('src/lib/invitations/policy.ts', {}, cache)
const adminSchemas = load('src/lib/invitations/admin-schemas.ts', {}, cache)
const service = load('src/lib/invitations/service.ts', {}, cache, { INVITE_TOKEN_KEY: KEY })
const tokens = load('src/lib/invitations/token.ts', {}, cache, { INVITE_TOKEN_KEY: KEY })
const people = load('src/lib/seating/people.ts', {}, cache)
const guestView = load('src/lib/seating/guest-view.ts', {}, cache)

// Invented names only: the real guest list is private and never goes in this repository.
const LIST = ['Alma Reyes', 'Bruno Dela Cruz', 'Chiara']

// ─── The list itself ──────────────────────────────────────────────────────────
test('plus ones: a typed list is tidied, and refused when it names someone twice, too many, or the guest', () => {
  assert.deepEqual(plain(plus.checkPlusOnes(['  Alma   Reyes ', '', 'Bruno Dela Cruz'])), { ok: true, names: ['Alma Reyes', 'Bruno Dela Cruz'] })
  assert.deepEqual(plain(plus.checkPlusOnes([])), { ok: true, names: [] })
  assert.equal(plus.checkPlusOnes(['Alma Reyes', 'alma  reyes']).ok, false, 'the same name twice, whatever its case or spacing')
  assert.match(plus.checkPlusOnes(['Alma Reyes', 'alma reyes']).message, /listed twice/)
  assert.equal(plus.checkPlusOnes(['A']).ok, false)
  assert.equal(plus.checkPlusOnes(['x'.repeat(256)]).ok, false)
  assert.equal(plus.checkPlusOnes(Array.from({ length: 20 }, (_unused, index) => `Person ${index + 10}`)).ok, false)
  assert.equal(plus.checkPlusOnes(Array.from({ length: 19 }, (_unused, index) => `Person ${index + 10}`)).ok, true)
  assert.match(plus.checkPlusOnes(['Dana Cruz'], 'Dana Cruz').message, /is the guest/)
})

test('plus ones: the stored list is read safely, and a list decides the seats', () => {
  assert.deepEqual(plain(plus.parsePlusOnes(JSON.stringify(LIST))), LIST)
  for (const raw of [null, undefined, '', 'not json', '{}', '"Alma"', '[1,2]']) assert.deepEqual(plain(plus.parsePlusOnes(raw)), [], String(raw))
  assert.equal(plus.serialisePlusOnes([]), null, 'no list is stored as nothing, so an invitation stays as it was')
  assert.equal(plus.serialisePlusOnes(LIST), JSON.stringify(LIST))
  assert.equal(plus.seatsFor(LIST, 1), 4)
  assert.equal(plus.seatsFor([], 3), 3, 'with no list the seat count stands')
})

test('plus ones: only whole, distinct positions inside the list can be chosen, and names come from the list', () => {
  assert.deepEqual(plain(plus.choosePlusOnes(LIST, [2, 0])), { ok: true, positions: [0, 2], companions: ['Alma Reyes', 'Chiara'] })
  assert.deepEqual(plain(plus.choosePlusOnes(LIST, [])), { ok: true, positions: [], companions: [] })
  assert.deepEqual(plain(plus.choosePlusOnes(LIST, undefined)), { ok: true, positions: [], companions: [] })
  for (const bad of [[3], [-1], [1.5], [0, 0], ['0'], [null], [{}], 'all', 0, [0, 1, 2, 3], [NaN], [Infinity]]) {
    const result = plus.choosePlusOnes(LIST, bad)
    assert.equal(result.ok, false, JSON.stringify(bad))
    assert.equal(result.message, plus.CLOSED_LIST_MESSAGE)
  }
  assert.deepEqual(plain(plus.bringingPositions(LIST, ['chiara', 'Someone Else'])), [2], 'a name matches however it was cased; strangers match nothing')
})

test('plus ones: a list pasted from the couple\'s own sheet is split, and its count is checked against its names', () => {
  assert.deepEqual(plain(plus.parsePastedPlusOnes('2: Alma Reyes, Bruno Dela Cruz')), { ok: true, names: ['Alma Reyes', 'Bruno Dela Cruz'] })
  assert.deepEqual(plain(plus.parsePastedPlusOnes('Chiara')), { ok: true, names: ['Chiara'] })
  assert.deepEqual(plain(plus.parsePastedPlusOnes('')), { ok: true, names: [] })
  assert.deepEqual(plain(plus.parsePastedPlusOnes('1: Chiara')), { ok: true, names: ['Chiara'] })
  const wrong = plus.parsePastedPlusOnes('3: Alma Reyes, Bruno Dela Cruz')
  assert.equal(wrong.ok, false)
  assert.match(wrong.message, /says 3 plus ones but names 2/)
  assert.match(plus.parsePastedPlusOnes('1: Alma Reyes, Bruno').message, /says 1 plus one but names 2/)
})

// ─── The rule the server applies ──────────────────────────────────────────────
const accept = extra => policy.inviteRsvpSchema.parse({ attending: 'yes', acknowledged: true, ...extra })

test('closed list: ticking some plus ones seats exactly them, and the names come from the list', () => {
  const checked = policy.checkNamedRsvp(accept({ bringing: [0, 2] }), LIST)
  assert.deepEqual(plain(checked), { ok: true, values: { attending: true, partySize: 3, companions: ['Alma Reyes', 'Chiara'] } })
  assert.equal(policy.checkNamedRsvp(accept({ bringing: [] }), LIST).values.partySize, 1, 'ticking no one is the guest alone')
  assert.equal(policy.checkNamedRsvp(accept({}), LIST).values.partySize, 1)
  assert.equal(policy.checkNamedRsvp(accept({ bringing: [0, 1, 2] }), LIST).values.partySize, 4)
})

test('closed list: declining gives up every seat', () => {
  const checked = policy.checkNamedRsvp(policy.inviteRsvpSchema.parse({ attending: 'no', acknowledged: true, bringing: [0, 1, 2] }), LIST)
  assert.deepEqual(plain(checked.values), { attending: false, partySize: 0, companions: [] })
})

test('closed list: nobody outside the list can be added, whatever the browser sends', () => {
  for (const bringing of [[3], [-1], [0, 0], [1.2], ['0'], 'everyone', [0, 1, 2, 3]]) {
    assert.equal(policy.checkNamedRsvp(accept({ bringing }), LIST).ok, false, JSON.stringify(bringing))
  }
  // Typed names are not how a closed list is answered.
  const typed = policy.checkNamedRsvp(accept({ companions: ['Mallory Outsider'], bringing: [0] }), LIST)
  assert.equal(typed.ok, false)
  assert.equal(typed.message, plus.CLOSED_LIST_MESSAGE)
  // A party size in the request is ignored: the ticks decide.
  assert.equal(policy.checkNamedRsvp(accept({ partySize: 4, bringing: [0] }), LIST).values.partySize, 2)
})

// ─── The whole guest flow, with an in-memory store ────────────────────────────
function memoryStore(options = {}) {
  const token = tokens.generateToken()
  const state = {
    token, writes: 0, rsvp: null, deadline: 'January 27, 2027', events: [],
    invitation: { id: 9, guestName: 'Dana Cruz', email: null, seats: 4, plusOnes: LIST, status: 'active', tokenHash: tokens.hashToken(token), firstOpenedAt: null, lastOpenedAt: null, respondedAt: null },
    ...options,
  }
  const store = {
    async findByTokenHash(hash) { return hash === state.invitation.tokenHash ? { ...state.invitation } : null },
    async findRsvp() { return state.rsvp && { ...state.rsvp } },
    async saveRsvp(_invitation, values, existing, now) {
      state.writes++
      state.rsvp = { id: 1, attending: values.attending, partySize: values.partySize, companions: values.companions, dietary: values.dietary ?? null, songRequest: values.songRequest ?? null, message: values.message ?? null, updatedAt: now, createdAt: existing?.createdAt ?? now }
    },
    async markResponded(_id, now) { state.invitation.respondedAt = now },
    async recordOpen() {},
    async recordEvent(_id, type) { state.events.push(type) },
    async deadlineText() { return state.deadline },
  }
  return { state, store }
}
const NOW = new Date(Date.UTC(2026, 11, 1, 4))

test('flow: the guest page carries the list, the guest ticks two of three, and can change their mind', async () => {
  const { state, store } = memoryStore()
  const first = await service.loadInviteView(store, state.token, NOW)
  assert.deepEqual(plain(first.plusOnes), LIST)
  assert.equal(first.plus, 3)
  assert.equal(first.response, null)

  const answered = await service.submitInviteRsvp(store, state.token, { attending: 'yes', bringing: [0, 2], acknowledged: true }, NOW)
  assert.equal(answered.status, 200)
  assert.deepEqual(plain(answered.body.data.response.companions), ['Alma Reyes', 'Chiara'])
  assert.deepEqual(plain(answered.body.data.response.bringing), [0, 2])
  assert.equal(answered.body.data.response.partySize, 3)
  assert.equal(state.rsvp.partySize, 3)

  const changed = await service.submitInviteRsvp(store, state.token, { attending: 'yes', bringing: [1], acknowledged: true }, NOW)
  assert.deepEqual(plain(changed.body.data.response.bringing), [1])
  assert.deepEqual(plain(changed.body.data.response.companions), ['Bruno Dela Cruz'])
  assert.equal(state.rsvp.partySize, 2)
  assert.deepEqual(state.events, ['responded', 'updated'])
})

test('flow: declining forfeits every seat, and a request that tries to add someone changes nothing', async () => {
  const { state, store } = memoryStore()
  const declined = await service.submitInviteRsvp(store, state.token, { attending: 'no', bringing: [0, 1, 2], acknowledged: true }, NOW)
  assert.equal(declined.status, 200)
  assert.equal(state.rsvp.partySize, 0)
  assert.deepEqual(plain(state.rsvp.companions), [])
  const writes = state.writes
  for (const body of [
    { attending: 'yes', bringing: [5], acknowledged: true },
    { attending: 'yes', bringing: [0, 0], acknowledged: true },
    { attending: 'yes', bringing: [], companions: ['Mallory Outsider'], acknowledged: true },
    { attending: 'yes', bringing: 'all', acknowledged: true },
    { attending: 'yes', bringing: [0] },
  ]) {
    const refused = await service.submitInviteRsvp(store, state.token, body, NOW)
    assert.equal(refused.status, 400, JSON.stringify(body))
  }
  assert.equal(state.writes, writes, 'nothing was written by the refused requests')
  assert.equal(state.rsvp.partySize, 0)
})

test('flow: after the deadline nothing can change, but the choice stays visible', async () => {
  const { state, store } = memoryStore()
  await service.submitInviteRsvp(store, state.token, { attending: 'yes', bringing: [0], acknowledged: true }, NOW)
  const late = new Date(Date.UTC(2027, 0, 28))
  const refused = await service.submitInviteRsvp(store, state.token, { attending: 'yes', bringing: [0, 1], acknowledged: true }, late)
  assert.equal(refused.status, 403)
  const view = await service.loadInviteView(store, state.token, late)
  assert.equal(view.canEdit, false)
  assert.deepEqual(plain(view.response.bringing), [0])
})

test('flow: an invitation with just a number of seats works exactly as it did, and its page has no list', async () => {
  const { state, store } = memoryStore({ invitation: { id: 7, guestName: 'Maria Clara Santos', email: null, seats: 3, plusOnes: [], status: 'active', tokenHash: null, firstOpenedAt: null, lastOpenedAt: null, respondedAt: null } })
  state.invitation.tokenHash = tokens.hashToken(state.token)
  const view = await service.loadInviteView(store, state.token, NOW)
  assert.ok(!('plusOnes' in view), 'no list on the view')
  assert.equal(view.plus, 2)
  const answered = await service.submitInviteRsvp(store, state.token, { attending: 'yes', partySize: 2, companions: ['Jose Rizal'], acknowledged: true }, NOW)
  assert.equal(answered.status, 200)
  assert.deepEqual(plain(answered.body.data.response.companions), ['Jose Rizal'])
  assert.ok(!('bringing' in answered.body.data.response))
  const tooMany = await service.submitInviteRsvp(store, state.token, { attending: 'yes', partySize: 4, companions: ['A One', 'B Two', 'C Three'], acknowledged: true }, NOW)
  assert.equal(tooMany.status, 400)
})

// ─── What the couple types ────────────────────────────────────────────────────
test('admin: plus ones are saved by name, and the seat count follows the list', () => {
  const guest = adminSchemas.guestInputSchema.parse({ guestName: 'Dana Cruz', plusOnes: ['  Alma  Reyes', 'Bruno Dela Cruz'], seats: 9 })
  assert.deepEqual(plain(guest.plusOnes), ['Alma Reyes', 'Bruno Dela Cruz'])
  assert.equal(guest.seats, 3, 'a typed seat count never overrides the list')
  assert.equal(adminSchemas.guestInputSchema.parse({ guestName: 'Dana Cruz', seats: 3 }).seats, 3, 'without a list the number stands')
  for (const plusOnes of [['Alma Reyes', 'alma reyes'], ['Dana Cruz'], ['A'], Array.from({ length: 20 }, (_unused, index) => `Person ${index + 10}`)]) {
    assert.equal(adminSchemas.guestInputSchema.safeParse({ guestName: 'Dana Cruz', plusOnes }).success, false, JSON.stringify(plusOnes).slice(0, 60))
  }
  const edit = adminSchemas.updateInputSchema.parse({ action: 'edit', id: 4, guestName: 'Dana Cruz', plusOnes: ['Alma Reyes'], seats: 7 })
  assert.equal(edit.seats, 2)
  assert.equal(adminSchemas.updateInputSchema.safeParse({ action: 'edit', id: 4, guestName: 'Dana Cruz', plusOnes: ['Dana Cruz'], seats: 1 }).success, false)
  assert.equal(adminSchemas.updateInputSchema.safeParse({ action: 'revoke', id: 4 }).success, true)
})

test('admin: the couple\'s own list can be pasted as it is: "Name | contact | 2: Plus One, Plus One"', () => {
  const { guests, errors } = adminSchemas.parseBulkLines([
    'Dana Cruz | | 2: Alma Reyes, Bruno Dela Cruz',
    'Eli Santos | | Chiara',
    'Fe Lopez',
    'Gil Mercado | 0917 123 4567 | 1: Hana Mercado',
    'Ida Ramos | ida@example.com |',
    'Jon Villa | | 3: Kim Villa, Lea Villa',
    'Max Tan | | Nia Tan, Nia Tan',
    'Old Format, 0918 123 4567, 2',
  ].join('\n'))
  assert.deepEqual(plain(guests.map(guest => [guest.guestName, guest.seats, guest.plusOnes])), [
    ['Dana Cruz', 3, ['Alma Reyes', 'Bruno Dela Cruz']],
    ['Eli Santos', 2, ['Chiara']],
    ['Fe Lopez', 1, []],
    ['Gil Mercado', 2, ['Hana Mercado']],
    ['Ida Ramos', 1, []],
    ['Old Format', 3, []],
  ])
  assert.equal(guests[3].phone, '+639171234567')
  assert.equal(guests[4].email, 'ida@example.com')
  assert.deepEqual(plain(errors.map(issue => issue.line)), [6, 7])
  assert.match(errors[0].message, /says 3 plus ones but names 2/)
  assert.match(errors[1].message, /listed twice/)
})

test('admin: a list shaped like the real one loads whole: 30 guests, 24 plus ones, single names kept as they are', () => {
  // Invented names in the same shapes as the couple's list: counts in front, single names, empty cells.
  const lines = []
  const counts = [2, 3, 3, 1, 0, 0, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 2, 1, 1, 2, 1, 1, 2, 2, 0, 0, 0, 0, 0, 0]
  counts.forEach((count, index) => {
    const names = Array.from({ length: count }, (_unused, n) => (count === 1 && index % 2 ? `Solo${index}` : `Plus ${index}${n} Person`))
    lines.push(`Guest ${String(index).padStart(2, '0')} Family | | ${count > 1 ? `${count}: ` : ''}${names.join(', ')}`)
  })
  const { guests, errors } = adminSchemas.parseBulkLines(lines.join('\n'))
  assert.deepEqual(plain(errors), [])
  assert.equal(guests.length, 30)
  assert.equal(guests.reduce((sum, guest) => sum + guest.plusOnes.length, 0), 24)
  assert.equal(guests.reduce((sum, guest) => sum + guest.seats, 0), 54)
  assert.ok(guests.every(guest => guest.seats === guest.plusOnes.length + 1))
  assert.ok(guests.some(guest => guest.plusOnes.includes('Solo3')))
})

// ─── The seat plan ────────────────────────────────────────────────────────────
const yesWith = (...ticked) => ({ attending: true, partySize: 1 + ticked.length, companions: ticked })

test('seat plan: named plus ones appear by name, and whether they are coming follows the ticks', () => {
  const invitation = (response, extra = {}) => ({ id: 1, guestName: 'Dana Cruz', seats: 4, plusOnes: LIST, status: 'active', response, ...extra })
  const before = people.buildPeople([invitation(null)])
  assert.deepEqual(plain(before.map(person => person.name)), ['Dana Cruz', "Alma Reyes · Dana's plus one", "Bruno Dela Cruz · Dana's plus two", "Chiara · Dana's plus three"])
  assert.deepEqual(plain(before.map(person => person.attendance)), ['pending', 'pending', 'pending', 'pending'])
  const answered = people.buildPeople([invitation(yesWith('Alma Reyes', 'Chiara'))])
  assert.deepEqual(plain(answered.map(person => person.attendance)), ['coming', 'coming', 'not_coming', 'coming'])
  assert.deepEqual(plain(answered.map(person => person.shortName)), ['Dana Cruz', 'Alma Reyes', 'Bruno', 'Chiara'], 'a long name shortens to its first word; a short one is shown whole')
  assert.deepEqual(plain(people.buildPeople([invitation({ attending: false, partySize: 0, companions: [] })]).map(person => person.attendance)), ['declined', 'declined', 'declined', 'declined'])
  // Stable positions: ticking a different person never moves anyone else's seat index.
  assert.deepEqual(plain(answered.map(person => person.index)), [0, 1, 2, 3])
  // An invitation with a number of seats is exactly as before.
  const legacy = people.buildPeople([{ id: 2, guestName: 'Eli Santos', seats: 2, status: 'active', response: null }])
  assert.deepEqual(plain(legacy.map(person => person.name)), ['Eli Santos', "Eli's plus one"])
})

test('seat plan: a guest sees their ticked plus ones by name at their table, and never an unticked one', () => {
  const tables = [{ id: 1, label: 'Table 7', shape: 'round', chairs: 10, x: 400, y: 300, rotation: 0 }, { id: 2, label: 'Table 8', shape: 'round', chairs: 10, x: 800, y: 300, rotation: 0 }]
  const plan = { published: true, room: { width: 1200, height: 1700 }, shapes: [] }
  const assignments = [0, 1, 2, 3].map(index => ({ invitationId: 1, index, tableId: index === 3 ? 2 : 1, chair: index }))
  const view = response => guestView.buildGuestSeating({ plan, tables, assignments, invitation: { id: 1, seats: 4, plusOnes: LIST }, response })
  const answered = view(yesWith('Alma Reyes', 'Chiara'))
  assert.deepEqual(plain(answered.seats), [{ who: 'You', table: 'Table 7' }, { who: 'Alma Reyes', table: 'Table 7' }, { who: 'Chiara', table: 'Table 8' }])
  assert.ok(!JSON.stringify(answered).includes('Bruno'), 'a plus one who is not coming is not shown')
  assert.deepEqual(plain(view(null).seats.map(seat => seat.who)), ['You', 'Alma Reyes', 'Bruno Dela Cruz', 'Chiara'], 'before a reply, everyone listed')
  assert.equal(view({ attending: false, partySize: 0, companions: [] }), null)
})

// ─── Migration ────────────────────────────────────────────────────────────────
test('migration: the plus-one file adds one nullable column and nothing else', () => {
  const result = spawnSync(process.execPath, [path.join(root, 'scripts/migrate.cjs'), '--plan', '--file=20261121_plus_ones.sql'], { cwd: root, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  const plan = JSON.parse(result.stdout)
  assert.equal(plan.applied, false)
  assert.deepEqual(plain(plan.migrations[0].statements), ['ALTER TABLE invitations ADD COLUMN IF NOT EXISTS plus_ones text'])
  assert.match(read('src/lib/schema.ts'), /plusOnes:\s+text\('plus_ones'\),/)
})

