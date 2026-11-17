import * as T from 'three'
import { crowd, placed, surfaceMaterial, type VenueAssets } from './assets'

/**
 * The reception hall, modelled on the venue's walkthrough video: a white gabled
 * pavilion with black steel-framed grid windows on every side, a double glass
 * door in one gable end, a polished concrete floor, exposed white rafters under
 * a metal roof, and iron ring chandeliers along the ridge.
 *
 * The building itself is made to measure, because no ready-made model has this
 * hall's proportions; its surfaces are scanned materials, and everything in and
 * around it (lights, air-conditioners, plants, trees) is a real model.
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
  // Slim steel sections, as on the real windows: a 4 cm frame and 2.5 cm glazing bars.
  const frame = 0.04, bar = 0.025, depth = 0.06
  group.add(box(width, frame, depth, steel, centre, bottom + frame / 2, 0), box(width, frame, depth, steel, centre, bottom + height - frame / 2, 0))
  group.add(box(frame, height, depth, steel, centre - width / 2 + frame / 2, middle, 0), box(frame, height, depth, steel, centre + width / 2 - frame / 2, middle, 0))
  for (let col = 1; col < cols; col += 1) group.add(box(bar, height, depth * 0.7, steel, centre - width / 2 + (width * col) / cols, middle, 0))
  for (let row = 1; row < rows; row += 1) group.add(box(width, bar, depth * 0.7, steel, centre, bottom + (height * row) / rows, 0))
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

/** Both roof slopes, visible from underneath only. */
function roof({ width, length }: HallSize, material: T.Material): T.Mesh {
  const { eave, ridge } = HALL
  const half = width / 2
  // Left slope then right slope; each wound so its face looks down into the hall.
  const positions = [
    0, eave, 0, half, ridge, length, 0, eave, length, 0, eave, 0, half, ridge, 0, half, ridge, length,
    width, eave, 0, width, eave, length, half, ridge, length, width, eave, 0, half, ridge, length, half, ridge, 0,
  ]
  // The sheet's ribs run up the slope, repeating about once a metre along the hall.
  const along = length, up = Math.hypot(half, ridge - eave)
  const uvs = [0, 0, along, up, along, 0, 0, 0, 0, up, along, up, 0, 0, along, 0, along, up, 0, 0, along, up, 0, up]
  const geometry = new T.BufferGeometry()
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2))
  geometry.computeVertexNormals()
  return new T.Mesh(geometry, material)
}

/** White steel rafters at each bay and purlins along the length, as in the video's ceiling. */
function rafters({ width, length }: HallSize): T.Group {
  const group = new T.Group()
  const material = new T.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.55, metalness: 0.3 })
  const { eave, ridge } = HALL
  const half = width / 2, rise = ridge - eave, slope = Math.hypot(half, rise), angle = Math.atan2(rise, half)
  const bays = Math.max(2, Math.round(length / 3))
  for (let bay = 0; bay <= bays; bay += 1) {
    const z = Math.min(length - 0.05, Math.max(0.05, (bay * length) / bays))
    for (const side of [-1, 1]) {
      const rafter = box(slope, 0.12, 0.06, material, half + (side * half) / 2, eave + rise / 2 - 0.09, z)
      rafter.rotation.z = -side * angle
      group.add(rafter)
    }
  }
  for (const fraction of [0.2, 0.45, 0.7, 0.95]) {
    for (const side of [-1, 1]) group.add(box(0.04, 0.07, length, material, half + side * half * (1 - fraction), eave + rise * fraction - 0.04, length / 2))
  }
  return group
}

/** A photograph of a real tree on two crossed panels: light to draw, and convincing from across a lawn or through a window. */
function tree(picture: T.Texture, height: number): T.Group {
  const image = picture.image as { width: number; height: number }
  const width = (height * image.width) / image.height
  const material = new T.MeshBasicMaterial({ map: picture, alphaTest: 0.45, side: T.DoubleSide, toneMapped: true })
  const group = new T.Group()
  for (const turn of [0, Math.PI / 2]) {
    const panel = new T.Mesh(new T.PlaneGeometry(width, height), material)
    panel.position.y = height / 2
    panel.rotation.y = turn
    group.add(panel)
  }
  return group
}

