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

const people = load('src/lib/seating/people.ts')
const rules = load('src/lib/seating/rules.ts')
const geometry = load('src/lib/seating/geometry.ts')
const schemas = load('src/lib/seating/schemas.ts')
const guest = load('src/lib/seating/guest-view.ts')

const invitation = (id, guestName, seats = 1, response = null, status = 'active') => ({ id, guestName, seats, status, response })
const yes = (partySize, companions = []) => ({ attending: true, partySize, companions })
const no = { attending: false, partySize: 0, companions: [] }
const table = (id, chairs = 4, extra = {}) => ({ id, label: `Table ${id}`, shape: 'round', chairs, x: 400, y: 300, rotation: 0, ...extra })
const seat = (invitationId, index, tableId, chair) => ({ invitationId, index, tableId, chair })
const sorted = assignments => plain(assignments).sort((a, b) => a.tableId - b.tableId || a.chair - b.chair)

// ─── The list of names ────────────────────────────────────────────────────────
test('people: a guest and their plus one are two entries, the plus one named after its guest', () => {
  const list = people.buildPeople([invitation(1, 'Jazzer Santos', 2)])
  assert.deepEqual(plain(list.map(person => [person.key, person.name, person.shortName, person.hostName, person.attendance])), [
    ['1:0', 'Jazzer Santos', 'Jazzer', null, 'pending'],
    ['1:1', "Jazzer's plus one", 'Jazzer +1', 'Jazzer Santos', 'pending'],
  ])
})

test('people: a solo invitation is one entry; three plus ones are numbered in words', () => {
  assert.equal(people.buildPeople([invitation(1, 'Ana Reyes', 1)]).length, 1)
  const names = people.buildPeople([invitation(2, 'Jazzer Santos', 4)]).map(person => person.name)
  assert.deepEqual(plain(names), ['Jazzer Santos', "Jazzer's plus one", "Jazzer's plus two", "Jazzer's plus three"])
})

test('people: once the guest names who they bring, the entry shows that name and still refers to its guest', () => {
  const list = people.buildPeople([invitation(1, 'Jazzer Santos', 3, yes(2, ['Maria Cruz']))])
  assert.equal(list[1].name, "Maria Cruz · Jazzer's plus one")
  assert.equal(list[1].shortName, 'Maria Cruz')
  assert.deepEqual(plain(list.map(person => person.attendance)), ['coming', 'coming', 'not_coming'])
  assert.equal(list[2].name, "Jazzer's plus two")
})

test('people: a decline marks the whole invitation declined and ignores stale companion names', () => {
  const list = people.buildPeople([invitation(1, 'Jazzer Santos', 2, { attending: false, partySize: 0, companions: ['Old Name'] })])
  assert.deepEqual(plain(list.map(person => [person.name, person.attendance])), [['Jazzer Santos', 'declined'], ["Jazzer's plus one", 'declined']])
})

test('people: revoked invitations are not on the list, and equal first names get a last initial', () => {
  const list = people.buildPeople([
    invitation(1, 'Ana Santos'), invitation(2, 'Ana Reyes'), invitation(3, 'Ana', 2), invitation(4, 'Gone Guest', 2, null, 'revoked'),
  ])
  assert.deepEqual(plain(list.map(person => person.shortName)), ['Ana Santos', 'Ana Reyes', 'Ana', 'Ana +1'])
  assert.ok(!list.some(person => person.invitationId === 4))
})

test('people: a chair shows the whole name when it fits, so "Tita Jop" and "Tita Lorns" stay apart', () => {
  const list = people.buildPeople([
    invitation(1, 'Tita Jop', 2), invitation(2, 'Tita Lorns'), invitation(3, 'Tita'), invitation(4, 'Tita'), invitation(5, 'Ate Gianelli'),
    invitation(6, 'Maria Clara Santos'), invitation(7, 'Maria Lourdes Reyes'), invitation(8, 'Ben Cruz', 2, yes(2, ['Carla Cruz'])),
  ])
  assert.deepEqual(plain(list.map(person => person.shortName)), ['Tita Jop', 'Tita +1', 'Tita Lorns', 'Tita', 'Tita', 'Ate Gianelli', 'Maria S.', 'Maria R.', 'Ben Cruz', 'Carla Cruz'])
  assert.ok(list.every(person => person.shortName.length <= 12))
})

test('people: keys round-trip and malformed keys are refused', () => {
  assert.deepEqual(plain(people.parsePersonKey(people.personKey(12, 3))), { invitationId: 12, index: 3 })
  for (const bad of ['', '12', '12:', ':3', 'a:1', '1:2:3', '1:-1', '12:345']) assert.equal(people.parsePersonKey(bad), null, bad)
})

