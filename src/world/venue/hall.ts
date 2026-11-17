import * as T from 'three'

/**
 * The reception hall, modelled on the venue's walkthrough video: a white gabled
 * pavilion with black steel-framed grid windows on every side, a double glass
 * door in one gable end, a polished concrete floor, exposed white rafters under
 * a corrugated roof, and iron ring chandeliers along the ridge.
 *
 * Everything is in metres. The floor runs from (0, 0) to (width, length) with
 * the entrance on the wall at z = length, matching the bottom edge of the plan.
 * Walls and roof are drawn on their inner face only, so from outside you look
 * straight in, like a doll's house.
 */

export interface HallSize { width: number; length: number }

/** Heights and openings estimated from the video against the double door, the split air-conditioners and the fire extinguisher. */
export const HALL = {
  eave: 3.2, ridge: 4.7,
  window: { width: 1.6, height: 2.3, sill: 0.45, cols: 2, rows: 3 },
  door: { width: 1.9, height: 2.75 },
  frontWindow: { height: 2.3, sill: 0.5, cols: 5, rows: 3 },
} as const

interface Opening { centre: number; width: number; bottom: number; height: number; cols: number; rows: number }

const WHITE = 0xf4f1ea, STEEL = 0x17181a

const wallMaterial = () => new T.MeshStandardMaterial({ color: WHITE, roughness: 0.92 })
const steelMaterial = () => new T.MeshStandardMaterial({ color: STEEL, roughness: 0.45, metalness: 0.6 })
const glassMaterial = () => new T.MeshStandardMaterial({ color: 0xcfe3dc, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.16, side: T.DoubleSide, depthWrite: false })

function box(width: number, height: number, depth: number, material: T.Material, x: number, y: number, z: number): T.Mesh {
  const mesh = new T.Mesh(new T.BoxGeometry(width, height, depth), material)
  mesh.position.set(x, y, z)
  return mesh
}

/** A black steel grid window (or glazed door) filling one opening, in the wall's own flat coordinates. */
function glazing(opening: Opening, steel: T.Material, glass: T.Material): T.Group {
  const group = new T.Group()
  const { centre, width, bottom, height, cols, rows } = opening
  const middle = bottom + height / 2
  const pane = new T.Mesh(new T.PlaneGeometry(width, height), glass)
  pane.position.set(centre, middle, 0)
  group.add(pane)
  const frame = 0.06, bar = 0.035, depth = 0.07
  group.add(box(width, frame, depth, steel, centre, bottom + frame / 2, 0), box(width, frame, depth, steel, centre, bottom + height - frame / 2, 0))
  group.add(box(frame, height, depth, steel, centre - width / 2 + frame / 2, middle, 0), box(frame, height, depth, steel, centre + width / 2 - frame / 2, middle, 0))
  for (let col = 1; col < cols; col += 1) group.add(box(bar, height, depth * 0.8, steel, centre - width / 2 + (width * col) / cols, middle, 0))
  for (let row = 1; row < rows; row += 1) group.add(box(width, bar, depth * 0.8, steel, centre, bottom + (height * row) / rows, 0))
  group.traverse(object => { if (object instanceof T.Mesh && object !== pane) object.castShadow = true })
  return group
}

/** One wall as a flat sheet with its openings cut out, plus the glazing that fills them. Faces +z until placed. */
function wall(outline: readonly [number, number][], openings: readonly Opening[], material: T.Material, steel: T.Material, glass: T.Material): T.Group {
  const shape = new T.Shape(outline.map(([x, y]) => new T.Vector2(x, y)))
  for (const opening of openings) {
    const left = opening.centre - opening.width / 2, right = opening.centre + opening.width / 2, top = opening.bottom + opening.height
    shape.holes.push(new T.Path([new T.Vector2(left, opening.bottom), new T.Vector2(left, top), new T.Vector2(right, top), new T.Vector2(right, opening.bottom)]))
  }
  const group = new T.Group()
  const sheet = new T.Mesh(new T.ShapeGeometry(shape), material)
  sheet.receiveShadow = true
  sheet.castShadow = true
  group.add(sheet, ...openings.map(opening => glazing(opening, steel, glass)))
  return group
}

/** Evenly spaced standard windows along a wall of the given length. */
function windowRow(length: number, pitch: number): Opening[] {
  const count = Math.max(1, Math.floor(length / pitch))
  return Array.from({ length: count }, (_unused, index) => ({
    centre: ((index + 0.5) * length) / count, width: HALL.window.width, bottom: HALL.window.sill, height: HALL.window.height, cols: HALL.window.cols, rows: HALL.window.rows,
  }))
}

function corrugated(): T.Texture {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 8
  const pen = canvas.getContext('2d')
  if (pen) {
    const stripes = pen.createLinearGradient(0, 0, 64, 0)
    for (let i = 0; i <= 8; i += 1) stripes.addColorStop(i / 8, i % 2 ? '#cfc8ac' : '#e6e0c8')
    pen.fillStyle = stripes
    pen.fillRect(0, 0, 64, 8)
  }
  const texture = new T.CanvasTexture(canvas)
  texture.wrapS = texture.wrapT = T.RepeatWrapping
  texture.colorSpace = T.SRGBColorSpace
  return texture
}