/** Grounds seen through the glass: lawn, the drive up to the door, planted boxes under the front windows, and trees all around. */
function grounds({ width, length }: HallSize, assets: VenueAssets): T.Group {
  const group = new T.Group()
  const span = Math.max(width, length)
  const lawn = new T.Mesh(new T.CircleGeometry(span * 5, 64), new T.MeshStandardMaterial({ color: 0x4d6540, roughness: 1 }))
  lawn.rotation.x = -Math.PI / 2
  lawn.position.set(width / 2, -0.03, length / 2)
  lawn.receiveShadow = true
  const drive = new T.Mesh(new T.PlaneGeometry(width + 8, 10), surfaceMaterial(assets.surfaces.drive, (width + 8) / 3, 10 / 3, { color: 0xb8b2a8 }))
  drive.rotation.x = -Math.PI / 2
  drive.position.set(width / 2, -0.02, length + 5)
  drive.receiveShadow = true
  group.add(lawn, drive)

  // White rendered planters under the front windows, as at the real entrance, filled with ferns and shrubs.
  const render = new T.MeshStandardMaterial({ color: 0xf1ede5, roughness: 0.9 }), soil = new T.MeshStandardMaterial({ color: 0x3b2e25, roughness: 1 })
  const side = (width - HALL.door.width) / 2 - 0.6
  const perBox = Math.max(2, Math.round(side / 0.7))
  const ferns = crowd(placed(assets.models.fern, { height: 0.5 }), perBox * 2), shrubs = crowd(placed(assets.models.shrub, { height: 0.55 }), perBox * 2)
  const spot = new T.Object3D()
  let planted = 0
  for (const centre of [side / 2 + 0.2, width - side / 2 - 0.2]) {
    group.add(box(side, 0.45, 0.7, render, centre, 0.22, length + 0.47), box(side - 0.16, 0.04, 0.54, soil, centre, 0.44, length + 0.47))
    for (let index = 0; index < perBox; index += 1) {
      const x = centre - side / 2 + ((index + 0.5) * side) / perBox
      for (const [plants, depth, scale] of [[ferns, 0.36, 1], [shrubs, 0.58, 0.9]] as const) {
        spot.position.set(x + (index % 2 ? 0.08 : -0.08), 0.44, length + depth)
        spot.rotation.set(0, index * 2.1 + depth * 9, 0)
        spot.scale.setScalar(scale * (0.85 + ((index * 37) % 10) / 30))
        spot.updateMatrix()
        plants.set(planted, spot.matrix)
      }
      planted += 1
    }
  }
  ferns.finish(); shrubs.finish()
  group.add(ferns.group, shrubs.group)

  // Trees all around, placed the same way every time, clear of the approach to the door.
  let seed = 11
  const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
  const count = 54
  for (let index = 0; index < count; index += 1) {
    const turn = (index / count) * Math.PI * 2 + random() * 0.25
    const distance = span * (1.0 + random() * 1.9)
    const x = width / 2 + Math.cos(turn) * distance, z = length / 2 + Math.sin(turn) * distance
    const picture = assets.trees[Math.floor(random() * assets.trees.length)]
    if (Math.abs(x - width / 2) < width / 2 + 3 && z > length && z < length + 12) continue
    const item = tree(picture, 7 + random() * 6)
    item.position.set(x, -0.1, z)
    item.rotation.y = random() * Math.PI
    group.add(item)
  }
  return group
}

