import * as T from 'three'
import { chairPoints, tableBox } from '@/lib/seating/geometry'
import type { Assignment, SeatingTable } from '@/lib/seating/rules'
import { crowd, placed, type Crowd, type VenueAssets } from './assets'

/**
 * The tables, chairs, place settings and flowers of the seat plan, in 3D,
 * using real models. The plan is drawn at one unit per centimetre, so
 * positions and sizes are simply divided by 100. The plan's y axis becomes
 * depth (z).
 *
 * Everything is laid out the way a room is really set: chairs tucked in and
 * facing their table, a place setting in front of each chair, flowers down
 * the middle.
 */

const CM = 0.01
const TABLE_HEIGHT = 0.76
/** How far a chair's centre sits out from the table edge, and a place setting's centre in from it. */
const CHAIR_OUT = 0.3
const SETTING_IN = 0.24

export interface FloorBlock { label: string; x: number; y: number; width: number; height: number }

interface Seat {
  /** In the table's own unturned frame, metres. */
  chair: T.Vector3
  setting: T.Vector3
  /** Turn about the vertical axis that points a model's back (+z) away from the table. */
  turn: number
}

/** Where each chair and its place setting go around one table, in the table's own frame. */
function seatsOf(table: SeatingTable): Seat[] {
  const box = tableBox(table.shape, table.chairs)
  const halfWidth = (box.width * CM) / 2, halfDepth = (box.height * CM) / 2
  return chairPoints(table.shape, table.chairs, 0).map(point => {
    if (table.shape === 'round') {
      const angle = Math.atan2(point.x, point.y)
      const out = new T.Vector3(Math.sin(angle), 0, Math.cos(angle))
      return { chair: out.clone().multiplyScalar(halfWidth + CHAIR_OUT), setting: out.clone().multiplyScalar(halfWidth - SETTING_IN), turn: angle }
    }
    // Square tables seat people on all four sides; long and couple's tables on their long sides only.
    if (table.shape === 'square' && Math.abs(point.y) <= box.height / 2) {
      const side = Math.sign(point.x)
      return { chair: new T.Vector3(side * (halfWidth + CHAIR_OUT), 0, point.y * CM), setting: new T.Vector3(side * (halfWidth - SETTING_IN), 0, point.y * CM), turn: (side * Math.PI) / 2 }
    }
    const side = Math.sign(point.y)
    return { chair: new T.Vector3(point.x * CM, 0, side * (halfDepth + CHAIR_OUT)), setting: new T.Vector3(point.x * CM, 0, side * (halfDepth - SETTING_IN)), turn: side > 0 ? 0 : Math.PI }
  })
}

function label(text: string, detail: string): T.Sprite {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 160
  const pen = canvas.getContext('2d')
  if (pen) {
    pen.fillStyle = 'rgba(46, 31, 26, 0.9)'
    pen.beginPath()
    pen.roundRect(8, 8, 496, 144, 72)
    pen.fill()
    pen.fillStyle = '#ffffff'
    pen.textAlign = 'center'
    pen.textBaseline = 'middle'
    pen.font = '600 58px -apple-system, "Helvetica Neue", system-ui, sans-serif'
    pen.fillText(text, 256, detail ? 62 : 80, 460)
    pen.font = '400 38px -apple-system, "Helvetica Neue", system-ui, sans-serif'
    pen.fillStyle = 'rgba(255, 255, 255, 0.75)'
    if (detail) pen.fillText(detail, 256, 116, 460)
  }
  const texture = new T.CanvasTexture(canvas)
  texture.colorSpace = T.SRGBColorSpace
  // Drawn at the same size on screen however near or far, over everything, so a label is always readable.
  const sprite = new T.Sprite(new T.SpriteMaterial({ map: texture, depthWrite: false, depthTest: false, sizeAttenuation: false }))
  sprite.renderOrder = 10
  sprite.scale.set(0.13, 0.041, 1)
  return sprite
}

export interface Furniture {
  group: T.Group
  /** Table and shape names can be hidden for a clean look at the room. */
  showLabels(visible: boolean): void
  dispose(): void
}