// ─── Seating rules ────────────────────────────────────────────────────────────
test('rules: dropping on a table takes the next free chair; dropping on a chair takes that chair', () => {
  const tables = [table(1)]
  const first = rules.movePerson(tables, [], { invitationId: 1, index: 0 }, { tableId: 1 })
  assert.deepEqual(sorted(first.assignments), [seat(1, 0, 1, 0)])
  const second = rules.movePerson(tables, first.assignments, { invitationId: 1, index: 1 }, { tableId: 1 })
  assert.deepEqual(sorted(second.assignments), [seat(1, 0, 1, 0), seat(1, 1, 1, 1)])
  const chosen = rules.movePerson(tables, second.assignments, { invitationId: 2, index: 0 }, { tableId: 1, chair: 3 })
  assert.deepEqual(sorted(chosen.assignments).at(-1), seat(2, 0, 1, 3))
})

test('rules: a seated person can move to another table, swap with someone, or go back on the list', () => {
  const tables = [table(1), table(2)]
  const start = [seat(1, 0, 1, 0), seat(2, 0, 2, 1)]
  const moved = rules.movePerson(tables, start, { invitationId: 1, index: 0 }, { tableId: 2 })
  assert.deepEqual(sorted(moved.assignments), [seat(1, 0, 2, 0), seat(2, 0, 2, 1)])
  const swapped = rules.movePerson(tables, start, { invitationId: 1, index: 0 }, { tableId: 2, chair: 1 })
  assert.deepEqual(sorted(swapped.assignments), [seat(2, 0, 1, 0), seat(1, 0, 2, 1)])
  assert.equal(swapped.changed.length, 2)
  const unseated = rules.movePerson(tables, start, { invitationId: 1, index: 0 }, null)
  assert.deepEqual(sorted(unseated.assignments), [seat(2, 0, 2, 1)])
  // The list given in is never altered.
  assert.deepEqual(start, [seat(1, 0, 1, 0), seat(2, 0, 2, 1)])
})

test('rules: someone from the list dropped on a taken chair takes the next free one instead of pushing anyone out', () => {
  const result = rules.movePerson([table(1)], [seat(1, 0, 1, 0)], { invitationId: 2, index: 0 }, { tableId: 1, chair: 0 })
  assert.deepEqual(sorted(result.assignments), [seat(1, 0, 1, 0), seat(2, 0, 1, 1)])
})

test('rules: a full table refuses, and so do unknown tables and chairs that do not exist', () => {
  const tables = [table(1, 2)]
  const full = [seat(1, 0, 1, 0), seat(2, 0, 1, 1)]
  const refused = rules.movePerson(tables, full, { invitationId: 3, index: 0 }, { tableId: 1 })
  assert.equal(refused.ok, false)
  assert.equal(refused.message, 'Table 1 is full.')
  assert.equal(rules.movePerson(tables, full, { invitationId: 3, index: 0 }, { tableId: 1, chair: 0 }).ok, false)
  assert.equal(rules.movePerson(tables, [], { invitationId: 3, index: 0 }, { tableId: 9 }).ok, false)
  assert.equal(rules.movePerson(tables, [], { invitationId: 3, index: 0 }, { tableId: 1, chair: 2 }).ok, false)
  assert.equal(rules.movePerson(tables, [], { invitationId: 3, index: 0 }, { tableId: 1, chair: -1 }).ok, false)
})

test('rules: nobody ever ends up in two seats or two people in one chair', () => {
  const tables = [table(1, 3), table(2, 3)]
  let assignments = []
  const moves = [[1, 0, { tableId: 1 }], [1, 1, { tableId: 1 }], [2, 0, { tableId: 1, chair: 0 }], [1, 0, { tableId: 2, chair: 2 }], [2, 0, { tableId: 2, chair: 2 }], [1, 1, null], [3, 0, { tableId: 1 }], [1, 0, { tableId: 1 }]]
  for (const [invitationId, index, target] of moves) {
    const result = rules.movePerson(tables, assignments, { invitationId, index }, target)
    if (result.ok) assignments = result.assignments
    assert.equal(new Set(assignments.map(a => `${a.invitationId}:${a.index}`)).size, assignments.length)
    assert.equal(new Set(assignments.map(a => `${a.tableId}:${a.chair}`)).size, assignments.length)
    for (const a of assignments) assert.ok(a.chair >= 0 && a.chair < 3)
  }
})

test('rules: removing chairs never unseats anyone', () => {
  const big = table(1, 8)
  const seated = [seat(1, 0, 1, 0), seat(2, 0, 1, 5), seat(3, 0, 1, 7), seat(9, 0, 2, 6)]
  const refused = rules.resizeTable(big, 2, seated)
  assert.equal(refused.ok, false)
  assert.match(refused.message, /3 people are seated at Table 1/)
  const shrunk = rules.resizeTable(big, 4, seated)
  assert.equal(shrunk.ok, true)
  assert.deepEqual(sorted(shrunk.assignments), [seat(1, 0, 1, 0), seat(2, 0, 1, 1), seat(3, 0, 1, 2), seat(9, 0, 2, 6)])
  assert.equal(rules.resizeTable(big, 12, seated).changed.length, 0)
  assert.match(rules.resizeTable(big, 0, [seat(1, 0, 1, 0)]).message, /1 person is seated/)
})

