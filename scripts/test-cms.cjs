/* Offline CMS contract regression tests. No network, database, or framework writes. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
let authenticated = true
let oldSchema = true
let writes = []
const stored = { id: 7, partner1: 'Saved partner', ceremonyVenue: 'Saved venue', rsvpAccessMode: null }
const columns = Object.fromEntries(['id', 'partner1', 'ceremonyVenue', 'rsvpAccessMode', 'sitePresentation'].map(key => [key, key]))
const schema = { weddingConfig: columns, rsvps: { createdAt: 'createdAt' } }
const db = {
  select(selection) {
    let table
    const result = () => {
      if (selection?.value === 'sitePresentation') {
        if (oldSchema) throw new Error('column site_presentation does not exist')
        return [{ value: null }]
      }
      if (table === schema.rsvps) return []
      assert(selection && !('sitePresentation' in selection), 'Legacy query must not select optional column')
      return [{ ...stored }]
    }
    const chain = {
      from(value) { table = value; return chain },
      where() { return chain },
      limit: async () => result(),
      orderBy: async () => result(),
    }
    return chain
  },
  update() { return { set(value) { return { where: async () => { writes.push(value) } } } } },
  insert() { return { values: async value => { writes.push(value) } } },
}
const mocks = {
  '@/lib/db': { getDb: () => db, schema },
  './db': { getDb: () => db, schema },
  '@/lib/auth': { isAdminRequest: async () => authenticated },
  'drizzle-orm': { eq: () => true, getTableColumns: table => table },
  'next/server': { NextResponse: { json: (body, options) => ({ status: options?.status ?? 200, json: async () => body }) } },
  'next/cache': { revalidatePath: () => {} },
}
const cache = new Map()
function load(relative) {
  const file = path.resolve(root, relative)
  if (cache.has(file)) return cache.get(file)
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
  const mod = { exports: {} }
  const localRequire = name => {
    if (mocks[name]) return mocks[name]
    if (name.startsWith('@/')) return load(`src/${name.slice(2)}.ts`)
    if (name.startsWith('.')) return load(path.relative(root, path.resolve(path.dirname(file), name + '.ts')))
    return require(name)
  }
  new Function('require', 'module', 'exports', code)(localRequire, mod, mod.exports)
  cache.set(file, mod.exports)
  return mod.exports
}
const route = load('src/app/api/admin/route.ts')
const config = load('src/lib/config.ts')
const { DEFAULT_PRESENTATION, sitePresentationSchema, parseSitePresentation } = load('src/lib/presentation.ts')
const request = body => ({ json: async () => body })
let checks = 0
async function test(label, action) { await action(); checks++; console.log(`PASS ${label}`) }
;(async () => {
  await test('admin GET/POST require authentication with no writes', async () => {
    authenticated = false
    assert.equal((await route.GET(request())).status, 401)
    assert.equal((await route.POST(request({ partner1: 'Changed' }))).status, 401)
    assert.equal(writes.length, 0)
    authenticated = true
  })
  await test('old schema public config preserves saved values', async () => {
    const value = await config.getWeddingConfig()
    assert.equal(value.partner1, stored.partner1)
    assert.equal(value.ceremonyVenue, stored.ceremonyVenue)
    assert.equal(value.rsvpAccessMode, 'open')
    assert.deepEqual(value.presentation, DEFAULT_PRESENTATION)
  })
  await test('old schema admin GET omits unavailable column', async () => {
    const response = await route.GET(request())
    assert.equal(response.status, 200)
    const value = await response.json()
    assert.equal(value.config.partner1, stored.partner1)
    assert(!Object.hasOwn(value.config, 'sitePresentation'))
    assert.match(value.warning, /migration/)
  })
  await test('whole-config legacy save succeeds with nullable access mode', async () => {
    const loaded = await (await route.GET(request())).json()
    const response = await route.POST(request({ ...loaded.config, partner1: 'Edited partner' }))
    assert.equal(response.status, 200)
    assert.equal(writes.at(-1).partner1, 'Edited partner')
    assert.equal(writes.at(-1).rsvpAccessMode, null)
    assert(!Object.hasOwn(writes.at(-1), 'sitePresentation'))
    assert(!Object.hasOwn(writes.at(-1), 'id'))
  })
  await test('intentional presentation save is blocked before writes without migration', async () => {
    const count = writes.length
    for (const payload of [{ presentation: DEFAULT_PRESENTATION }, { sitePresentation: JSON.stringify(DEFAULT_PRESENTATION) }]) {
      assert.equal((await route.POST(request(payload))).status, 503)
    }
    assert.equal(writes.length, count)
  })
  await test('invalid payloads and unsafe URLs fail without writes', async () => {
    const count = writes.length
    const bad = [null, [], {}, { partner1: 5 }, { rsvpAccessMode: 'unsafe' }, { sitePresentation: '{}' }, { presentation: { ...DEFAULT_PRESENTATION, footerContactUrl: 'javascript:alert(1)' } }, { presentation: { ...DEFAULT_PRESENTATION, ceremonyMapEmbedUrl: 'not a url' } }]
    for (const value of bad) assert.equal((await route.POST(request(value))).status, 400)
    assert.equal((await route.POST({ json: async () => { throw Error('invalid') } })).status, 400)
    assert.equal(writes.length, count)
  })
  await test('migrated presentation saves through both supported payload shapes', async () => {
    oldSchema = false
    for (const payload of [{ presentation: DEFAULT_PRESENTATION }, { sitePresentation: JSON.stringify(DEFAULT_PRESENTATION) }]) {
      assert.equal((await route.POST(request(payload))).status, 200)
      assert.deepEqual(JSON.parse(writes.at(-1).sitePresentation), DEFAULT_PRESENTATION)
    }
  })
  await test('defaults, partial merge, empty image list and URL boundaries', async () => {
    assert(sitePresentationSchema.safeParse(DEFAULT_PRESENTATION).success)
    assert.equal(parseSitePresentation('{bad').ceremonyAlias, DEFAULT_PRESENTATION.ceremonyAlias)
    assert.equal(parseSitePresentation('{"ceremonyAlias":"Custom"}').ceremonyAlias, 'Custom')
    assert.deepEqual(parseSitePresentation('{"ceremonyImages":[]}').ceremonyImages, [])
    for (const src of ['javascript:alert(1)', '//evil.example/img', 'data:image/svg+xml,test']) {
      assert(!sitePresentationSchema.safeParse({ ...DEFAULT_PRESENTATION, ceremonyImages: [{ src, alt: '', label: '' }] }).success)
    }
  })
  console.log(`\n${checks} CMS regression groups passed; no live database accessed.`)
})().catch(error => { console.error(error); process.exitCode = 1 })
