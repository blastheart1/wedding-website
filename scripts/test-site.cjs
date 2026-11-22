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
  for (const url of [...assets.FALLBACK_ASSETS, ...assets.OPTIMISED_ASSETS]) assert.ok(fs.existsSync(path.join(root, 'public', url)), url)
  const listed = new Set([...assets.SITE_ASSETS.map(asset => asset.url), ...assets.FALLBACK_ASSETS, ...assets.OPTIMISED_ASSETS])
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
  const sum = assets.GATE_ASSETS.reduce((total, asset) => total + asset.weight, 0) + assets.EXTRA_STEPS.fonts + assets.EXTRA_STEPS.engine + assets.EXTRA_STEPS.photos
  assert.equal(assets.TOTAL_WEIGHT, sum)
})

test('loading: the couple model is the compressed copy, with the original as the fallback and never warmed', () => {
  const rig = read('src/world/RiggedCouple.ts')
  assert.match(rig, /setMeshoptDecoder\(MeshoptDecoder\)/)
  assert.match(rig, /COUPLE_MODEL_URLS=\['\/wedding\/wedding-couple-storyboard\.min\.glb','\/wedding\/wedding-couple-storyboard\.glb'\]/)
  assert.ok(assets.BACKGROUND_ASSETS.some(asset => asset.url.endsWith('.min.glb')))
  assert.ok(!assets.SITE_ASSETS.some(asset => asset.url === '/wedding/wedding-couple-storyboard.glb'), 'the 3.7 MB original is not warmed')
  const small = fs.statSync(path.join(root, 'public/wedding/wedding-couple-storyboard.min.glb')).size
  assert.ok(small < fs.statSync(path.join(root, 'public/wedding/wedding-couple-storyboard.glb')).size / 2)
})