test('rules: new tables are numbered after the highest number in use', () => {
  assert.equal(rules.nextTableLabel([]), 'Table 1')
  assert.equal(rules.nextTableLabel([{ label: 'Table 1' }, { label: 'Table 3' }, { label: 'Family' }, { label: 'Table 2b' }]), 'Table 4')
})

test('rules: warnings point out declined, not coming, split and leftover seats without changing anything', () => {
  const invitations = [
    invitation(1, 'Jazzer Santos', 2, yes(1)), invitation(2, 'Ana Reyes', 1, no), invitation(3, 'Ben Cruz', 2, yes(2, ['Carla Cruz'])), invitation(4, 'Dan Lim', 1),
  ]
  const list = people.buildPeople(invitations)
  const tables = [table(1, 8), table(2, 8)]
  const assignments = [seat(1, 0, 1, 0), seat(1, 1, 1, 1), seat(2, 0, 1, 2), seat(3, 0, 1, 3), seat(3, 1, 2, 0), seat(4, 3, 2, 1), seat(77, 0, 2, 2)]
  const before = plain(assignments)
  const warnings = rules.seatingWarnings(invitations, list, tables, assignments)
  assert.deepEqual(plain(warnings.map(warning => warning.kind)).sort(), ['declined', 'leftover', 'leftover', 'not_coming', 'split'])
  assert.ok(warnings.some(warning => warning.message === 'Ana Reyes declined but is still seated at Table 1.'))
  assert.ok(warnings.some(warning => warning.message === "Jazzer's plus one is not coming but still has a seat at Table 1."))
  assert.ok(warnings.some(warning => warning.message === "Ben Cruz's party is split between Table 1 and Table 2."))
  assert.deepEqual(assignments, before)
  assert.deepEqual(plain(rules.seatingWarnings(invitations, list, tables, [seat(1, 0, 1, 0), seat(3, 0, 1, 1), seat(3, 1, 1, 2)])), [])
})

test('rules: the unseated count is everyone who may come and has no chair', () => {
  const list = people.buildPeople([invitation(1, 'Jazzer Santos', 2, yes(1)), invitation(2, 'Ana Reyes', 1, no), invitation(3, 'Ben Cruz', 2)])
  assert.equal(rules.unseatedCount(list, []), 3)
  assert.equal(rules.unseatedCount(list, [seat(1, 0, 1, 0), seat(3, 1, 1, 1)]), 1)
})

// ─── Geometry ─────────────────────────────────────────────────────────────────
test('geometry: every table type draws exactly its chairs, with no two overlapping, from 1 to 24', () => {
  for (const shape of rules.TABLE_SHAPES) {
    for (let chairs = rules.CHAIRS.min; chairs <= rules.CHAIRS.max; chairs += 1) {
      const points = geometry.chairPoints(shape, chairs)
      assert.equal(points.length, chairs, `${shape} ${chairs}`)
      for (let a = 0; a < points.length; a += 1) {
        for (let b = a + 1; b < points.length; b += 1) {
          const apart = Math.abs(points[a].x - points[b].x) >= geometry.CHAIR.width || Math.abs(points[a].y - points[b].y) >= geometry.CHAIR.height
          assert.ok(apart, `${shape} with ${chairs} chairs: chairs ${a} and ${b} overlap`)
        }
      }
      const box = geometry.tableBox(shape, chairs)
      assert.ok(box.width >= 60 && box.height >= 50, `${shape} ${chairs} has a table top`)
      assert.ok(geometry.tableReach(shape, chairs) >= Math.max(box.width, box.height) / 2)
    }
  }
})

test('geometry: chairs sit outside the table top, and a couple\'s table has them all on one side', () => {
  for (const shape of ['rect', 'square', 'couple']) {
    const box = geometry.tableBox(shape, 8)
    for (const point of geometry.chairPoints(shape, 8)) {
      assert.ok(Math.abs(point.x) > box.width / 2 || Math.abs(point.y) > box.height / 2, shape)
    }
  }
  const round = geometry.tableBox('round', 10)
  for (const point of geometry.chairPoints('round', 10)) assert.ok(Math.hypot(point.x, point.y) > round.width / 2)
  assert.ok(geometry.chairPoints('couple', 6).every(point => point.y < 0))
  const long = geometry.chairPoints('rect', 7)
  assert.equal(long.filter(point => point.y < 0).length, 4)
  assert.equal(long.filter(point => point.y > 0).length, 3)
})