export function buildHall(size: HallSize, assets: VenueAssets): T.Group {
  const { width, length } = size
  const { eave, ridge, door, frontWindow } = HALL
  const hall = new T.Group()
  // Painted plaster, tiled every two and a half metres (wall sheets are mapped in metres).
  const walls = surfaceMaterial(assets.surfaces.wall, 0.4, 0.4, { color: 0xf6f3ec, normalScale: new T.Vector2(0.5, 0.5) }, true)
  const steel = new T.MeshStandardMaterial({ color: 0x141517, roughness: 0.42, metalness: 0.7 })
  const glass = new T.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.02, metalness: 0, transparent: true, opacity: 0.1, side: T.DoubleSide, depthWrite: false, envMapIntensity: 1.4 })

  // Polished concrete: the scan gives the mottling, a low roughness gives the sheen.
  const floor = new T.Mesh(new T.PlaneGeometry(width, length), surfaceMaterial(assets.surfaces.floor, width / 5, length / 5, { color: 0xa8a195, roughness: 0.5, metalness: 0, normalScale: new T.Vector2(0.15, 0.15) }, true))
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
  const sideWindows = windowRow(length, 3)
  const left = wall(side(length), sideWindows, walls, steel, glass)
  left.rotation.y = Math.PI / 2
  left.position.set(0, 0, length)
  const right = wall(side(length), sideWindows, walls, steel, glass)
  right.rotation.y = -Math.PI / 2
  right.position.set(width, 0, 0)
  // Cream-painted metal sheet: the scan gives the ribs, the paint gives the colour.
  const sheet = surfaceMaterial(assets.surfaces.roof, 1, 1, { color: 0xe4decb, metalness: 0.1, roughness: 0.7, normalScale: new T.Vector2(0.3, 0.3) }, true)
  hall.add(front, left, right, roof(size, sheet), rafters(size))

  // Iron ring chandeliers hung from the ridge, each with a warm light.
  const lights = Math.max(1, Math.round(length / 5.5))
  for (let index = 0; index < lights; index += 1) {
    const chandelier = placed(assets.models.chandelier, { width: 1.15 })
    const height = new T.Box3().setFromObject(chandelier).getSize(new T.Vector3()).y
    const z = ((index + 0.5) * length) / lights
    chandelier.position.set(width / 2, ridge - 0.04 - height, z)
    const glow = new T.PointLight(0xffd2a0, 3, 10, 2)
    glow.position.set(width / 2, ridge - height - 0.1, z)
    hall.add(chandelier, glow)
  }

  // Split air-conditioners high on the far wall.
  for (const x of [width * 0.3, width * 0.7]) {
    const unit = placed(assets.models.aircon, { width: 1.0, turn: Math.PI / 2 })
    unit.position.set(x, eave - 0.42, 0.14)
    hall.add(unit)
  }
  // Lantern wall lights between the side windows, backs to the wall.
  const gaps = sideWindows.slice(1).map((opening, index) => (opening.centre + sideWindows[index].centre) / 2)
  gaps.forEach((along, index) => {
    if (index % 2) return
    for (const sideOf of [-1, 1]) {
      const lantern = placed(assets.models['wall-lantern'], { height: 0.42, turn: sideOf < 0 ? -Math.PI / 2 : Math.PI / 2 })
      lantern.position.set(sideOf < 0 ? 0.16 : width - 0.16, 1.85, sideOf < 0 ? length - along : along)
      hall.add(lantern)
    }
  })
  // A fire extinguisher in the far corner and a potted plant either side of the door, inside.
  const extinguisher = placed(assets.models['fire-extinguisher'], { height: 0.6 })
  extinguisher.position.set(0.3, 0, 0.3)
  hall.add(extinguisher)
  for (const x of [width / 2 - door.width / 2 - 0.55, width / 2 + door.width / 2 + 0.55]) {
    const plant = placed(assets.models['potted-plant'], { height: 1.0 })
    plant.position.set(x, 0, length - 0.5)
    hall.add(plant)
  }
  hall.add(grounds(size, assets))
  return hall
}