test('photos: church photos go through the optimizer, with the layout untouched and unknown hosts left alone', () => {
  const details = read('src/components/sections/Details.tsx')
  assert.match(details, /optimisedImage\(selectedPhoto\.src/)
  assert.match(details, /optimisedImage\(p\.src/)
  assert.ok(!/<img src=\{p\.src\} alt=""\/>/.test(details), 'thumbnails are no longer eager raw originals')
  const helper = read('src/lib/images/optimised-props.ts')
  assert.match(helper, /res\\\.cloudinary\\\.com/)
  assert.match(helper, /OPTIMISABLE\.some/)
  assert.ok(!assets.BACKGROUND_ASSETS.some(asset => /church|scene-/.test(asset.url)), 'originals the page shows through the optimizer are not downloaded a second time')
})

test('fonts: every face is served as WOFF2 first with the TTF kept as the fallback, and both files exist', () => {
  const css = read('src/app/globals.css')
  const faces = css.match(/@font-face\s*\{[^}]*\}/g) || []
  assert.equal(faces.length, 6)
  for (const face of faces) {
    const woff = /url\(\/wedding\/(font-\d)\.woff2\) format\(['"]woff2['"]\)\s*,\s*url\(\/wedding\/(font-\d)\.ttf\) format\(['"]truetype['"]\)/.exec(face)
    assert.ok(woff && woff[1] === woff[2], 'woff2 first, then the matching ttf')
    assert.ok(/font-display:\s*swap/.test(face))
    for (const ext of ['woff2', 'ttf']) assert.ok(fs.existsSync(path.join(root, 'public/wedding', woff[1] + '.' + ext)))
    assert.ok(fs.statSync(path.join(root, 'public/wedding', woff[1] + '.woff2')).size < fs.statSync(path.join(root, 'public/wedding', woff[1] + '.ttf')).size)
  }
})

test('loading: the welcome holds the first screen, the 3D scenes and the first photos, within a 6 s cap; the rest loads behind the doors', () => {
  assert.ok(assets.GATE_ASSETS.length <= 2 && assets.GATE_ASSETS.reduce((total, asset) => total + asset.weight, 0) <= 300, 'the gate files stay tiny')
  assert.ok(assets.GATE_ASSETS.every(asset => asset.kind === 'image'), 'no raw model or video on the gate')
  assert.equal(assets.TIMING.hardCapMs, 6000)
  assert.ok(assets.EXTRA_STEPS.engine > 0 && assets.EXTRA_STEPS.photos > 0 && assets.FIRST_PHOTOS >= 1 && assets.FIRST_PHOTOS <= 10)
  const heavy = assets.SITE_ASSETS.filter(asset => asset.weight > 300).map(asset => asset.url)
  for (const url of heavy) assert.ok(!assets.GATE_ASSETS.some(asset => asset.url === url), url + ' is not held by the gate as a raw file')
  assert.deepEqual([...assets.SITE_ASSETS.map(a => a.url)].sort(), [...assets.GATE_ASSETS, ...assets.BACKGROUND_ASSETS].map(a => a.url).sort())
  assert.equal(new Set(assets.SITE_ASSETS.map(a => a.url)).size, assets.SITE_ASSETS.length, 'no asset twice')
  const preload = read('src/lib/loading/preload.ts')
  const gate = preload.slice(preload.indexOf('export function preloadSite'), preload.indexOf('const WARM_CONCURRENCY'))
  assert.match(gate, /loadEngine\(\)\.then\(worldPrepared/, 'the 3D scenes are prepared behind the doors')
  assert.match(gate, /run: firstPhotos/)
  assert.ok(!/videoReady|BACKGROUND_ASSETS/.test(gate), 'the gate waits for no video or background asset')
  const preloader = read('src/components/loading/SitePreloader.tsx')
  assert.match(preloader, /photos\.firstSettled\(FIRST_PHOTOS\)/)
  assert.match(preloader, /afterPhotosSettled\(\(\) => \{ void warmSite\(\) \}\)/, 'the leftovers warm once the photos are in')
  assert.match(read('src/app/layout.tsx'), /rel="preconnect" href="https:\/\/res\.cloudinary\.com"/)
})

test('loading: runLimited keeps to its limit, keeps going after a failure, and starts nothing twice', async () => {
  const { runLimited } = load('src/lib/loading/run-limited.ts')
  let running = 0, peak = 0
  const seen = []
  await runLimited([1, 2, 3, 4, 5, 6, 7], 3, async item => {
    running++; peak = Math.max(peak, running); seen.push(item)
    await new Promise(resolve => setTimeout(resolve, 5))
    running--
    if (item === 2) throw new Error('one fails')
  })
  assert.equal(peak, 3)
  assert.deepEqual(seen.sort(), [1, 2, 3, 4, 5, 6, 7])
  await runLimited([], 3, async () => { throw new Error('never') })
})

test('photos: previews are tiny, made from the same source, and only for hosts we know', () => {
  const { previewUrl, PREVIEW_TRANSFORM } = load('src/lib/loading/previews.ts')
  const hosted = 'https://res.cloudinary.com/demo/image/upload/v1774645832/wedding/abc.jpg'
  assert.equal(previewUrl(hosted), 'https://res.cloudinary.com/demo/image/upload/' + PREVIEW_TRANSFORM + '/v1774645832/wedding/abc.jpg')
  assert.equal(previewUrl('/_next/image?url=' + encodeURIComponent(hosted) + '&w=1080&q=75'), previewUrl(hosted), 'the optimizer address resolves to the same photo')
  assert.equal(previewUrl('/_next/image?url=%2Fwedding%2Fchurch-1.jpg&w=1200&q=75'), '/_next/image?url=%2Fwedding%2Fchurch-1.jpg&w=16&q=20')
  assert.equal(previewUrl('/wedding/attire/mens-outfit.webp'), '/_next/image?url=%2Fwedding%2Fattire%2Fmens-outfit.webp&w=16&q=20')
  for (const none of ['', 'https://example.com/a.jpg', '/_next/image?url=https%3A%2F%2Fexample.com%2Fa.jpg&w=640&q=75', 'https://res.cloudinary.com/demo/image/upload/w_100/v1/a.jpg', 'https://res.cloudinary.com/demo/video/upload/v1/a.mp4', '/_next/image', 'http://[bad']) assert.equal(previewUrl(none), null, none)
  assert.ok(PREVIEW_TRANSFORM.includes('w_24') && PREVIEW_TRANSFORM.includes('e_blur'))
})

test('photos: the look-ahead follows the guest\'s speed and direction, ignores stray spikes, and a pause means no lead', () => {
  const { predictedViewTop, smoothedVelocity, distanceFromView, closestToView, isUrgent } = load('src/lib/loading/nearest.ts')
  assert.equal(predictedViewTop(1000, 0), 1000)
  assert.equal(predictedViewTop(1000, 2500), 4000, 'a flick of 2500 px/s looks 3000 px ahead')
  assert.equal(predictedViewTop(1000, -500), 400, 'scrolling up looks up')
  assert.equal(predictedViewTop(1000, 1e9), 6000, 'capped')
  assert.equal(predictedViewTop(1000, -1e9), 0, 'never above the top of the page')
  for (const bad of [NaN, Infinity, -Infinity, undefined]) assert.equal(predictedViewTop(1000, bad), 1000)
  assert.equal(smoothedVelocity(0, 100, 100, 0), 600)
  assert.equal(smoothedVelocity(1000, 100, 100, 0), 1000 * 0.4 + 600)
  assert.equal(smoothedVelocity(900, 50, 100, 400), 0, 'a pause counts as stopped')
  assert.equal(smoothedVelocity(700, 50, 0, 0), 700, 'no time passed, no change')
  assert.equal(distanceFromView(0, 100, 1000, 800, -1), 900, 'scrolling up: a photo above is ahead, at full distance')
  assert.equal(distanceFromView(2000, 2100, 1000, 800, -1), 400, 'scrolling up: a photo below is behind, at double')
  const items = [{ id: 'above', top: 100, bottom: 400 }, { id: 'below', top: 2600, bottom: 3000 }]
  assert.equal(closestToView(items, i => i, 1000, 800, 1).id, 'below')
  assert.equal(closestToView(items, i => i, 1000, 800, -1).id, 'above')
  assert.equal(isUrgent(1200, 800), true)
  assert.equal(isUrgent(1201, 800), false)
})

test('photos: the photo nearest the screen is always next, below first, passed ones count double', () => {
  const { distanceFromView, closestToView } = load('src/lib/loading/nearest.ts')
  assert.equal(distanceFromView(100, 300, 0, 800), 0, 'on screen')
  assert.equal(distanceFromView(1000, 1200, 0, 800), 200, 'below')
  assert.equal(distanceFromView(0, 100, 500, 800), 800, 'above counts double')
  const items = [{ id: 'far', top: 5000, bottom: 5400 }, { id: 'passed', top: 0, bottom: 300 }, { id: 'next', top: 1500, bottom: 1900 }, { id: 'here', top: 600, bottom: 900 }]
  assert.equal(closestToView(items, item => item, 500, 800).id, 'here')
  assert.equal(closestToView(items.filter(item => item.id !== 'here'), item => item, 500, 800).id, 'next', 'below beats a photo just passed only when nearer')
  assert.equal(closestToView([], item => item, 0, 800), undefined)
  assert.equal(closestToView([{ top: 900, bottom: 1000 }, { top: 900, bottom: 1000 }], item => item, 0, 800).top, 900)
})

test('photos: the warmer brings lazy photos forward, nearest the guest first, with priority hints and previews', () => {
  const warmer = read('src/lib/loading/photo-warmer.ts')
  assert.match(warmer, /querySelectorAll<LazyPhoto>\('img\[loading="lazy"\]'\)/)
  assert.match(warmer, /photo\.loading = 'eager'/)
  assert.match(warmer, /photo\.decode\(\)/)
  assert.match(warmer, /closestToView\(waiting, rangeOf, ahead\.top/)
  assert.match(warmer, /predictedViewTop\(window\.scrollY, speed\)/)
  assert.match(warmer, /photo\.fetchPriority = urgent \? 'high' : 'low'/)
  assert.match(warmer, /previewUrl\(photo\.getAttribute\('src'\)/)
  assert.match(warmer, /firstSettled: count =>/)
  assert.match(warmer, /window\.addEventListener\('scroll', onScroll, \{ passive: true \}\)/)
  assert.match(warmer, /new IntersectionObserver/)
  assert.match(warmer, /LOOK_AHEAD_SCREENS \* 100/)
  assert.match(warmer, /new MutationObserver/)
  assert.match(warmer, /saveData/)
  assert.match(warmer, /if \(current\) return current/, 'started once, the same handle every time')
  assert.match(warmer, /removeEventListener\('error', finish\)/)
  assert.match(read('src/app/globals.css'), /img\[data-photo-pending\]\{background-color:[^}]*background-image:var\(--photo-preview,none\)/)
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
  assert.ok(TIMING.offerSkipAfterMs < TIMING.hardCapMs && TIMING.hardCapMs === 6000)
  const preloader = read('src/components/loading/SitePreloader.tsx')
  assert.match(preloader, /TIMING\.hardCapMs - performance\.now\(\)/, 'the limit counts from navigation')
  assert.ok(TIMING.capFloorMs > 0 && TIMING.capFloorMs < TIMING.hardCapMs)
  assert.match(preloader, /Enter now/)
  assert.match(read('src/lib/loading/preload.ts'), /image\.onerror = \(\) => resolve\(\)/)
  assert.match(read('src/app/page.tsx'), /<noscript><style>\{'\.site-preloader\{display:none\}'\}<\/style><\/noscript>/)
  const css = read('src/app/globals.css')
  assert.match(css, /\.site-preloader\{[^}]*animation:site-preloader-failsafe 0s linear 30s forwards/)
  assert.match(css, /@keyframes site-preloader-failsafe\{to\{visibility:hidden/)
})

test('loading: a reload opens onto the top of the page, not where it was scrolled to', () => {
  const preloader = read('src/components/loading/SitePreloader.tsx')
  assert.match(preloader, /history\.scrollRestoration = 'manual'/)
  // The page scrolls smoothly by default; the jump to the top must not be animated behind the doors.
  assert.match(preloader, /window\.scrollTo\(\{ top: 0, behavior: 'instant' \}\)/)
  // An address that names a place (#rsvp, #details) is left alone.
  assert.match(preloader, /!window\.location\.hash/)
  assert.match(preloader, /history\.scrollRestoration = previousRestoration/)
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

test('home: the maker\'s contact is tucked under the footer\'s folded corner', () => {
  const footer = read('src/components/sections/Footer.tsx')
  assert.match(footer, /<CornerPeel email=\{config\.presentation\.footerContactEmail\} url=\{config\.presentation\.footerContactUrl\} \/>/)
  assert.ok(!/Want something like this|footer-note/.test(footer), 'the contact line is no longer printed on the footer itself')
  const peel = read('src/components/footer/CornerPeel.tsx')
  assert.match(peel, /aria-label="Peel back the corner of the page"/)
  assert.match(peel, /<Mail size=\{18\}/, 'the email link is a mail icon')
  assert.match(peel, /aria-label="Send an email"/, 'the icon has a spoken label')
  assert.ok(!/>\s*Email\s*</.test(peel), 'the word Email is not shown')
  assert.match(peel, /if \(!email && !url\) return null/, 'no corner when there is nothing to show')
  assert.ok(!EMOJI.test(peel))
  assert.match(peel, /prefers-reduced-motion/, 'reduced motion folds without animating')
  assert.match(read('src/components/footer/useEspressoPlayer.ts'), /prefers-reduced-motion/, 'reduced motion shows each step as a still')
  assert.match(peel, /onPointerDown=\{onPointerDown\}/, 'the corner can be dragged')
  const bounce = read('src/components/footer/useCornerBounce.ts')
  assert.match(peel, /useCornerBounce\(corner\)/)
  assert.match(bounce, /window\.scrollY \+ window\.innerHeight - document\.documentElement\.scrollHeight/, 'the corner knows how far past its end the page is')
  assert.match(bounce, /element\.style\.setProperty\('--bounce'/, 'the fold moves with the bounce')
  assert.match(bounce, /target = -Math\.min\(MAX_PRESS,/, 'pulling past the end presses the fold flat first')
  assert.match(bounce, /Math\.min\(MAX_LIFT, Math\.max\(-MAX_PRESS,/, 'it can spring open past its resting size, within limits')
  assert.match(bounce, /reducedMotion\(\)/, 'no bounce with reduced motion')
  for (const type of ['scroll', 'wheel', 'touchmove']) assert.ok(bounce.includes("addEventListener('" + type + "'") && bounce.includes("removeEventListener('" + type + "'"), type + ' is listened to and cleaned up')
  assert.match(read('src/app/globals.css'), /\.corner-peel\{[^}]*width:calc\(60px \+ var\(--bounce,0px\)\)/)
  assert.match(read('src/app/globals.css'), /\.corner-peel\[data-pinned=true\]\{position:fixed\}/, 'at the end of the page the corner stays in the corner of the screen through a bounce')
  assert.match(peel, /state\.size >= DRAG_OPEN_PX \? 'open' : 'closing'/, 'a short drag folds back, a long one opens')
  assert.match(peel, /if \(dragged\.current\) \{ dragged\.current = false; return \}/, 'the click that ends a drag is not a tap')
  const css = read('src/app/globals.css')
  assert.match(css, /\.corner-peel\{[^}]*touch-action:none/, 'dragging the corner does not scroll the page')
  assert.match(css, /\.peel-dialog\[data-stage=dragging\] \.peel-sheet,\.peel-dialog\[data-stage=dragging\] \.peel-flap\{transition:none\}/, 'the fold tracks the finger without lag')
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

// ─── How the site appears when shared or saved ────────────────────────────────
const share = load('src/lib/share-preview.ts')
const shareInput = { partner1: 'Luis', partner2: 'Bee', date: 'February 27, 2027', title: '', description: '', imageUrl: '', baseUrl: 'https://www.luisandbee.wedding' }

test('link preview: automatic card uses the names, the date and an absolute PNG address', () => {
  const preview = share.sharePreview(shareInput)
  assert.deepEqual(plain(preview), {
    title: 'Luis & Bee',
    description: 'We are getting married on February 27, 2027. Join us to celebrate.',
    url: 'https://www.luisandbee.wedding/',
    image: { url: 'https://www.luisandbee.wedding/preview-image', type: 'image/png', width: 1200, height: 630, alt: 'Luis & Bee, February 27, 2027' },
  })
  assert.ok(!EMOJI.test(JSON.stringify(preview)))
})

test('link preview: custom wording and an uploaded photo replace the automatic card', () => {
  const photo = 'https://res.cloudinary.com/demo/image/upload/v1700000000/wedding/preview/us.png'
  const preview = share.sharePreview({ ...shareInput, title: '  Luis and Bee say I do  ', description: ' Save the date. ', imageUrl: photo })
  assert.equal(preview.title, 'Luis and Bee say I do')
  assert.equal(preview.description, 'Save the date.')
  assert.equal(preview.image.url, 'https://res.cloudinary.com/demo/image/upload/c_fill,g_auto,w_1200,h_630,f_jpg,q_auto/v1700000000/wedding/preview/us.png')
  assert.equal(preview.image.type, 'image/jpeg')
  assert.equal(share.sharePreview({ ...shareInput, title: '   ', imageUrl: '  ' }).title, 'Luis & Bee', 'blank values fall back to the automatic card')
})

test('link preview: photos are cropped once, and other addresses are left alone', () => {
  const sized = share.previewSizedImage('https://res.cloudinary.com/demo/image/upload/v1/a.webp')
  assert.equal(sized, 'https://res.cloudinary.com/demo/image/upload/c_fill,g_auto,w_1200,h_630,f_jpg,q_auto/v1/a.webp')
  assert.equal(share.previewSizedImage(sized), sized, 'never stacks a second crop')
  for (const other of ['https://example.com/photo.jpg', 'https://www.luisandbee.wedding/i/abc/preview-image', 'https://res.cloudinary.com/demo/video/upload/v1/a.mp4', '']) {
    assert.equal(share.previewSizedImage(other), other)
  }
})

test('site identity: icon sizes and names come from the couple', () => {
  assert.deepEqual(plain(share.siteIdentity(' luis ', 'Bee')), { name: ' luis  & Bee', shortName: 'L & B', monogram: 'L&B', background: '#FDFAF6', ink: '#2E1F1A' })
  assert.equal(share.siteIdentity('', 'Bee').monogram, 'B')
  assert.deepEqual([32, 180, 192, 512, 64, 0, NaN, 5000].map(share.isIconSize), [true, true, true, true, false, false, false, false])
})

test('site identity: every page gets the icon, the manifest and a proper preview picture', () => {
  const layout = read('src/app/layout.tsx')
  assert.ok(!EMOJI.test(layout), 'no emoji in the preview title')
  assert.ok(!/garland\.webp/.test(layout), 'the WebP preview picture is gone')
  for (const expected of ["url: '/preview-image'", "'/app-icon/32'", "'/app-icon/180'", "locale:      'en_PH'", 'appleWebApp']) assert.ok(layout.includes(expected), expected)
  assert.match(read('src/app/page.tsx'), /alternates: \{ canonical: preview\.url \}/)
  const manifest = read('src/app/manifest.ts')
  for (const expected of ["display: 'standalone'", "'/app-icon/192'", "'/app-icon/512'", "purpose: 'maskable'"]) assert.ok(manifest.includes(expected), expected)
  const config = require(path.join(root, 'next.config.js'))
  return config.redirects().then(rules => assert.deepEqual(plain(rules), [{ source: '/favicon.ico', destination: '/app-icon/32', permanent: false }]))
})

test('site identity: preview settings are part of the validated site settings', () => {
  const { DEFAULT_PRESENTATION, sitePresentationSchema, parseSitePresentation } = load('src/lib/presentation.ts')
  assert.deepEqual([DEFAULT_PRESENTATION.shareTitle, DEFAULT_PRESENTATION.shareDescription, DEFAULT_PRESENTATION.shareImageUrl], ['', '', ''])
  assert.equal(parseSitePresentation(JSON.stringify({ receptionNote: 'older saved value' })).shareImageUrl, '')
  assert.equal(sitePresentationSchema.safeParse({ ...plain(DEFAULT_PRESENTATION), shareImageUrl: 'javascript:alert(1)' }).success, false)
  assert.equal(sitePresentationSchema.safeParse({ ...plain(DEFAULT_PRESENTATION), shareImageUrl: 'http://insecure.example/x.jpg' }).success, false)
  assert.equal(sitePresentationSchema.safeParse({ ...plain(DEFAULT_PRESENTATION), shareTitle: 'x'.repeat(121) }).success, false)
  assert.equal(sitePresentationSchema.safeParse({ ...plain(DEFAULT_PRESENTATION), shareImageUrl: 'https://res.cloudinary.com/demo/image/upload/v1/a.jpg', shareTitle: 'Us' }).success, true)
})

// ─── Scroll performance and browser bars ──────────────────────────────────────
test('performance: the background video is requested in a lighter form, once', () => {
  const media = load('src/lib/media.ts')
  const original = 'https://res.cloudinary.com/demo/video/upload/v1774637039/DSCF1010_bt6bpl.mp4'
  const light = media.backgroundVideoUrl(original)
  assert.equal(light, 'https://res.cloudinary.com/demo/video/upload/q_auto:good,w_1280,c_limit,vc_h264,ac_none/v1774637039/DSCF1010_bt6bpl.mp4')
  assert.equal(media.backgroundVideoUrl(light), light, 'an address that already has a transformation is left alone')
  assert.equal(media.backgroundVideoUrl('https://res.cloudinary.com/demo/video/upload/clip.mp4'), 'https://res.cloudinary.com/demo/video/upload/q_auto:good,w_1280,c_limit,vc_h264,ac_none/clip.mp4')
  for (const other of ['https://example.com/video.mp4', '/wedding/scene-5.mp4', '', 'https://res.cloudinary.com/demo/image/upload/v1/a.jpg']) assert.equal(media.backgroundVideoUrl(other), other)
  const hero = read('src/components/sections/Hero.tsx')
  assert.match(hero, /src=\{videoSrc\}/)
  assert.match(hero, /backgroundVideoUrl\(heroVideoUrl, window\.matchMedia\('\(max-width: 767px\)'\)\.matches\)/)
  assert.match(hero, /if \(saveData\) return/)
  assert.equal(media.backgroundVideoUrl(original, true).includes(media.PHONE_VIDEO_TRANSFORM), true, 'phones get the small copy')
  assert.ok(media.PHONE_VIDEO_TRANSFORM.includes('w_720') && media.PHONE_VIDEO_TRANSFORM.includes('ac_none'))
  assert.match(hero, /ref=\{modalVideoRef\}\s+src=\{heroVideoUrl\}/, 'the story player keeps the original video with sound')
})

test('performance: 3D scenes are prepared during the welcome, not during a scroll', () => {
  const world = read('src/world/WeddingWorld.tsx')
  assert.match(world, /function warmUp\(\)/)
  assert.match(world, /renderer\.compile\(world\.scene,camera\)/)
  assert.match(world, /couple=loaded;world\.scene\.add\(loaded\.root\);warmUp\(\)/)
  assert.match(world, /dispatchEvent\(new Event\('wedding-world-ready'\)\)/)
  assert.ok(!/new T\.Fog\([^)]*\)[^\n]*\n[^\n]*drawWorld/.test(world) && (world.match(/new T\.Fog\(/g) || []).length === 2, 'fog objects are created once, not per frame')
  assert.ok(!/world\.scene\.background=kind==='peek'\?null:new T\.Color/.test(world), 'background colours are reused')
  assert.match(read('src/components/WeddingSite.tsx'), /setWorldReady\(true\)/)
  const site = read('src/components/WeddingSite.tsx')
  assert.match(site, /setWorldReady\(true\)/, 'the engine starts straight away, behind the welcome')
  assert.ok(!/afterPhotosSettled|ENGINE_LATEST_MS/.test(site))
  const preload = read('src/lib/loading/preload.ts')
  assert.match(preload, /loadEngine\(\)\.then\(worldPrepared/)
  assert.match(preload, /WORLD_WAIT_MS = 8000/)
})

test('browser bars: the hero colour is read from the video and darkened like its overlay', () => {
  const pixels = (r, g, b, n = 4) => Array.from({ length: n }, () => [r, g, b, 255]).flat()
  assert.equal(status.heroColorFromPixels(pixels(100, 150, 200)), '#283C50')
  assert.equal(status.heroColorFromPixels([...pixels(0, 0, 0, 2), ...pixels(200, 200, 200, 2)]), '#282828', 'averages the strip')
  assert.equal(status.heroColorFromPixels([10, 20, 30, 0, 100, 100, 100, 255]), '#282828', 'ignores empty pixels')
  assert.equal(status.heroColorFromPixels([]), null)
  assert.equal(status.heroColorFromPixels([1, 2, 3, 0]), null)
  const sync = read('src/components/loading/StatusBarColor.tsx')
  assert.match(sync, /UPDATE_EVERY_MS = 120/, 'layout is not read on every scroll frame')
  assert.match(sync, /videoBlocked = true/, 'a video that cannot be read falls back quietly')
})

test('browser bars: the page draws edge to edge and floating controls respect the safe areas', () => {
  const layout = read('src/app/layout.tsx')
  assert.match(layout, /viewportFit:\s+'cover'/)
  assert.match(layout, /statusBarStyle: 'black-translucent'/)
  const css = read('src/app/globals.css')
  for (const rule of ['.site-navbar{top:calc(18px + env(safe-area-inset-top))}', 'body{padding-left:env(safe-area-inset-left);padding-right:env(safe-area-inset-right)}', 'body:not(:has(#home)){padding-top:env(safe-area-inset-top)}', 'env(safe-area-inset-bottom)']) {
    assert.ok(css.includes(rule), rule)
  }
  assert.match(read('src/components/sections/Navbar.tsx'), /'site-navbar fixed top-\[18px\]/)
})

// ─── Footer easter egg: the espresso recipe ───────────────────────────────────
const espresso = load('src/lib/espresso.ts')

test('espresso: 18 g in, 36 g out, in exactly 30 seconds', () => {
  const { RECIPE, TIMELINE } = espresso
  assert.deepEqual(plain(RECIPE), { doseGrams: 18, yieldGrams: 36, shotSeconds: 30 })
  assert.equal(TIMELINE.shotEnd - TIMELINE.shotStart, espresso.SHOT_PLAY, 'the shot plays sped up')
  assert.ok(TIMELINE.total <= 20, 'the whole story is brisk')
  assert.equal(espresso.shotTime(0), TIMELINE.shotStart)
  assert.equal(espresso.shotTime(30), TIMELINE.shotEnd)
  assert.ok(Math.abs(espresso.shotClock(espresso.shotTime(12)) - 12) < 1e-9, 'clock and animation time convert both ways')
  assert.equal(espresso.formatGrams(espresso.doseAt(TIMELINE.doseEnd)), '18.0')
  assert.equal(espresso.formatGrams(espresso.doseAt(TIMELINE.total)), '18.0')
  assert.equal(espresso.yieldAt(TIMELINE.shotStart), 0)
  assert.equal(espresso.yieldAt(espresso.shotTime(espresso.FIRST_DROPS)), 0, 'nothing falls during pre-infusion')
  assert.equal(espresso.formatGrams(espresso.yieldAt(TIMELINE.shotEnd)), '36.0')
  assert.equal(espresso.formatGrams(espresso.yieldAt(TIMELINE.total)), '36.0', 'the scale holds at 36.0')
  assert.equal(espresso.formatClock(espresso.shotClock(TIMELINE.shotEnd)), '0:30')
  assert.equal(espresso.formatClock(espresso.shotClock(TIMELINE.total)), '0:30', 'the clock stops at 0:30')
  assert.equal(espresso.shotClock(0), 0)
})

test('espresso: the yield only ever rises and the flow starts and ends at nothing', () => {
  const { TIMELINE } = espresso
  let previous = -1
  for (let time = 0; time <= TIMELINE.total; time += 0.05) {
    const grams = espresso.yieldAt(time)
    assert.ok(grams >= previous - 1e-9 && grams <= 36 + 1e-9, `yield at ${time.toFixed(1)}s`)
    previous = grams
    const flow = espresso.flowAt(time)
    assert.ok(flow >= 0 && flow <= 1)
    if (time < espresso.shotTime(espresso.FIRST_DROPS) || time >= TIMELINE.shotEnd) assert.equal(flow, 0, `no flow at ${time.toFixed(2)}s`)
  }
  assert.ok(espresso.flowAt(espresso.shotTime(15)) > 0.95, 'a full stream mid-shot')
  assert.ok(espresso.blondingAt(espresso.shotTime(8)) < espresso.blondingAt(espresso.shotTime(28)))
})

test('espresso: latte art and readouts follow the storyboard', () => {
  const { TIMELINE: T } = espresso
  assert.deepEqual([T.artStart - 1, T.artStart, (T.artStart + T.artEnd) / 2, T.artEnd, 99].map(espresso.artProgress), [0, 0, 0.5, 1, 1])
  assert.deepEqual([0, 7.9, 59, 61, 125, -4].map(espresso.formatClock), ['0:00', '0:07', '0:59', '1:01', '2:05', '0:00'])
  assert.deepEqual([0, 17.96, 36, 35.94, -2].map(espresso.formatGrams), ['0.0', '18.0', '36.0', '35.9', '0.0'])
})

test('espresso: the camera glides through every key without a jump or a stop', () => {
  const { CAMERA, cameraAt, TIMELINE } = espresso
  for (let index = 1; index < CAMERA.length; index++) assert.ok(CAMERA[index].time > CAMERA[index - 1].time, 'keys are in order')
  assert.equal(CAMERA[CAMERA.length - 1].time, TIMELINE.total, 'the storyboard covers the whole animation')
  assert.deepEqual(plain(cameraAt(0)), plain(CAMERA[0]))
  assert.deepEqual(plain(cameraAt(999).target), plain(CAMERA[CAMERA.length - 1].target))
  for (const key of CAMERA) {
    const at = cameraAt(key.time)
    for (let axis = 0; axis < 3; axis++) assert.ok(Math.abs(at.target[axis] - key.target[axis]) < 1e-9, `passes through the key at ${key.time}s`)
  }
  const gap = (a, b) => Math.hypot(a.target[0] - b.target[0], a.target[1] - b.target[1], a.target[2] - b.target[2]) + Math.abs(a.span - b.span)
  for (let time = 0; time < TIMELINE.total; time += 0.05) {
    assert.ok(gap(cameraAt(time), cameraAt(time + 0.05)) < 0.12, `no jump at ${time.toFixed(2)}s`)
    assert.ok(cameraAt(time).span > 0.3 && cameraAt(time).rise > 0.3, 'the frame never collapses')
  }
  // Mid-story keys are passed at speed: the camera is still moving a moment either side of them.
  const middle = CAMERA[3].time
  assert.ok(gap(cameraAt(middle - 0.05), cameraAt(middle + 0.05)) > 1e-4, 'no stop at a key')
})

test('credits: every third-party model is named on the board in the coffee bar, with author, source and licence', () => {
  const credits = load('src/lib/credits.ts')
  const models = credits.CREDIT_GROUPS.flatMap(group => group.models)
  assert.equal(models.length, 14)
  for (const model of models) {
    assert.ok(model.title && model.author, JSON.stringify(model))
    assert.match(model.url, /^https:\/\/sketchfab\.com\/3d-models\/[0-9a-f]{32}$/)
  }
  assert.equal(new Set(models.map(model => model.url)).size, models.length, 'no model is listed twice')
  for (const author of ['mreslan', 'mazia', 'senorp3dro', 'PixiArch', 'lanzaboy', 'misterwils', 'Rofnay', 'grafikzeug', 'jswing_1', 'Gamedirection', 'vav206', 'Kevin.Popescu', 'auspicious', 'GiantMidget']) {
    assert.ok(models.some(model => model.author === author), author)
  }
  assert.equal(credits.CREDIT_LICENCE.url, 'https://creativecommons.org/licenses/by/4.0/')
  assert.match(credits.CREDIT_CHANGES, /simplified/)
  const board = read('src/components/footer/CreditsBoard.tsx')
  assert.match(board, /CREDIT_GROUPS\.map/)
  assert.match(board, /CREDIT_LICENCE\.url/)
  assert.match(board, /CREDIT_CHANGES/)
  assert.match(board, /rel="noopener noreferrer"/)
  assert.ok(!EMOJI.test(board))
  assert.match(read('src/components/footer/CornerPeel.tsx'), /<CreditsBoard \/>/, 'the board hangs in the peeled corner, not on the page')
  assert.ok(!fs.existsSync(path.join(root, 'src/app/credits')), 'still no separate credits page')
})

test('espresso: the scene is built from the downloaded models, loaded only when peeled', () => {
  const scene = read('src/world/coffee/espresso-scene.ts'), assets = read('src/world/coffee/assets.ts')
  const MODELS = ['machine', 'latte-cup', 'espresso-cup', 'pitcher', 'grinder']
  for (const name of MODELS) {
    const file = path.join(root, 'public/wedding/coffee', name + '.glb')
    assert.ok(fs.existsSync(file), name + '.glb is shipped')
    assert.ok(assets.includes("'" + name + "'"), name + ' is loaded')
    assert.equal(fs.readFileSync(file).subarray(0, 4).toString(), 'glTF')
  }
  const total = MODELS.reduce((sum, name) => sum + fs.statSync(path.join(root, 'public/wedding/coffee', name + '.glb')).size, 0)
  assert.ok(total < 1.3 * 1024 * 1024, 'the five models stay under 1.3 MB together, was ' + total)
  assert.ok(!/RoundedBoxGeometry|LatheGeometry|TorusGeometry/.test(scene), 'the machine, cups and pitcher are not built from primitives')
  assert.ok(!fs.existsSync(path.join(root, 'src/world/coffee/latte-art.ts')), 'the latte art is the photographed rosetta, not a drawing')
  assert.match(read('src/components/footer/useEspressoPlayer.ts'), /import\('@\/world\/coffee\/espresso-scene'\)/, 'three.js and the models load on demand')
  assert.ok(!read('src/lib/loading/assets.ts').includes('coffee'), 'the easter egg is not part of the first load')
})

// ─── Footer easter egg: dialling in the grind ─────────────────────────────────
test('grind game: the sweet spot gives 36 g and a score of 100, and only a tick either side does too', () => {
  const { yieldForGrind, scoreFor, verdictFor, formatRatio, formatGrams } = espresso
  for (const sweet of [250, 402, 500, 750]) {
    assert.equal(formatGrams(yieldForGrind(sweet, sweet)), '36.0')
    assert.equal(scoreFor(yieldForGrind(sweet, sweet)), 100)
    assert.equal(verdictFor(yieldForGrind(sweet, sweet)), 'perfect')
    assert.equal(formatRatio(yieldForGrind(sweet, sweet)), '1:2.0')
    for (const off of [-1, 1]) assert.equal(scoreFor(yieldForGrind(sweet + off, sweet)), 100, 'one tick off still counts')
    for (const off of [-3, 3]) assert.ok(scoreFor(yieldForGrind(sweet + off, sweet)) < 100, 'three ticks off does not')
  }
})

test('grind game: coarser always runs fuller, finer chokes, and the hints point the right way', () => {
  const { GRIND, yieldForGrind, scoreFor, verdictFor, clampGrind } = espresso
  let previous = 0
  for (let tick = GRIND.min; tick <= GRIND.max; tick++) {
    const grams = yieldForGrind(tick, 480)
    assert.ok(grams >= previous, 'yield never falls as the grind coarsens, at ' + tick)
    assert.ok(grams >= 2 && grams <= 90, 'yield stays within what a cup can show')
    const score = scoreFor(grams)
    assert.ok(Number.isInteger(score) && score >= 0 && score <= 100)
    previous = grams
  }
  assert.equal(verdictFor(yieldForGrind(600, 480)), 'fast')
  assert.equal(verdictFor(yieldForGrind(300, 480)), 'slow')
  assert.equal(scoreFor(yieldForGrind(1000, 250)), 0, 'far too coarse scores nothing')
  assert.ok(scoreFor(yieldForGrind(470, 480)) > scoreFor(yieldForGrind(440, 480)), 'closer scores higher')
  assert.deepEqual([-5, 0, 499.6, 1000, 4000].map(clampGrind), [0, 0, 500, 1000, 1000])
  assert.equal(yieldForGrind(-50, 480), yieldForGrind(0, 480), 'out-of-range ticks are clamped')
})

test('grind game: the sweet spot is hidden, varies per visit, and can always be reached', () => {
  const { GRIND, pickSweetSpot, yieldAt, flowAt, shotTime, TIMELINE } = espresso
  assert.deepEqual([0, 0.5, 1, -3, 9].map(pickSweetSpot), [250, 500, 750, 250, 750])
  for (const random of [0, 0.123, 0.5, 0.999]) {
    const sweet = pickSweetSpot(random)
    assert.ok(Number.isInteger(sweet) && sweet > GRIND.min && sweet < GRIND.max)
  }
  // The shot on screen ends at whatever the grind gave, and a choked shot only drips.
  assert.equal(espresso.formatGrams(yieldAt(TIMELINE.shotEnd, 56.6)), '56.6')
  assert.ok(flowAt(shotTime(15), 72) > flowAt(shotTime(15), 36), 'a fast shot gushes')
  assert.ok(flowAt(shotTime(15), 3) < 0.12, 'a choked shot never forms a stream')
  const game = read('src/components/footer/EspressoGame.tsx')
  assert.match(game, /pickSweetSpot\(Math\.random\(\)\)/)
  assert.ok(!/sweetSpot\.current\}/.test(game), 'the sweet spot is never rendered')
  assert.match(game, /type="range" min=\{GRIND\.min\} max=\{GRIND\.max\} step=\{1\}/, 'every one of the 1000 ticks can be chosen')
  assert.match(game, /aria-label="One tick finer"/)
  assert.match(game, /aria-label="One tick coarser"/)
  assert.match(game, />Done<\/button>/, 'Done moves on to brewing')
  assert.ok(!EMOJI.test(game))
})

// ─── FAQ: full-height section and instant jumps past pinned sections ──────────
const anchors = load('src/lib/section-anchors.ts')

test('anchors: a jump that passes a pinned section is detected, one that does not is left smooth', () => {
  const pinned = [{ top: 3000, bottom: 5000 }, { top: 5000, bottom: 9000 }]
  assert.equal(anchors.crossesPinnedSection(0, 9500, pinned), true)
  assert.equal(anchors.crossesPinnedSection(9500, 0, pinned), true)
  assert.equal(anchors.crossesPinnedSection(0, 2900, pinned), false)
  assert.equal(anchors.crossesPinnedSection(9100, 9800, pinned), false)
  assert.equal(anchors.crossesPinnedSection(0, 9500, []), false)
})

test('anchors: the navbar uses the instant jump on desktop and mobile links', () => {
  const navbar = read('src/components/sections/Navbar.tsx')
  assert.equal((navbar.match(/jumpPastPinnedSections\(event\)/g) || []).length, 2)
})

test('faq: fills the screen like other sections and matches the details width and header', () => {
  const faq = read('src/components/sections/FAQSection.tsx')
  assert.match(faq, /id="faq"[^>]*min-h-\[100svh\]/)
  assert.match(faq, /max-w-\[1120px\]/)
  assert.match(faq, /<SectionHeader /)
  assert.match(faq, /whitespace-pre-line/)
})

// ─── Dress code: Women and Men blocks with illustrations, and a separate "not allowed" panel ──────
test('dress code: illustrated Women and Men blocks, the couple\'s colors, and the wording stays editable', () => {
  const details = read('src/components/sections/Details.tsx'), css = read('src/app/globals.css')
  const presentation = load('src/lib/presentation.ts')
  // The approved palette is exactly the couple's two named groups.
  for (const swatch of ["['Blush pink','#e9b8c4']", "['Lilac','#c9b7e6']", "['Sky blue','#a8cce3']", "['Mint','#b7d5c4']", "['Butter yellow','#f3df8c']",
    "['Fuchsia','#d65397']", "['Lavender','#9470c2']", "['Cornflower','#5c8dcc']", "['Fresh green','#6fb480']", "['Sunshine','#efbd39']"]) assert.ok(details.includes(swatch), swatch)
  assert.match(details, /const restricted=\[\['Black','#232323'\],\['White','#ffffff'\],\['Red','#c43242'\],\['Brown','#75503a'\],\['Beige','#c8b49b'\],\['Cream','#f3e7cc'\],\['Rust','#aa5d3d'\]\]/)
  assert.match(details, /fabric-swatch-white/, 'white has a visible outline')
  assert.match(css, /\.fabric-swatch-white\{box-shadow:inset 0 0 0 2px/)
  // Women get two illustrations with short descriptions; Men get one that the text already describes.
  const women = details.slice(details.indexOf('dress-outfit-women'), details.indexOf('dress-outfit-men'))
  assert.equal((women.match(/<img /g) || []).length, 2)
  assert.ok(women.includes('outfits.floral') && women.includes('outfits.separates'))
  assert.ok(details.includes("floral:'/wedding/attire/floral-midi.webp'") && details.includes("separates:'/wedding/attire/pastel-separates.webp'"))
  assert.ok(!/alt=""/.test(women), 'each women illustration has a description')
  const men = details.slice(details.indexOf('dress-outfit-men'), details.indexOf('dress-avoid"'))
  assert.equal((men.match(/<img /g) || []).length, 1)
  assert.ok(men.includes('outfits.men') && details.includes("men:'/wedding/attire/mens-outfit.webp'"))
  assert.match(men, /alt=""/, 'the text beside it already says the same')
  assert.match(css, /\.dress-outfit-art img\{[^}]*object-fit:contain/, 'illustrations are never cropped')
  assert.match(css, /\.dress-outfits\{[^}]*grid-template-columns:minmax\(0,1\.55fr\) minmax\(0,1fr\)/)
  assert.match(css, /@media\(max-width:767px\)\{\.dress-outfits\{grid-template-columns:minmax\(0,1fr\)/, 'Women and Men stack on a phone')
  assert.match(css, /\.dress-code-card\{grid-template-columns:minmax\(0,\.85fr\) minmax\(0,1\.15fr\)\}/, 'wide content can never push the card past the screen')
  // The illustrations are small, transparent web copies.
  for (const file of ['floral-midi', 'pastel-separates', 'mens-outfit']) {
    const bytes = fs.statSync(path.join(root, 'public/wedding/attire', file + '.webp')).size
    assert.ok(bytes > 20000 && bytes < 250000, file + ' is ' + bytes + ' bytes')
  }
  // Every piece of wording comes from settings, not from a picture.
  assert.match(details, /presentation\.dressWomen/)
  assert.match(details, /presentation\.dressMen/)
  assert.match(details, /presentation\.dressRestrictions/)
  assert.match(details, /presentation\.dressAvoidAttire/)
  assert.match(details, /presentation\.dressChurch/)
  const d = presentation.DEFAULT_PRESENTATION
  assert.equal(d.dressWomen, 'Wear whatever makes you feel confident and beautiful! We love soft and pastel tones inspired by our palette. Any style or print you feel amazing in is welcome.')
  assert.equal(d.dressMen, 'Wear a long-sleeved button-up shirt with a tie that matches our palette, dress slacks, and dress shoes.')
  assert.equal(d.dressAvoidAttire, 'Slippers, shorts, T-shirts, mini-dresses, and caps.')
  assert.equal(d.dressChurch, 'Please choose an outfit suitable for a church ceremony.')
  assert.match(d.dressRestrictions, /Guests wearing these colors will not be admitted to the celebration\./)
  assert.equal(d.dressDescription, '', 'the generic outfit paragraph is gone')
  // Settings saved before these fields existed still load, and fall back to the new wording.
  const old = presentation.parseSitePresentation(JSON.stringify({ dressDescription: 'Old line', footerContactEmail: '' }))
  assert.equal(old.dressDescription, 'Old line')
  assert.equal(old.dressMen, d.dressMen)
  // The admin can edit each new piece.
  const admin = read('src/app/admin/(panel)/settings/_components/PresentationGroups.tsx')
  for (const key of ['dressWomen', 'dressMen', 'dressRestrictions', 'dressAvoidAttire', 'dressChurch']) assert.ok(admin.includes(`'${key}'`), key)
  // The warning keeps its contrast and sits in its own panel, apart from the approved palettes.
  assert.match(details, /<div className="dress-avoid" role="note"/)
  assert.ok(details.indexOf('dress-palettes') < details.indexOf('dress-outfits') && details.indexOf('dress-outfits') < details.indexOf('dress-avoid'))
  assert.match(css, /\.dress-avoid\{background:#efede8/)
  assert.match(css, /\.dress-avoid \.dress-avoid-instruction\{font-weight:500;color:#332923/)
})