test('geometry: turning a table carries its chairs round, and a name never runs over the table top at any angle', () => {
  // A quarter turn puts each chair a quarter turn round, a little further out to make room for its level name.
  const flat = geometry.chairPoints('rect', 6, 0), turned = geometry.chairPoints('rect', 6, 90)
  const extra = (geometry.CHAIR.width - geometry.CHAIR.height) / 2
  flat.forEach((point, index) => {
    assert.ok(Math.abs(turned[index].y - point.x) < 0.2)
    assert.ok(Math.abs(Math.abs(turned[index].x) - (Math.abs(point.y) + extra)) < 0.2)
  })
  // Round tables look the same from every side: the chairs simply go round.
  const ring = geometry.chairPoints('round', 8, 0), spun = geometry.chairPoints('round', 8, 37)
  ring.forEach((point, index) => assert.ok(Math.abs(Math.hypot(point.x, point.y) - Math.hypot(spun[index].x, spun[index].y)) < 0.2))
  for (const shape of ['rect', 'square', 'couple']) {
    for (const chairs of [2, 7, 12]) {
      const box = geometry.tableBox(shape, chairs)
      for (let rotation = 0; rotation < 360; rotation += 15) {
        for (const point of geometry.chairPoints(shape, chairs, rotation)) {
          // The four corners of the level name pill, turned back into the table's own frame, all lie outside the top.
          for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
            const corner = geometry.rotatePoint({ x: point.x + (dx * geometry.CHAIR.width) / 2, y: point.y + (dy * geometry.CHAIR.height) / 2 }, -rotation)
            assert.ok(Math.abs(corner.x) >= box.width / 2 - 0.5 || Math.abs(corner.y) >= box.height / 2 - 0.5, `${shape} ${chairs} at ${rotation}°`)
          }
          assert.ok(Math.hypot(point.x, point.y) + geometry.CHAIR.width / 2 <= geometry.tableReach(shape, chairs) + 1, `${shape} ${chairs} reach at ${rotation}°`)
        }
      }
    }
  }
  assert.equal(geometry.snap(123), 120)
  assert.equal(geometry.clamp(-5, 0, 10), 0)
})

test('rules: tables turn freely to any whole degree, and settle on a straight angle when close', () => {
  assert.equal(schemas.tableUpdateSchema.safeParse({ id: 1, rotation: 37 }).success, true)
  assert.equal(schemas.tableUpdateSchema.safeParse({ id: 1, rotation: 359 }).success, true)
  assert.equal(rules.normaliseRotation(-30), 330)
  assert.equal(rules.normaliseRotation(725.4), 5)
  assert.equal(rules.settleRotation(37), 37)
  assert.equal(rules.settleRotation(88), 90)
  assert.equal(rules.settleRotation(358), 0)
  assert.equal(rules.settleRotation(-3), 0)
  assert.equal(rules.settleRotation(52), 52)
  // A freely turned table keeps every chair, none of them closer in than before.
  const flat = geometry.chairPoints('rect', 8, 0), turned = geometry.chairPoints('rect', 8, 37)
  assert.equal(turned.length, 8)
  flat.forEach((point, index) => assert.ok(Math.hypot(turned[index].x, turned[index].y) >= Math.hypot(point.x, point.y) - 0.2))
})

// ─── Seating by typing a name ─────────────────────────────────────────────────
const suggest = load('src/lib/seating/suggest.ts')

test('suggest: typed text finds guests by name, best match first, plus ones by their guest too', () => {
  const list = people.buildPeople([
    invitation(1, 'Jazzer Santos', 2), invitation(2, 'Ana Reyes', 2, yes(2, ['Maria Cruz'])), invitation(3, 'Mariana Jazmin', 1), invitation(4, 'José Peña', 1),
  ])
  const names = query => plain(suggest.suggestPeople(query, list).map(person => person.name))
  assert.deepEqual(names('jaz'), ['Jazzer Santos', "Jazzer's plus one", 'Mariana Jazmin'])
  assert.deepEqual(names('maria'), ["Maria Cruz · Ana's plus one", 'Mariana Jazmin'])
  assert.deepEqual(names('Maria Cruz'), ["Maria Cruz · Ana's plus one"])
  assert.deepEqual(names('reyes'), ['Ana Reyes'])
  assert.deepEqual(names('jose pena'), ['José Peña'], 'accents do not matter')
  assert.deepEqual(names('  ANA  '), ['Ana Reyes', "Maria Cruz · Ana's plus one", 'Mariana Jazmin'])
  assert.deepEqual(names(''), [])
  assert.deepEqual(names('zzz'), [])
  assert.equal(suggest.suggestPeople('a', list, 2).length, 2)
})

test('suggest: a comma or a new line finishes a name; the rest is still being typed', () => {
  assert.deepEqual(plain(suggest.splitNames('Ana')), { finished: [], typing: 'Ana' })
  assert.deepEqual(plain(suggest.splitNames('Ana,')), { finished: ['Ana'], typing: '' })
  assert.deepEqual(plain(suggest.splitNames('Ana Reyes, Ben ,  Car')), { finished: ['Ana Reyes', 'Ben'], typing: 'Car' })
  assert.deepEqual(plain(suggest.splitNames('Ana\nBen\n')), { finished: ['Ana', 'Ben'], typing: '' })
  assert.deepEqual(plain(suggest.splitNames(',, ,')), { finished: [], typing: '' })
})