export function buildFurniture(assets: VenueAssets, tables: readonly SeatingTable[], assignments: readonly Assignment[], blocks: readonly FloorBlock[]): Furniture {
  const group = new T.Group()
  const labels: T.Sprite[] = []
  const owned: { dispose(): void }[] = []
  const linen = new T.Color(0xf7f4ee)
  const total = tables.reduce((sum, table) => sum + table.chairs, 0)
  const taken = new Set(assignments.map(assignment => `${assignment.tableId}:${assignment.chair}`))

  // One real chair, plate, napkin, cutlery and glass, each drawn once per seat.
  const chairs = crowd(placed(assets.models.chair, { height: 0.92, turn: Math.PI }), total, material => { material.color.set(0xffffff); material.roughness = 0.45; material.metalness = 0 })
  const settings = crowd(placed(assets.models['place-setting'], { width: 0.44 }), total, (material, name) => {
    if (/chrome/i.test(name)) { material.color.set(0xd9d9d9); material.metalness = 1; material.roughness = 0.18 }
    else if (/lambert/i.test(name)) { material.color.set(0x9aa58c); material.roughness = 0.95; material.metalness = 0 } // the folded napkin, in sage linen
    else { material.color.set(0xffffff); material.roughness = 0.15; material.metalness = 0 } // white porcelain
  })
  const glasses = crowd(placed(assets.models['wine-glass'], { height: 0.19 }), total, material => {
    material.color.set(0xffffff); material.transparent = true; material.opacity = 0.28; material.roughness = 0.03; material.metalness = 0; material.depthWrite = false
  })
  const crowds: Crowd[] = [chairs, settings, glasses]
  // A free chair is a shade darker than a taken one: the same chair, but the gaps at a table still show.
  const seatedTint = new T.Color(0xffffff), freeTint = new T.Color(0xb9b2a6)
  const spot = new T.Object3D()
  let next = 0

  for (const table of tables) {
    const box = tableBox(table.shape, table.chairs)
    const width = box.width * CM, depth = box.height * CM
    const set = new T.Group()
    set.position.set(table.x * CM, 0, table.y * CM)
    // A clockwise turn on the plan is a turn the other way about the vertical axis here.
    set.rotation.y = (-table.rotation * Math.PI) / 180

    if (table.shape === 'round') {
      // The model's cloth hangs wider than its top, so it is fitted a little over the table's diameter.
      const round = placed(assets.models['round-table'], { width: width * 1.2, depth: width * 1.2, height: TABLE_HEIGHT + 0.02 })
      round.traverse(object => {
        if (!(object instanceof T.Mesh)) return
        const material = (object.material as T.MeshStandardMaterial).clone()
        if (/cloth/i.test(material.name)) { material.color.copy(linen); material.roughness = 0.92; material.metalness = 0; material.side = T.DoubleSide }
        else { material.color.set(0x4a3527); material.roughness = 0.6 }
        object.material = material
        owned.push(material)
      })
      set.add(round)
    } else {
      // A floor-length cloth over the table: its folds come from the model, its size from the plan.
      const cloth = placed(assets.models['long-cloth'], { width: width + 0.12, depth: depth + 0.12, height: TABLE_HEIGHT })
      cloth.traverse(object => {
        if (!(object instanceof T.Mesh)) return
        const material = (object.material as T.MeshStandardMaterial).clone()
        material.color.copy(linen)
        material.side = T.DoubleSide
        object.material = material
        owned.push(material)
      })
      set.add(cloth)
    }

    // Flowers down the middle: one arrangement on a round or square table, one every metre and a bit on a long one.
    const arrangements = table.shape === 'round' || table.shape === 'square' ? 1 : Math.max(1, Math.round(width / 1.3))
    for (let index = 0; index < arrangements; index += 1) {
      const flowers = placed(assets.models.flowers, { height: 0.4 })
      flowers.position.set(arrangements === 1 ? 0 : (index / (arrangements - 1) - 0.5) * (width - 1), TABLE_HEIGHT, 0)
      flowers.rotation.y = index * 1.7
      set.add(flowers)
    }
    group.add(set)
    set.updateMatrixWorld(true)

    seatsOf(table).forEach((seat, chair) => {
      const place = (position: T.Vector3, y: number) => {
        spot.position.set(position.x, y, position.z)
        spot.rotation.set(0, seat.turn, 0)
        spot.updateMatrix()
        return spot.matrix.clone().premultiply(set.matrixWorld)
      }
      chairs.set(next, place(seat.chair, 0), taken.has(`${table.id}:${chair}`) ? seatedTint : freeTint)
      settings.set(next, place(seat.setting, TABLE_HEIGHT + 0.005))
      // The glass stands above the knife: to the sitter's right and a little further in.
      const right = new T.Vector3(Math.cos(seat.turn), 0, -Math.sin(seat.turn)), inward = new T.Vector3(-Math.sin(seat.turn), 0, -Math.cos(seat.turn))
      glasses.set(next, place(seat.setting.clone().addScaledVector(right, 0.15).addScaledVector(inward, 0.17), TABLE_HEIGHT + 0.005))
      next += 1
    })

    const seated = assignments.filter(assignment => assignment.tableId === table.id).length
    const tag = label(table.label, `${seated} of ${table.chairs} seated`)
    tag.position.set(table.x * CM, 1.5, table.y * CM)
    labels.push(tag)
    group.add(tag)
  }
  for (const each of crowds) { each.finish(); group.add(each.group) }

  for (const block of blocks) {
    const stage = /stage|platform|band/i.test(block.label)
    const height = stage ? 0.3 : 0.02
    const material = new T.MeshStandardMaterial({ color: stage ? 0x6f5540 : 0x2f2622, roughness: stage ? 0.7 : 0.12, metalness: stage ? 0 : 0.35 })
    const slab = new T.Mesh(new T.BoxGeometry(block.width * CM, height, block.height * CM), material)
    slab.position.set(block.x * CM, height / 2 + 0.001, block.y * CM)
    slab.receiveShadow = true
    slab.castShadow = stage
    owned.push(material, slab.geometry)
    const tag = label(block.label, '')
    tag.position.set(block.x * CM, height + 0.9, block.y * CM)
    labels.push(tag)
    group.add(slab, tag)
  }

  return {
    group,
    showLabels(visible) { for (const tag of labels) tag.visible = visible },
    dispose() {
      for (const each of crowds) each.dispose()
      for (const item of owned) item.dispose()
      for (const tag of labels) { tag.material.map?.dispose(); tag.material.dispose() }
    },
  }
}
