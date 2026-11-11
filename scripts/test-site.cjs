const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
const read = file => fs.readFileSync(path.join(root, file), 'utf8')

// Compile a production module in memory. These modules are pure: no network, no database.
function load(relative) {
  const output = ts.transpileModule(read(relative), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText
  const module = { exports: {} }
  vm.runInNewContext(output, { module, exports: module.exports, require, Math, Number, JSON, URL, structuredClone }, { filename: relative })
  return module.exports
}
const plain = value => JSON.parse(JSON.stringify(value))
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u

// ─── Loading screen ───────────────────────────────────────────────────────────
const assets = load('src/lib/loading/assets.ts')

test('loading: every listed asset exists and every referenced site asset is listed', () => {
  for (const asset of assets.SITE_ASSETS) assert.ok(fs.existsSync(path.join(root, 'public', asset.url)), asset.url)
  const listed = new Set(assets.SITE_ASSETS.map(asset => asset.url))
  const referenced = new Set()
  const walk = dir => { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const full = path.join(dir, entry.name); if (entry.isDirectory()) walk(full); else if (/\.tsx?$/.test(entry.name) && !full.includes(path.join('lib', 'loading'))) for (const match of fs.readFileSync(full, 'utf8').matchAll(/\/wedding\/[A-Za-z0-9._-]+\.(?:jpg|png|glb)/g)) referenced.add(match[0]) } }
  walk(path.join(root, 'src'))
  for (const url of referenced) assert.ok(listed.has(url), url + ' is used by the site but not preloaded')
})

test('loading: progress runs from 0 to 1, never beyond, and ignores bad input', () => {
  assert.equal(assets.progressOf(0), 0)
  assert.equal(assets.progressOf(assets.TOTAL_WEIGHT), 1)
  assert.equal(assets.progressOf(assets.TOTAL_WEIGHT * 3), 1)
  for (const bad of [-5, NaN, Infinity, undefined]) assert.equal(assets.progressOf(bad), 0)
  const half = assets.progressOf(assets.TOTAL_WEIGHT / 2)
  assert.ok(half > 0.49 && half < 0.51)
  const sum = assets.SITE_ASSETS.reduce((total, asset) => total + asset.weight, 0) + assets.EXTRA_STEPS.fonts + assets.EXTRA_STEPS.engine + assets.EXTRA_STEPS.video
  assert.equal(assets.TOTAL_WEIGHT, sum)
})

test('loading: stage lines follow the progress in order and contain no emoji', () => {
  assert.deepEqual([0, 0.29, 0.3, 0.59, 0.6, 0.89, 0.9, 1].map(assets.stageLabel), [
    'Gathering the flowers', 'Gathering the flowers', 'Lighting the candles', 'Lighting the candles',
    'Setting the table', 'Setting the table', 'Opening the doors', 'Opening the doors',
  ])
  assert.ok(!EMOJI.test(JSON.stringify(assets.STAGES)))
})

test('loading: the returning-visitor cookie holds no personal data and is scoped safely', () => {
  assert.equal(assets.visitedCookie(true), 'lb_visited=1; Max-Age=15552000; Path=/; SameSite=Lax; Secure')
  assert.equal(assets.visitedCookie(false), 'lb_visited=1; Max-Age=15552000; Path=/; SameSite=Lax')
})