test('geometry: the floor is open in every direction, and the view can centre on what is on it', () => {
  assert.equal(schemas.tableUpdateSchema.safeParse({ id: 1, x: -750, y: -1200 }).success, true)
  assert.equal(geometry.contentBounds([], []), null)
  const bounds = geometry.contentBounds([{ shape: 'round', chairs: 10, x: 0, y: 0 }, { shape: 'round', chairs: 10, x: 1000, y: 400 }], [{ x: 500, y: -300, width: 200, height: 100 }])
  const reach = geometry.tableReach('round', 10)
  assert.deepEqual(plain(bounds), { left: -reach, top: -350, right: 1000 + reach, bottom: 400 + reach })
  const frame = { width: 1200, height: 700 }, limits = { min: 0.05, max: 1 }
  const view = geometry.viewToFit(bounds, frame, limits)
  // The middle of the content lands in the middle of the frame, and all of it is inside.
  const onScreen = (x, y) => ({ x: x * view.zoom + view.x, y: y * view.zoom + view.y })
  const middle = onScreen((bounds.left + bounds.right) / 2, (bounds.top + bounds.bottom) / 2)
  assert.ok(Math.abs(middle.x - 600) < 0.001 && Math.abs(middle.y - 350) < 0.001)
  const a = onScreen(bounds.left, bounds.top), b = onScreen(bounds.right, bounds.bottom)
  assert.ok(a.x >= 47 && a.y >= 47 && b.x <= 1153 && b.y <= 653)
  // A small plan is not blown up past full size; an empty floor opens at full size.
  assert.equal(geometry.viewToFit({ left: 0, top: 0, right: 100, bottom: 100 }, frame, limits).zoom, 1)
  assert.equal(geometry.viewToFit(null, frame, limits).zoom, 1)
  // A huge plan zooms out as far as it needs, down to the limit.
  assert.equal(geometry.viewToFit({ left: -20000, top: -20000, right: 20000, bottom: 20000 }, frame, limits).zoom, 0.05)
  // Zooming about a point keeps that point still.
  const before = { x: 30, y: -40, zoom: 0.5 }, point = { x: 400, y: 300 }
  const after = geometry.zoomAbout(before, 1.25, point)
  assert.ok(Math.abs((point.x - before.x) / before.zoom - (point.x - after.x) / after.zoom) < 1e-9)
  assert.ok(Math.abs((point.y - before.y) / before.zoom - (point.y - after.y) / after.zoom) < 1e-9)
})

// ─── Input checks ─────────────────────────────────────────────────────────────
test('schemas: a table needs sensible values', () => {
  assert.deepEqual(plain(schemas.tableCreateSchema.parse({ x: 100, y: 200 })), { shape: 'round', chairs: 10, x: 100, y: 200, rotation: 0 })
  assert.equal(schemas.tableCreateSchema.parse({ label: '  Family  ', shape: 'couple', chairs: 2, x: 0, y: 0, rotation: 90 }).label, 'Family')
  const bad = [
    { x: 1, y: 1, chairs: 0 }, { x: 1, y: 1, chairs: 25 }, { x: 1, y: 1, chairs: 2.5 }, { x: 1, y: 1, shape: 'oval' }, { x: -20001, y: 1 }, { x: 1, y: 99999 },
    { x: 1, y: 1, rotation: 10.5 }, { x: 1, y: 1, rotation: -1 }, { x: 1, y: 1, rotation: 360 }, { x: 1, y: 1, label: '' }, { x: 1, y: 1, label: 'x'.repeat(41) }, { x: '1', y: 1 }, {},
  ]
  for (const input of bad) assert.equal(schemas.tableCreateSchema.safeParse(input).success, false, JSON.stringify(input))
  assert.equal(schemas.tableUpdateSchema.safeParse({ chairs: 4 }).success, false, 'an update names its table')
  assert.equal(schemas.tableUpdateSchema.safeParse({ id: 3, chairs: 4 }).success, true)
  assert.equal(schemas.tableDeleteSchema.safeParse({ id: 0 }).success, false)
})

test('schemas: a seat change names one person and a table, a chair, or nothing', () => {
  assert.equal(schemas.moveSchema.safeParse({ invitationId: 1, index: 0, target: null }).success, true)
  assert.equal(schemas.moveSchema.safeParse({ invitationId: 1, index: 1, target: { tableId: 2 } }).success, true)
  assert.equal(schemas.moveSchema.safeParse({ invitationId: 1, index: 1, target: { tableId: 2, chair: 23 } }).success, true)
  const bad = [
    { invitationId: 1, index: 0 }, { invitationId: 0, index: 0, target: null }, { invitationId: 1, index: -1, target: null }, { invitationId: 1, index: 20, target: null },
    { invitationId: 1, index: 0, target: { tableId: 2, chair: 24 } }, { invitationId: 1, index: 0, target: { chair: 1 } }, { invitationId: '1', index: 0, target: null },
    { invitationId: 1, index: 0, target: 'Table 1' },
  ]
  for (const input of bad) assert.equal(schemas.moveSchema.safeParse(input).success, false, JSON.stringify(input))
})