/** Both roof slopes, visible from underneath only. */
function roof({ width, length }: HallSize): T.Mesh {
  const { eave, ridge } = HALL
  const half = width / 2
  // Left slope then right slope; each wound so its face looks down into the hall.
  const positions = [
    0, eave, 0, half, ridge, length, 0, eave, length, 0, eave, 0, half, ridge, 0, half, ridge, length,
    width, eave, 0, width, eave, length, half, ridge, length, width, eave, 0, half, ridge, length, half, ridge, 0,
  ]
  const repeat = length / 0.4
  const uvs = [0, 0, repeat, 1, repeat, 0, 0, 0, 0, 1, repeat, 1, 0, 0, repeat, 0, repeat, 1, 0, 0, repeat, 1, 0, 1]
  const geometry = new T.BufferGeometry()
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2))
  geometry.computeVertexNormals()
  return new T.Mesh(geometry, new T.MeshStandardMaterial({ map: corrugated(), roughness: 0.7, metalness: 0.15 }))
}

/** White steel rafters at each bay and purlins along the length, as in the video's ceiling. */
function rafters({ width, length }: HallSize): T.Group {
  const group = new T.Group()
  const material = new T.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.6, metalness: 0.2 })
  const { eave, ridge } = HALL
  const half = width / 2, rise = ridge - eave, slope = Math.hypot(half, rise), angle = Math.atan2(rise, half)
  const bays = Math.max(2, Math.round(length / 3))
  for (let bay = 0; bay <= bays; bay += 1) {
    const z = Math.min(length - 0.05, Math.max(0.05, (bay * length) / bays))
    for (const side of [-1, 1]) {
      const rafter = box(slope, 0.14, 0.07, material, half + (side * half) / 2, eave + rise / 2 - 0.1, z)
      rafter.rotation.z = -side * angle
      group.add(rafter)
    }
  }
  for (const fraction of [0.2, 0.45, 0.7, 0.95]) {
    for (const side of [-1, 1]) group.add(box(0.05, 0.08, length, material, half + side * half * (1 - fraction), eave + rise * fraction - 0.04, length / 2))
  }
  return group
}

/** An iron ring chandelier with candle bulbs, hung from the ridge. */
function chandelier(x: number, z: number, steel: T.Material): T.Group {
  const group = new T.Group()
  const height = 3.05
  const ring = new T.Mesh(new T.TorusGeometry(0.48, 0.03, 8, 40), steel)
  ring.rotation.x = Math.PI / 2
  ring.position.y = height
  group.add(ring, box(0.02, HALL.ridge - height - 0.1, 0.02, steel, 0, (HALL.ridge + height) / 2, 0))
  const wax = new T.MeshStandardMaterial({ color: 0xfff6e0, emissive: 0xffc98a, emissiveIntensity: 1.6, roughness: 0.6 })
  for (let index = 0; index < 8; index += 1) {
    const turn = (index / 8) * Math.PI * 2
    const candle = new T.Mesh(new T.CylinderGeometry(0.018, 0.018, 0.13, 8), wax)
    candle.position.set(Math.cos(turn) * 0.48, height + 0.09, Math.sin(turn) * 0.48)
    group.add(candle)
  }
  const glow = new T.PointLight(0xffd9a8, 2.2, 9, 2)
  glow.position.y = height - 0.1
  group.add(glow)
  group.position.set(x, 0, z)
  return group
}

