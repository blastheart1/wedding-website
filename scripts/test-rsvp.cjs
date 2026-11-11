const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')

// Compile production modules in memory. Database access is replaced by a trap that fails the test if touched.
function load(relative, overrides = {}) {
  const output = ts.transpileModule(read(relative), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
  const module = { exports: {} }
  const localRequire = name => {
    if (Object.prototype.hasOwnProperty.call(overrides, name)) return overrides[name]
    if (name.startsWith('@/')) return load('src/' + name.slice(2) + '.ts', overrides)
    return require(name)
  }
  vm.runInNewContext(output, { module, exports: module.exports, require: localRequire, Date, Map, Error, console }, { filename: relative })
  return module.exports
}

const touched = []
const overrides = {
  'next/server': { NextResponse: { json: (body, init = {}) => ({ body, status: init.status ?? 200, headers: init.headers ?? {} }) } },
  '@/lib/db': new Proxy({}, { get: (_target, property) => { touched.push(String(property)); throw new Error('the closed RSVP endpoints must not use the database') } }),
}
const ROUTES = ['src/app/api/rsvp/route.ts', 'src/app/api/rsvp/verify/route.ts']

test('old open RSVP endpoints are closed: 410 for every request, no database access', async () => {
  for (const file of ROUTES) {
    const route = load(file, overrides)
    const response = await route.POST({ json: async () => ({ name: 'Anyone At All', email: 'anyone@example.com', attending: 'yes' }), headers: { get: () => '1.2.3.4' } })
    assert.equal(response.status, 410, file)
    assert.equal(response.body.success, false)
    assert.equal(response.body.reason, 'invitation_only')
    assert.match(response.body.error, /personal invitation/)
    assert.equal(response.headers['Cache-Control'], 'no-store')
    assert.deepEqual(Object.keys(route), ['POST'], file + ' exposes only POST')
  }
  assert.deepEqual(touched, [])
})

test('old open RSVP endpoints contain no database or guest-list code', () => {
  for (const file of ROUTES) {
    const source = read(file)
    assert.ok(!/getDb|schema\.|drizzle|insert\(|select\(|guestList|rsvpAccessMode/.test(source), file)
  }
})

test('the public RSVP dialog only checks status and never posts an RSVP', () => {
  const dialog = read('src/components/sections/RSVPDialog.tsx') + read('src/components/rsvp/useStatusCheck.ts')
  assert.ok(dialog.includes("'/api/invite/lookup'"))
  assert.ok(dialog.includes("'/api/invite/change-request'"))
  assert.ok(!/['"`]\/api\/rsvp/.test(dialog), 'the dialog must not call the closed endpoints')
  assert.ok(!/attending|songRequest|dietary/.test(dialog), 'no RSVP form fields in the public dialog')
  assert.ok(!fs.existsSync(path.join(root, 'src/components/sections/RSVPSection.tsx')), 'the old RSVP form component is gone')
})

test('rate limiter: allows up to the limit, then blocks until the window resets, with bounded memory', () => {
  const { createRsvpRateLimiter } = load('src/lib/rsvp-policy.ts')
  const limited = createRsvpRateLimiter(3, 1000, 2)
  assert.deepEqual([limited('a', 0), limited('a', 1), limited('a', 2), limited('a', 3)], [false, false, false, true])
  assert.equal(limited('a', 1001), false, 'a new window starts after the old one ends')
  assert.equal(limited('b', 1002), false)
  assert.equal(limited('c', 1003), false, 'a third address is accepted by evicting, not by growing')
  assert.equal(limited('c', 1004), false)
})