test('schemas: the stored plan is validated, not trusted, and starts unpublished', () => {
  assert.equal(schemas.DEFAULT_PLAN.published, false)
  const plan = { published: true, room: { width: 1600, height: 1000 }, shapes: [{ id: 'stage-1', label: 'Stage', x: 100, y: 100, width: 300, height: 120 }] }
  assert.deepEqual(plain(schemas.parsePlan(JSON.stringify(plan))), plan)
  for (const raw of [null, '', 'not json', '{}', JSON.stringify({ ...plan, published: 'yes' }), JSON.stringify({ ...plan, room: { width: 10, height: 10 } }),
    JSON.stringify({ ...plan, shapes: [{ ...plan.shapes[0], label: '' }] }), JSON.stringify({ ...plan, shapes: [{ ...plan.shapes[0], id: '<script>' }] })]) {
    assert.deepEqual(plain(schemas.parsePlan(raw)), plain(schemas.DEFAULT_PLAN), String(raw))
  }
})

// ─── What a guest may see ─────────────────────────────────────────────────────
const published = { published: true, room: { width: 1600, height: 1000 }, shapes: [{ id: 'stage-1', label: 'Stage', x: 800, y: 80, width: 300, height: 100 }] }
const floorTables = [table(1, 10, { label: 'Table 7' }), table(2, 10, { label: 'Table 8' })]
const guestInput = extra => ({ plan: published, tables: floorTables, assignments: [seat(5, 0, 1, 0), seat(5, 1, 1, 1)], invitation: { id: 5, seats: 2 }, response: yes(2, ['Maria Cruz']), ...extra })

test('guest: a seated guest sees their table, their plus one\'s, and the room', () => {
  const view = guest.buildGuestSeating(guestInput())
  assert.deepEqual(plain(view.seats), [{ who: 'You', table: 'Table 7' }, { who: 'Maria Cruz', table: 'Table 7' }])
  assert.deepEqual(plain(view.map.tables.map(item => [item.label, item.mine])), [['Table 7', true], ['Table 8', false]])
  assert.deepEqual(plain(view.map.shapes), [{ label: 'Stage', x: 800, y: 80, width: 300, height: 100 }])
  assert.deepEqual(plain(guest.seatingSentences(view.seats)), ['You and Maria Cruz are at Table 7.'])
})

test('guest: nothing is shown before the couple publishes, to a guest who declined, or to one not seated yet', () => {
  assert.equal(guest.buildGuestSeating(guestInput({ plan: { ...published, published: false } })), null)
  assert.equal(guest.buildGuestSeating(guestInput({ response: no })), null)
  assert.equal(guest.buildGuestSeating(guestInput({ assignments: [] })), null)
  assert.equal(guest.buildGuestSeating(guestInput({ assignments: [seat(5, 0, 99, 0)] })), null, 'a seat at a table that no longer exists')
})

