#!/usr/bin/env node
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
const root = path.resolve(__dirname, '..'), cache = new Map()
function load(relative) {
  const filename = path.resolve(root, relative)
  if (cache.has(filename)) return cache.get(filename).exports
  const mod = new Module(filename, module); cache.set(filename, mod)
  mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename))
  mod.require = name => name.startsWith('.') ? load(path.relative(root, path.resolve(path.dirname(filename), name + '.ts'))) : require(name)
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, filename)
  return mod.exports
}
let total = 0
function test(name, fn) { fn(); total++; console.log('PASS ' + name) }
const time = load('src/lib/wedding-time.ts'), nav = load('src/lib/navbar-visibility.ts')
const motion = load('src/world/character-motion.ts'), journey = load('src/world/journey-progress.ts')
test('Ceremony instant is Philippine time in every visitor timezone', () => {
  for (const zone of ['UTC', 'America/Los_Angeles', 'Asia/Manila']) {
    process.env.TZ = zone
    assert.equal(new Date(time.weddingInstant('2027-02-27', '3:00 PM')).toISOString(), '2027-02-27T07:00:00.000Z')
  }
  assert.equal(time.weddingInstant('2027-02-27', '15:00'), time.weddingInstant('2027-02-27', '3:00 PM'))
  assert.equal(new Date(time.weddingInstant('2027-02-27', '12:00 AM')).toISOString(), '2027-02-26T16:00:00.000Z')
})
test('Invalid dates and past countdown are safe', () => {
  for (const [d,t] of [['2027-02-30','3:00 PM'], ['2027-00-01','3:00 PM'], ['2027-02-27','13:00 PM'], ['bad','bad']]) assert.equal(time.weddingInstant(d,t), null)
  const target = time.weddingInstant('2027-02-27', '3:00 PM')
  assert.deepEqual(time.weddingTimeLeft('2027-02-27', '3:00 PM', target - 90061000), {days:1,hours:1,minutes:1,seconds:1})
  assert.deepEqual(time.weddingTimeLeft('2027-02-27', '3:00 PM', target + 1), {days:0,hours:0,minutes:0,seconds:0})
})
test('Navbar obeys one half-hero boundary through fast scroll and resize', () => {
  for (const height of [600, 844, 1200]) for (const y of [0, height*.49, height*.5, 10000, height*.7, height*.3]) assert.equal(nav.navbarScrollState(y,0,height).hidden, y >= height*.5)
  assert.equal(nav.navbarScrollState(600,200,800).hidden, true)
  assert.equal(nav.navbarVisualStyle(true,true).transitionDuration, '0s')
  assert.equal(nav.navbarVisualStyle(true,false).opacity, 0)
})
test('Continuous walk, run, greeting, and reduced-motion invitation remain', () => {
  assert.equal(motion.characterState('walk',0,0,false).weights.Walk,1)
  assert.equal(motion.characterState('walk',.4,0,false).weights.Run,1)
  assert.equal(motion.characterState('walk',.9,0,false).weights.Wave,1)
  assert.equal(motion.characterState('walk',.1,0,true).weights.Invite,1)
  assert.equal(motion.characterState('night',0,0,false,1.6,'dance').weights.Dance,1)
  assert.equal(motion.characterState('night',0,0,false,1.6,'stargaze').weights.Sit,1)
})
test('Story controls advance and can finish without a scroll trap', () => {
  assert.equal(journey.journeyAdvanceOffset(.9,4800,1000),4800)
  assert.ok(journey.journeyAdvanceOffset(.1,4800,1000)>0)
  assert.ok(journey.journeyAdvanceOffset(.4,4800,1000)>journey.journeyAdvanceOffset(.1,4800,1000))
  assert.equal(journey.journeyFeedback(2).percent,100)
})
test('All seven real animation clips survive production extraction', () => {
  const glb = fs.readFileSync(path.join(root,'public/wedding/wedding-couple-storyboard.glb'))
  assert.equal(glb.toString('utf8',0,4),'glTF'); assert.equal(glb.readUInt32LE(8),glb.length)
  const json = JSON.parse(glb.toString('utf8',20,20+glb.readUInt32LE(12)))
  for (const clip of motion.clipNames) assert.ok(json.animations.some(a=>a.name===clip || a.name.startsWith(clip+'.') || a.name.endsWith('_'+clip)),clip)
  assert.ok(json.skins.length >= 1); assert.ok(json.nodes.filter(node => node.skin !== undefined).length >= 2)
})
test('Production data comes from APIs and CMS, never embedded sample guests', () => {
  const story=fs.readFileSync(path.join(root,'src/components/sections/Story.tsx'),'utf8')
  const gallery=fs.readFileSync(path.join(root,'src/components/sections/Gallery.tsx'),'utf8')
  const rsvp=fs.readFileSync(path.join(root,'src/components/sections/RSVPDialog.tsx'),'utf8')
  assert.ok(story.includes("'/api/story'")); assert.ok(gallery.includes("'/api/gallery'"))
  for (const text of [story,gallery,rsvp]) assert.ok(!/preview-data|lookupSample|alex@example.com|rsvp-preview/.test(text))
  assert.ok(rsvp.includes("'/api/rsvp/verify'"));assert.ok(rsvp.includes("'/api/rsvp'"));assert.ok(rsvp.includes('pending.current'))
})
test('CMS presentation validates URLs and preserves explicit cleared images', () => {
  const {DEFAULT_PRESENTATION,sitePresentationSchema,parseSitePresentation}=load('src/lib/presentation.ts')
  assert.ok(sitePresentationSchema.safeParse(DEFAULT_PRESENTATION).success)
  assert.deepEqual(parseSitePresentation('{"ceremonyImages":[]}').ceremonyImages,[])
  assert.ok(!sitePresentationSchema.safeParse({...DEFAULT_PRESENTATION,footerContactUrl:'javascript:alert(1)'}).success)
  for (const photo of DEFAULT_PRESENTATION.ceremonyImages) assert.ok(fs.existsSync(path.join(root,'public',photo.src)))
})
test('Source uses local asset files and no review-folder runtime imports', () => {
  function scan(dir) { for (const entry of fs.readdirSync(dir,{withFileTypes:true})) {const p=path.join(dir,entry.name); if(entry.isDirectory())scan(p);else if(/\.(tsx?|css)$/.test(p)){const s=fs.readFileSync(p,'utf8');assert.ok(!/from ['"][^'"]*(?:design-review|revision-\d)/.test(s),p);assert.ok(!/data:[^;]+;base64,/.test(s),p)}} }
  scan(path.join(root,'src'))
})
console.log(`${total} production UI regression groups passed.`)