/** Grounds seen through the glass: lawn, the drive up to the door, planters, and a ring of trees. */
function grounds({ width, length }: HallSize): T.Group {
  const group = new T.Group()
  const lawn = new T.Mesh(new T.CircleGeometry(Math.max(width, length) * 4.5, 48), new T.MeshStandardMaterial({ color: 0x6f8c5c, roughness: 1 }))
  lawn.rotation.x = -Math.PI / 2
  lawn.position.set(width / 2, -0.03, length / 2)
  lawn.receiveShadow = true
  const drive = new T.Mesh(new T.PlaneGeometry(width + 6, 9), new T.MeshStandardMaterial({ color: 0x6d6a64, roughness: 0.95 }))
  drive.rotation.x = -Math.PI / 2
  drive.position.set(width / 2, -0.02, length + 4.5)
  drive.receiveShadow = true
  group.add(lawn, drive)
  // White planters under the front windows, as at the real entrance.
  const planter = new T.MeshStandardMaterial({ color: WHITE, roughness: 0.9 }), leaves = new T.MeshStandardMaterial({ color: 0x4f7f45, roughness: 1 })
  const side = (width - HALL.door.width) / 2 - 0.6
  for (const centre of [side / 2 + 0.2, width - side / 2 - 0.2]) {
    group.add(box(side, 0.45, 0.7, planter, centre, 0.22, length + 0.45), box(side - 0.2, 0.18, 0.5, leaves, centre, 0.5, length + 0.45))
  }
  // Trees all around, placed the same way every time.
  let seed = 7
  const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
  const count = 46
  const trunks = new T.InstancedMesh(new T.CylinderGeometry(0.16, 0.24, 1, 7), new T.MeshStandardMaterial({ color: 0x5d4a3a, roughness: 1 }), count)
  const crowns = new T.InstancedMesh(new T.IcosahedronGeometry(1, 1), new T.MeshStandardMaterial({ color: 0x4d8a4a, roughness: 1, flatShading: true }), count)
  const place = new T.Object3D(), tint = new T.Color()
  for (let index = 0; index < count; index += 1) {
    const turn = (index / count) * Math.PI * 2 + random() * 0.2
    const distance = Math.max(width, length) * (1.55 + random() * 1.1)
    const x = width / 2 + Math.cos(turn) * distance, z = length / 2 + Math.sin(turn) * distance
    // Keep the approach to the door clear.
    if (Math.abs(x - width / 2) < width / 2 + 2 && z > length && z < length + 9) { place.scale.setScalar(0); place.updateMatrix(); trunks.setMatrixAt(index, place.matrix); crowns.setMatrixAt(index, place.matrix); continue }
    const tall = 5 + random() * 5, spread = 2 + random() * 1.8
    place.position.set(x, tall / 2, z); place.scale.set(1, tall, 1); place.rotation.set(0, 0, 0); place.updateMatrix(); trunks.setMatrixAt(index, place.matrix)
    place.position.set(x, tall + spread * 0.5, z); place.scale.set(spread, spread * (0.9 + random() * 0.5), spread); place.rotation.set(0, random() * 6, 0); place.updateMatrix(); crowns.setMatrixAt(index, place.matrix)
    crowns.setColorAt(index, tint.setHSL(0.3 + random() * 0.06, 0.38 + random() * 0.15, 0.3 + random() * 0.14))
  }
  crowns.castShadow = true
  group.add(trunks, crowns)
  return group
}

export function buildHall(size: HallSize): T.Group {
  const { width, length } = size
  const { eave, ridge, door, frontWindow } = HALL
  const hall = new T.Group()
  const walls = wallMaterial(), steel = steelMaterial(), glass = glassMaterial()

  const floor = new T.Mesh(new T.PlaneGeometry(width, length), new T.MeshStandardMaterial({ color: 0xa9a297, roughness: 0.3, metalness: 0.05 }))
  floor.rotation.x = -Math.PI / 2
  floor.position.set(width / 2, 0, length / 2)
  floor.receiveShadow = true
  hall.add(floor)

  const gable: [number, number][] = [[0, 0], [width, 0], [width, eave], [width / 2, ridge], [0, eave]]
  const side = (wallLength: number): [number, number][] => [[0, 0], [wallLength, 0], [wallLength, eave], [0, eave]]

  // Far end wall, behind the head table.
  hall.add(wall(gable, windowRow(width, 2.9), walls, steel, glass))
  // Entrance wall: a double glass door between two wide window walls.
  const flank = (width - door.width) / 2 - 1.5
  const front = wall(gable, [
    { centre: width / 2, width: door.width, bottom: 0.02, height: door.height, cols: 2, rows: 4 },
    ...(flank > 1 ? [0.75 + flank / 2, width - 0.75 - flank / 2].map(centre => ({ centre, width: flank, bottom: frontWindow.sill, height: frontWindow.height, cols: frontWindow.cols, rows: frontWindow.rows })) : []),
  ], walls, steel, glass)
  front.rotation.y = Math.PI
  front.position.set(width, 0, length)
  // The two long walls.
  const left = wall(side(length), windowRow(length, 3), walls, steel, glass)
  left.rotation.y = Math.PI / 2
  left.position.set(0, 0, length)
  const right = wall(side(length), windowRow(length, 3), walls, steel, glass)
  right.rotation.y = -Math.PI / 2
  right.position.set(width, 0, 0)
  hall.add(front, left, right, roof(size), rafters(size))

  const lights = Math.max(1, Math.round(length / 5.5))
  for (let index = 0; index < lights; index += 1) hall.add(chandelier(width / 2, ((index + 0.5) * length) / lights, steel))

  // Small things the video shows: split air-conditioners high on the far wall and a fire extinguisher in the corner.
  const appliance = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 })
  for (const x of [width * 0.3, width * 0.7]) hall.add(box(1.0, 0.3, 0.22, appliance, x, eave - 0.05, 0.12))
  const extinguisher = new T.Mesh(new T.CylinderGeometry(0.07, 0.07, 0.5, 12), new T.MeshStandardMaterial({ color: 0xb3261e, roughness: 0.4 }))
  extinguisher.position.set(0.25, 0.3, 0.3)
  hall.add(extinguisher, grounds(size))
  return hall
}
