// Read-only measurement of the live home page as a first-time visitor on a mid-range phone and a 4G connection:
// what is downloaded, how long the welcome screen waits, and whether pictures are ready when scrolled to quickly.
const { chromium } = require('playwright-core')
const fs = require('node:fs'), path = require('node:path'), os = require('node:os')
const [base, label] = process.argv.slice(2)
const find = dir => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) { const r = find(p); if (r) return r } else if (/MacOS\/(Chromium|Google Chrome for Testing)$/.test(p)) return p } }
const NET = { offline: false, latency: 100, downloadThroughput: (Number(process.env.MBPS || 4) * 1024 * 1024) / 8, uploadThroughput: (1.5 * 1024 * 1024) / 8 }
const kind = (type, url) => type === 'Image' ? 'image' : type === 'Media' ? 'video' : type === 'Script' ? 'script' : type === 'Font' || /\.(ttf|woff2?)(\?|$)/.test(url) ? 'font' : type === 'Stylesheet' ? 'css' : /\.glb|\.hdr/.test(url) ? 'model' : type === 'Document' ? 'html' : 'other'
;(async () => {
  const browser = await chromium.launch({ executablePath: find(path.join(os.homedir(), 'Library/Caches/ms-playwright/chromium-1208')) })
  const context = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true })
  const page = await context.newPage()
  const cdp = await context.newCDPSession(page)
  await cdp.send('Network.enable'); await cdp.send('Network.emulateNetworkConditions', NET); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  const reqs = new Map(); const t0 = Date.now()
  cdp.on('Network.requestWillBeSent', e => reqs.set(e.requestId, { url: e.request.url, type: e.type, start: Date.now() - t0 }))
  cdp.on('Network.responseReceived', e => { const r = reqs.get(e.requestId); if (r) { r.status = e.response.status; r.mime = e.response.mimeType; r.cache = e.response.headers['cache-control'] || e.response.headers['Cache-Control'] || '' } })
  cdp.on('Network.loadingFinished', e => { const r = reqs.get(e.requestId); if (r) { r.bytes = e.encodedDataLength; r.end = Date.now() - t0 } })
  await page.addInitScript(() => { window.__lcp = 0; new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lcp = Math.round(e.startTime) }).observe({ type: 'largest-contentful-paint', buffered: true }) })
  await page.goto(base + '/', { waitUntil: 'commit' })
  let open = null, gone = null
  await page.waitForSelector('.site-preloader', { state: 'attached', timeout: 60000 })
  const shownAt = Date.now() - t0
  for (let i = 0; i < 600; i++) {
    await page.waitForTimeout(100)
    const s = await page.evaluate(() => { const p = document.querySelector('.site-preloader'); return p ? p.dataset.phase : 'gone' }).catch(() => 'loading')
    if (s === 'opening' && open === null) open = Date.now() - t0
    if (s === 'gone') { gone = Date.now() - t0; break }
  }
  const atOpen = [...reqs.values()].filter(r => r.end && r.end <= (open ?? gone))
  const sum = list => Object.entries(list.reduce((m, r) => { const k = kind(r.type, r.url); m[k] = (m[k] || 0) + (r.bytes || 0); return m }, {})).map(([k, v]) => `${k} ${Math.round(v / 1024)} KB`).join(', ')
  console.log(`[${label}] welcome screen first drawn at ${shownAt} ms, doors opened at ${open} ms, gone at ${gone} ms; LCP ${await page.evaluate(() => window.__lcp)} ms`)
  console.log('  bytes before the doors opened:', Math.round(atOpen.reduce((n, r) => n + (r.bytes || 0), 0) / 1024), 'KB in', atOpen.length, 'requests |', sum(atOpen))
  // Fast scroll through the whole page: how many pictures are on screen but not yet decoded?
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
  const height = await page.evaluate(() => document.documentElement.scrollHeight)
  const blank = new Map(); let frames = 0
  const sample = () => page.evaluate(() => [...document.images].filter(i => { const r = i.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && r.width > 40 && r.height > 40 && !(i.complete && i.naturalWidth > 0) }).map(i => (i.currentSrc || i.src).replace(location.origin, '').slice(0, 90)))
  const speed = 2600 // px per second: a quick flick
  const start = Date.now()
  let y = 0
  while (y < height) {
    y = Math.min(height, Math.round(((Date.now() - start) / 1000) * speed))
    await page.evaluate(v => window.scrollTo({ top: v, behavior: 'instant' }), y)
    for (const u of await sample()) blank.set(u, (blank.get(u) || 0) + 1)
    frames++; await page.waitForTimeout(60)
  }
  console.log(`  fast scroll (${speed} px/s) over ${height}px: ${frames} samples, ${blank.size} distinct pictures were on screen before they had loaded`)
  for (const [u, n] of [...blank.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log(`    ${n} samples  ${u}`)
  const all = [...reqs.values()].filter(r => r.bytes)
  console.log('  total transferred:', Math.round(all.reduce((n, r) => n + r.bytes, 0) / 1024), 'KB in', all.length, 'requests |', sum(all))
  console.log('  largest requests:')
  for (const r of all.sort((a, b) => b.bytes - a.bytes).slice(0, 14)) console.log(`    ${String(Math.round(r.bytes / 1024)).padStart(6)} KB  ${String(r.start).padStart(6)}→${String(r.end).padStart(6)} ms  ${kind(r.type, r.url).padEnd(6)} ${r.url.replace(base, '').replace(/https:\/\/res\.cloudinary\.com\/[^/]+/, 'cloudinary').slice(0, 100)}`)
  const noCache = all.filter(r => kind(r.type, r.url) === 'image' && !/max-age=\d{5,}/.test(r.cache || '')).length
  console.log(`  images without a long cache lifetime: ${noCache} of ${all.filter(r => kind(r.type, r.url) === 'image').length}`)
  await browser.close()
})().catch(e => { console.error('STOPPED', e.message.split('\n')[0]); process.exit(1) })