test('guest: only their own party appears, and no ids or other names leave the server', () => {
  const others = [seat(6, 0, 1, 2), seat(7, 0, 2, 0)]
  const view = guest.buildGuestSeating(guestInput({ assignments: [seat(5, 0, 1, 0), ...others] }))
  assert.deepEqual(plain(view.seats), [{ who: 'You', table: 'Table 7' }])
  const text = JSON.stringify(view)
  assert.ok(!/invitationId|"id"|tableId|chair"/.test(text.replace(/"chairs"/g, '')), text)
  assert.deepEqual(Object.keys(plain(view.map.tables[0])).sort(), ['chairs', 'label', 'mine', 'rotation', 'shape', 'x', 'y'])
})

test('guest: plus ones the guest did not confirm are left out; before a reply all of them are shown', () => {
  const split = [seat(5, 0, 1, 0), seat(5, 1, 2, 0), seat(5, 2, 2, 1)]
  const confirmed = guest.buildGuestSeating(guestInput({ invitation: { id: 5, seats: 3 }, response: yes(2, ['Maria Cruz']), assignments: split }))
  assert.deepEqual(plain(confirmed.seats), [{ who: 'You', table: 'Table 7' }, { who: 'Maria Cruz', table: 'Table 8' }])
  assert.deepEqual(plain(guest.seatingSentences(confirmed.seats)), ['You are at Table 7.', 'Maria Cruz is at Table 8.'])
  const pending = guest.buildGuestSeating(guestInput({ invitation: { id: 5, seats: 3 }, response: null, assignments: split }))
  assert.deepEqual(plain(pending.seats.map(item => item.who)), ['You', 'Your plus one', 'Your plus two'])
  const single = guest.buildGuestSeating(guestInput({ response: null }))
  assert.deepEqual(plain(guest.seatingSentences(single.seats)), ['You and Your plus one are at Table 7.'])
  // A seat left over from a larger invitation is never shown.
  const reduced = guest.buildGuestSeating(guestInput({ invitation: { id: 5, seats: 1 }, response: null }))
  assert.deepEqual(plain(reduced.seats), [{ who: 'You', table: 'Table 7' }])
})

// ─── The invitation still works whatever the seat plan does ───────────────────
test('invitation: the guest view carries the table when there is one, and survives a seat plan failure', async () => {
  const KEY = 'test-only-invite-token-key-0123456789abcdef'
  const cache = new Map()
  const service = load('src/lib/invitations/service.ts', {}, cache, { INVITE_TOKEN_KEY: KEY })
  const tokens = load('src/lib/invitations/token.ts', {}, cache, { INVITE_TOKEN_KEY: KEY })
  const token = tokens.generateToken()
  const record = { id: 5, guestName: 'Jazzer Santos', email: null, seats: 2, plusOnes: [], status: 'active', tokenHash: tokens.hashToken(token), firstOpenedAt: null, lastOpenedAt: null, respondedAt: null }
  const base = { findByTokenHash: async () => ({ ...record }), findRsvp: async () => null, deadlineText: async () => null }
  const seating = guest.buildGuestSeating(guestInput({ response: null }))
  assert.deepEqual(plain((await service.loadInviteView({ ...base, findSeating: async () => seating }, token)).seating.seats.map(item => item.table)), ['Table 7', 'Table 7'])
  for (const findSeating of [async () => null, async () => { throw new Error('relation "seating_plan" does not exist') }, undefined]) {
    const view = await service.loadInviteView({ ...base, findSeating }, token)
    assert.equal(view.firstName, 'Jazzer')
    assert.ok(!('seating' in view))
  }
  assert.equal(await service.loadInviteView({ ...base, findByTokenHash: async () => null, findSeating: async () => seating }, token), null)
})

// ─── Admin routes refuse anyone without a session ─────────────────────────────
test('admin routes: every seating handler answers 401 and touches no data without a session', async () => {
  const touched = []
  const guarded = name => new Proxy({}, { get: (_target, property) => (...args) => { touched.push(`${name}.${String(property)}`); throw new Error('data access without a session') } })
  const json = (body, init = {}) => ({ body, status: init.status ?? 200 })
  const overrides = {
    'next/server': { NextResponse: { json } },
    '@/lib/auth': { isAdminRequest: async () => false },
    '@/lib/seating/store': guarded('store'),
    '@/lib/invitations/admin-store': { DuplicateContactError: class extends Error {} },
  }
  const request = { json: async () => { touched.push('request.json'); return {} }, cookies: { get: () => undefined } }
  const routes = {
    'src/app/api/admin/seating/route.ts': ['GET', 'POST', 'PATCH', 'DELETE'],
    'src/app/api/admin/seating/assign/route.ts': ['POST'],
    'src/app/api/admin/seating/plan/route.ts': ['PUT'],
  }
  for (const [file, methods] of Object.entries(routes)) {
    const route = load(file, overrides, new Map())
    for (const method of methods) {
      const response = await route[method](request)
      assert.equal(response.status, 401, `${file} ${method}`)
      assert.equal(response.body.success, false)
    }
  }
  assert.deepEqual(touched, [])
})

test('admin routes: with a session, bad input is refused before the store and known failures get clear answers', async () => {
  const cache = new Map()
  // Loaded through the same cache as the routes, so both see the one SeatingError class.
  const errors = load('src/lib/seating/errors.ts', {}, cache)
  const calls = []
  const json = (body, init = {}) => ({ body, status: init.status ?? 200 })
  const store = {
    moveSeat: async input => { calls.push(input); throw new errors.SeatingError('Table 1 is full.') },
    loadSeating: async () => { throw Object.assign(new Error('relation does not exist'), { code: '42P01' }) },
    savePlan: async () => { throw Object.assign(new Error('duplicate'), { code: '23505' }) },
  }
  const overrides = {
    'next/server': { NextResponse: { json } },
    '@/lib/auth': { isAdminRequest: async () => true },
    '@/lib/seating/store': store,
    '@/lib/invitations/admin-store': { DuplicateContactError: class extends Error {} },
  }
  const assign = load('src/app/api/admin/seating/assign/route.ts', overrides, cache)
  const bad = await assign.POST({ json: async () => ({ invitationId: 1, index: 0, target: { tableId: 'x' } }) })
  assert.equal(bad.status, 400)
  assert.deepEqual(calls, [])
  const full = await assign.POST({ json: async () => ({ invitationId: 1, index: 0, target: { tableId: 1 } }) })
  assert.deepEqual([full.status, full.body.error], [409, 'Table 1 is full.'])
  const notReady = await load('src/app/api/admin/seating/route.ts', overrides, cache).GET({})
  assert.deepEqual([notReady.status, notReady.body.error], [503, errors.SEATING_NOT_READY])
  const clash = await load('src/app/api/admin/seating/plan/route.ts', overrides, cache).PUT({ json: async () => ({}) })
  assert.equal(clash.status, 409)
})

// ─── Migration ────────────────────────────────────────────────────────────────
test('migration: the seating file only creates new tables and indexes, and matches schema.ts', () => {
  const result = spawnSync(process.execPath, [path.join(root, 'scripts/migrate.cjs'), '--plan', '--file=20261113_seating.sql'], { cwd: root, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  const plan = JSON.parse(result.stdout)
  assert.equal(plan.applied, false)
  const statements = plan.migrations[0].statements
  assert.equal(statements.length, 5)
  assert.ok(statements.every(sql => /^CREATE (TABLE|UNIQUE INDEX) IF NOT EXISTS seating_/.test(sql)), 'only idempotent creations of seating objects')
  assert.ok(!statements.some(sql => /\b(DROP|DELETE FROM|UPDATE [a-z_]+ SET|TRUNCATE|INSERT INTO|ALTER TABLE)\b/i.test(sql)))
  // Only the seating tables themselves may be named on the left of a statement; invitations is referenced, never changed.
  assert.ok(statements.every(sql => !/\b(rsvps|guest_list|wedding_config|invite_settings)\b/.test(sql)))
  const schema = read('src/lib/schema.ts')
  const section = schema.slice(schema.indexOf("pgTable('seating_tables'"), schema.indexOf('// ─── FAQ Items'))
  const declared = [...section.matchAll(/\('([a-z_]+)'/g)].map(match => match[1])
  assert.ok(declared.length >= 18)
  const sql = read('migrations/20261113_seating.sql')
  for (const name of declared) assert.match(sql, new RegExp('\\b' + name + '\\b'), name)
})

// ─── The 3D hall ──────────────────────────────────────────────────────────────
test('3D hall: real models and scans are shipped small, and fetched only when the hall is opened', () => {
  const folder = path.join(root, 'public/wedding/venue')
  const files = fs.readdirSync(folder)
  for (const model of ['chair', 'round-table', 'long-cloth', 'place-setting', 'wine-glass', 'flowers', 'aircon', 'chandelier', 'wall-lantern', 'fire-extinguisher', 'potted-plant', 'fern', 'shrub']) {
    assert.ok(files.includes(model + '.glb'), model)
  }
  for (const surface of ['floor', 'wall', 'roof', 'drive']) for (const map of ['diff', 'nor', 'rough']) assert.ok(files.includes(`${surface}_${map}.webp`), `${surface} ${map}`)
  assert.ok(files.includes('sky.hdr') && files.filter(file => file.startsWith('tree-')).length >= 4)
  const total = files.reduce((sum, file) => sum + fs.statSync(path.join(folder, file)).size, 0)
  assert.ok(total < 7 * 1024 * 1024, `venue assets are ${(total / 1048576).toFixed(1)} MB`)
  // Nothing outside the 3D hall mentions them, and the hall itself is loaded on demand.
  assert.match(read('src/app/admin/(panel)/seating/_components/SeatingView.tsx'), /dynamic\(\(\) => import\('\.\/Venue3D'\)/)
  assert.match(read('src/app/admin/(panel)/seating/_components/Venue3D.tsx'), /import\('@\/world\/venue\/venue-scene'\)/)
  assert.ok(!read('src/lib/loading/assets.ts').includes('venue'), 'not part of the public site\'s first load')
})

test('3D hall: every chair faces its table, with its place setting between the sitter and the centre', () => {
  const source = read('src/world/venue/furniture.ts')
  // The chair is turned so its back (+z) points away from the table, and is set outside the edge; the setting inside it.
  assert.match(source, /chair: out\.clone\(\)\.multiplyScalar\(halfWidth \+ CHAIR_OUT\), setting: out\.clone\(\)\.multiplyScalar\(halfWidth - SETTING_IN\), turn: angle/)
  assert.match(source, /placed\(assets\.models\.chair, \{ height: 0\.92, turn: Math\.PI \}\)/)
  assert.match(source, /turn: side > 0 \? 0 : Math\.PI/)
})

// ─── Privacy and safety of the code paths ─────────────────────────────────────
test('guest path: seating is read through the personal link only, and the public lookup knows nothing of it', () => {
  for (const file of ['src/lib/invitations/lookup.ts', 'src/lib/invitations/lookup-store.ts', 'src/app/api/invite/lookup/route.ts', 'src/lib/invitations/status-copy.ts']) {
    assert.ok(!/seating/i.test(read(file)), file)
  }
  const store = read('src/lib/seating/store.ts')
  // The guest query is narrowed to one invitation in the database, not filtered afterwards.
  assert.match(store, /where\(eq\(seatingAssignments\.invitationId, invitation\.id\)\)/)
  // Seating never writes to invitations or RSVPs.
  assert.ok(!/\.(insert|update|delete)\((invitations|rsvps)\)/.test(store))
})