test('loading: a guest can never be trapped behind the welcome', () => {
  const { TIMING } = assets
  assert.ok(TIMING.offerSkipAfterMs < TIMING.hardCapMs && TIMING.hardCapMs <= 20000)
  const preloader = read('src/components/loading/SitePreloader.tsx')
  assert.match(preloader, /TIMING\.hardCapMs/)
  assert.match(preloader, /Enter now/)
  assert.match(read('src/lib/loading/preload.ts'), /image\.onerror = \(\) => resolve\(\)/)
  assert.match(read('src/app/page.tsx'), /<noscript><style>\{'\.site-preloader\{display:none\}'\}<\/style><\/noscript>/)
  const css = read('src/app/globals.css')
  assert.match(css, /\.site-preloader\{[^}]*animation:site-preloader-failsafe 0s linear 30s forwards/)
  assert.match(css, /@keyframes site-preloader-failsafe\{to\{visibility:hidden/)
})

test('loading: site artwork is cached by the browser', () => {
  const config = require(path.join(root, 'next.config.js'))
  return config.headers().then(rules => {
    const rule = rules.find(item => item.source === '/wedding/:path*')
    assert.ok(rule)
    assert.match(rule.headers.find(header => header.key === 'Cache-Control').value, /^public, max-age=\d{6,}, stale-while-revalidate=\d+$/)
  })
})

// ─── Status bar colour ────────────────────────────────────────────────────────
const status = load('src/lib/loading/status-color.ts')
const node = (selectors, background, parent = null) => ({ matches: selector => selectors.includes(selector), background, parent })

test('status bar: the colour follows the section at the top of the screen', () => {
  const page = node([], 'rgb(253, 250, 246)')
  assert.equal(status.statusColorFor(node([], 'rgba(0, 0, 0, 0)', node(['#home'], 'rgba(0, 0, 0, 0)', page))), status.STATUS_COLORS.hero)
  assert.equal(status.statusColorFor(node([], 'rgba(0, 0, 0, 0)', node(['#countdown'], 'rgba(0, 0, 0, 0)', page))), status.STATUS_COLORS.night)
  assert.equal(status.statusColorFor(node(['.site-preloader'], 'rgba(0, 0, 0, 0)', page)), status.STATUS_COLORS.cream)
  assert.equal(status.statusColorFor(node([], 'rgba(0, 0, 0, 0)', node([], 'rgb(46, 31, 26)', page))), 'rgb(46, 31, 26)')
  assert.equal(status.statusColorFor(node([], 'rgba(0, 0, 0, 0.6)', page)), 'rgb(253, 250, 246)', 'see-through layers are skipped')
  assert.equal(status.statusColorFor(null), status.STATUS_COLORS.cream)
  assert.equal(status.statusColorFor(node([], 'transparent')), status.STATUS_COLORS.cream)
})

test('status bar: only fully solid colours count', () => {
  for (const solid of ['rgb(1, 2, 3)', 'rgba(1, 2, 3, 1)', 'rgb(1 2 3)', 'rgb(1 2 3 / 1)']) assert.equal(status.isOpaqueColor(solid), true, solid)
  for (const other of ['rgba(1, 2, 3, 0)', 'rgba(1, 2, 3, 0.99)', 'transparent', '', 'red', 'rgb(1 2 3 / 0.5)']) assert.equal(status.isOpaqueColor(other), false, other)
})

test('status bar: no fixed pink theme colour remains', () => {
  const layout = read('src/app/layout.tsx')
  assert.ok(!/themeColor:\s*'#C96070'/i.test(layout))
  assert.match(layout, /themeColor:\s*'#FDFAF6'/)
  assert.match(read('src/app/page.tsx'), /<StatusBarColor \/>/)
})

// ─── Requested clean-up ───────────────────────────────────────────────────────
test('home: removed controls stay removed', () => {
  assert.ok(!fs.existsSync(path.join(root, 'src/components/ui/SiteOptions.tsx')))
  assert.ok(!fs.existsSync(path.join(root, 'src/app/credits')))
  const sources = ['src/components/WeddingSite.tsx', 'src/components/sections/Footer.tsx', 'src/components/sections/Countdown.tsx', 'src/world/Journey.tsx'].map(read).join('\n')
  for (const gone of ['SiteOptions', 'Stargazing', 'Dancing</button>', 'Skip story', 'RSVP now', 'Asset licenses', 'Reduce motion', '/credits']) {
    assert.ok(!sources.includes(gone), gone + ' is still present')
  }
})

test('home: the hero buttons share one width', () => {
  const hero = read('src/components/sections/Hero.tsx')
  assert.match(hero, /inline-grid grid-cols-1 sm:grid-cols-2 gap-4/)
  assert.equal((hero.match(/className=[`"{]+flex w-full items-center justify-center/g) || []).length, 3)
})

test('home: the footer contact is one quiet line', () => {
  const footer = read('src/components/sections/Footer.tsx')
  assert.match(footer, /className="footer-note"/)
  assert.ok(!/<h2[^>]*>Want something like this/.test(footer))
  assert.match(read('src/app/globals.css'), /\.footer-note\{[^}]*font-size:13px[^}]*opacity:\.5/)
})

test('games: hidden unless switched on, and free of emoji and coloured borders', () => {
  const { DEFAULT_PRESENTATION, sitePresentationSchema, parseSitePresentation } = load('src/lib/presentation.ts')
  assert.equal(DEFAULT_PRESENTATION.showGames, false)
  assert.equal(parseSitePresentation(null).showGames, false)
  assert.equal(parseSitePresentation(JSON.stringify({ receptionNote: 'An older saved value' })).showGames, false)
  assert.equal(parseSitePresentation(JSON.stringify({ showGames: true })).showGames, true)
  assert.equal(sitePresentationSchema.safeParse({ ...plain(DEFAULT_PRESENTATION), showGames: 'yes' }).success, false)
  assert.match(read('src/components/WeddingSite.tsx'), /\{config\.presentation\.showGames && <GamesSection \/>\}/)
  const games = read('src/components/sections/GamesSection.tsx')
  assert.ok(!EMOJI.test(games))
  assert.ok(!/border-rose|hover:border-|Challenge your guests|→|←/.test(games))
})
