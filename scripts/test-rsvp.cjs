const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')

// Compile production modules in memory; all database/network dependencies are mocked.
function load(relative, overrides = {}, cache = new Map()) {
  const filename = path.join(root, relative)
  if (cache.has(filename)) return cache.get(filename)
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: filename,
  }).outputText
  const module = { exports: {} }
  const localRequire = name => {
    if (Object.prototype.hasOwnProperty.call(overrides, name)) return overrides[name]
    if (name.startsWith('@/')) return load('src/' + name.slice(2) + '.ts', overrides, cache)
    return require(name)
  }
  vm.runInNewContext(output, {
    module, exports: module.exports, require: localRequire,
    Date, Map, Error, SyntaxError, console,
  }, { filename })
  cache.set(filename, module.exports)
  return module.exports
}

const policy = load('src/lib/rsvp-policy.ts')
const valid = { name: 'Alex Example', email: 'alex@example.com', attending: 'yes' }

function harness(options = {}) {
  const state = { mode: 'invite_only', guest: null, duplicate: false, writes: [], reads: [], ...options }
  const table = name => ({ table: name, id: 'id', email: 'email', status: 'status', seats: 'seats', name: 'name', rsvpAccessMode: 'rsvpAccessMode' })
  const schema = { rsvps: table('rsvps'), guestList: table('guest_list'), weddingConfig: table('wedding_config') }
  const db = {
    select() {
      let selected, condition
      const query = {
        from(value) { selected = value.table; return query },
        where(value) { condition = value; return query },
        async limit() {
          state.reads.push({ table: selected, condition })
          if (state.readError) throw new Error('Database unavailable')
          if (selected === 'guest_list') return state.guest ? [state.guest] : []
          if (selected === 'rsvps') return state.duplicate ? [{ id: 1 }] : []
          if (selected === 'wedding_config') return state.configMissing ? [] : [{ rsvpAccessMode: state.mode }]
          throw new Error('Unexpected table')
        },
      }
      return query
    },
    insert(selected) {
      assert.equal(selected.table, 'rsvps')
      return { values(value) { return { async returning() {
        if (state.uniqueError) { const error = new Error('duplicate rsvps_email_unique'); error.code = '23505'; throw error }
        state.writes.push(value)
        return [{ id: 42 }]
      } } } }
    },
  }
  const overrides = {
    '@/lib/db': { getDb: () => db, schema },
    'drizzle-orm': { eq: (column, value) => ({ column, value }) },
    'next/server': { NextResponse: { json: (body, init = {}) => ({ status: init.status ?? 200, body, headers: init.headers }) } },
  }
  const cache = new Map()
  const submit = load('src/app/api/rsvp/route.ts', overrides, cache).POST
  const verify = load('src/app/api/rsvp/verify/route.ts', overrides, cache).POST
  const request = (body, ip = '192.0.2.1') => ({ headers: { get: () => ip }, json: async () => body })
  return { state, submit, verify, request }
}

test('policy matrix: duplicate, block, allow and unlisted access modes', () => {
  for (const mode of ['open', 'mixed', 'invite_only', 'invalid']) {
    for (const status of [null, 'allow', 'block']) {
      for (const duplicate of [false, true]) {
        const guest = status ? { status, seats: 2, name: 'Example Guest' } : null
        const result = policy.rsvpEligibility(guest, duplicate, mode)
        const allowed = !duplicate && status !== 'block' && (status === 'allow' || ['open', 'mixed'].includes(mode))
        assert.equal(result.allowed, allowed, JSON.stringify({ mode, status, duplicate }))
        if (!allowed) { assert.equal(result.name, null); assert.equal(result.seats, null) }
      }
    }
  }
})

test('direct POST cannot bypass invite-only policy or submit forged access flags', async () => {
  const h = harness()
  const res = await h.submit(h.request({ ...valid, allowed: true, status: 'allow', seats: 20 }))
  assert.equal(res.status, 403)
  assert.equal(res.body.reason, 'not_invited')
  assert.equal(h.state.writes.length, 0)
})

test('blocked guests cannot submit in any access mode', async () => {
  for (const mode of ['open', 'mixed', 'invite_only']) {
    const h = harness({ mode, guest: { status: 'block', seats: 2, name: 'Example' } })
    const res = await h.submit(h.request(valid))
    assert.equal(res.status, 403)
    assert.equal(res.body.reason, 'blocked')
    assert.equal(h.state.writes.length, 0)
  }
})

test('verify and submit use the same current policy', async () => {
  for (const mode of ['open', 'mixed', 'invite_only', 'invalid']) {
    for (const status of [null, 'allow', 'block']) {
      const h = harness({ mode, guest: status ? { status, seats: 2, name: 'Example' } : null })
      const gate = await h.verify(h.request({ email: valid.email }))
      const submitted = await h.submit(h.request(valid))
      assert.equal(gate.body.data.allowed, submitted.status === 200)
    }
  }
})

test('changing a guest to blocked after verification stops submission', async () => {
  const h = harness({ guest: { status: 'allow', seats: 2, name: 'Example' } })
  assert.equal((await h.verify(h.request({ email: valid.email }))).body.data.allowed, true)
  h.state.guest.status = 'block'
  assert.equal((await h.submit(h.request(valid))).status, 403)
  assert.equal(h.state.writes.length, 0)
})

test('current submitted email is checked, not the earlier verified email', async () => {
  const h = harness({ guest: { status: 'allow', seats: 1, name: 'Example' } })
  await h.verify(h.request({ email: valid.email }))
  h.state.guest = null
  const res = await h.submit(h.request({ ...valid, email: 'other@example.com' }))
  assert.equal(res.status, 403)
  assert.equal(h.state.reads.at(-3).condition.value, 'other@example.com')
})

test('allowed submission normalizes whitespace and email case without accepting private fields', async () => {
  const h = harness({ guest: { status: 'allow', seats: 2, name: null } })
  const res = await h.submit(h.request({ ...valid, name: '  Alex Example  ', email: ' ALEX@EXAMPLE.COM ', dietary: ' none ', id: 9, seats: 20 }))
  assert.equal(res.status, 200)
  assert.equal(res.body.id, 42)
  assert.equal(h.state.writes[0].name, valid.name)
  assert.equal(h.state.writes[0].email, valid.email)
  assert.equal(h.state.writes[0].dietary, 'none')
  assert.equal(h.state.writes[0].attending, true)
  assert.equal(h.state.writes[0].id, undefined)
  assert.equal(h.state.writes[0].seats, undefined)
})

test('declining attendance persists false and returns an appropriate message', async () => {
  const h = harness({ mode: 'open' })
  const res = await h.submit(h.request({ ...valid, attending: 'no' }))
  assert.equal(res.status, 200)
  assert.equal(h.state.writes[0].attending, false)
  assert.match(res.body.message, /Thank you for letting us know/)
})

test('duplicate and unique-index race return 409 without a successful write', async () => {
  for (const options of [{ duplicate: true }, { uniqueError: true }]) {
    const h = harness({ mode: 'open', ...options })
    const res = await h.submit(h.request(valid))
    assert.equal(res.status, 409)
    assert.equal(res.body.reason, 'already_rsvped')
    assert.equal(h.state.writes.length, 0)
  }
})

test('invalid and overlong fields are rejected before database lookup', async () => {
  for (const delta of [
    { name: ' ' }, { email: 'invalid' }, { attending: true },
    { name: 'a'.repeat(256) }, { dietary: 'a'.repeat(501) },
    { songRequest: 'a'.repeat(256) }, { message: 'a'.repeat(2001) },
  ]) {
    const h = harness()
    assert.equal((await h.submit(h.request({ ...valid, ...delta }))).status, 400)
    assert.equal(h.state.reads.length, 0)
    assert.equal(h.state.writes.length, 0)
  }
})

test('malformed JSON gives 400 in both endpoints', async () => {
  const h = harness()
  const bad = { headers: { get: () => '192.0.2.2' }, json: async () => { throw new SyntaxError('bad json') } }
  assert.equal((await h.submit(bad)).status, 400)
  assert.equal((await h.verify(bad)).status, 400)
})

test('database failure gives 500 and never permits an insert', async () => {
  const h = harness({ mode: 'open', readError: true })
  assert.equal((await h.submit(h.request(valid))).status, 500)
  assert.equal((await h.verify(h.request({ email: valid.email }))).status, 500)
  assert.equal(h.state.writes.length, 0)
})

test('no config row preserves the legacy open behavior', async () => {
  const h = harness({ configMissing: true })
  assert.equal((await h.submit(h.request(valid))).status, 200)
})

test('both endpoints throttle the eleventh attempt with Retry-After', async () => {
  const h = harness()
  for (const endpoint of [h.submit, h.verify]) {
    for (let i = 0; i < 10; i++) assert.notEqual((await endpoint(h.request(valid))).status, 429)
    const res = await endpoint(h.request(valid))
    assert.equal(res.status, 429)
    assert.equal(res.headers['Retry-After'], '60')
  }
})

test('rate limiter expiry, boundary, independent IPs and bounded entries', () => {
  const limit = policy.createRsvpRateLimiter(2, 60, 2)
  assert.equal(limit('a', 100), false)
  assert.equal(limit('a', 101), false)
  assert.equal(limit('a', 102), true)
  assert.equal(limit('b', 102), false)
  assert.equal(limit('a', 160), false)
  assert.equal(limit('c', 161), false)
  assert.equal(limit('c', 162), false)
  assert.equal(limit('c', 163), true)
})
