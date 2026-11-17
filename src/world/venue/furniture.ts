import * as T from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { chairPoints, tableBox } from '@/lib/seating/geometry'
import type { Assignment, SeatingTable } from '@/lib/seating/rules'

/**
 * The tables, chairs and floor shapes of the seat plan, in 3D. The plan is
 * drawn at one unit per centimetre, so positions and sizes are simply divided
 * by 100. The plan's y axis becomes depth (z).
 */

const CM = 0.01
const TABLE_HEIGHT = 0.75

export interface FloorBlock { label: string; x: number; y: number; width: number; height: number }

/** A simple banquet chair: seat, four legs, and a slatted back. One geometry, so every chair is drawn in a single call. */
function chairGeometry(): T.BufferGeometry {
  const part = (width: number, height: number, depth: number, x: number, y: number, z: number) => new T.BoxGeometry(width, height, depth).translate(x, y, z)
  const parts = [part(0.4, 0.04, 0.4, 0, 0.45, 0), part(0.4, 0.05, 0.03, 0, 0.9, 0.19), part(0.36, 0.03, 0.02, 0, 0.74, 0.19), part(0.36, 0.03, 0.02, 0, 0.6, 0.19)]
  for (const x of [-0.18, 0.18]) {
    parts.push(part(0.03, 0.45, 0.03, x, 0.225, -0.18), part(0.03, 0.92, 0.03, x, 0.46, 0.185))
  }
  return mergeGeometries(parts) ?? parts[0]
}

/** Which way a chair faces, in the table's own unturned frame: toward the centre of a round table, square on to the edge of any other. */
function facing(table: SeatingTable, point: { x: number; y: number }): number {
  const box = tableBox(table.shape, table.chairs)
  if (table.shape === 'round') return Math.atan2(-point.x, -point.y)
  if (table.shape === 'square' && Math.abs(point.y) <= box.height / 2) return point.x > 0 ? -Math.PI / 2 : Math.PI / 2
  return point.y > 0 ? Math.PI : 0
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
  // Drawn at the same size on screen however near or far, so a label is always readable and never fills the view.
  const sprite = new T.Sprite(new T.SpriteMaterial({ map: texture, depthWrite: false, depthTest: false, sizeAttenuation: false }))
  // Labels are drawn last and over everything, so a rafter or a wall never hides a table's name.
  sprite.renderOrder = 10
  sprite.scale.set(0.15, 0.047, 1)
  return sprite
}

function centrepiece(length: number): T.Group {
  const group = new T.Group()
  const green = new T.MeshStandardMaterial({ color: 0x5c8a55, roughness: 1, flatShading: true })
  const wax = new T.MeshStandardMaterial({ color: 0xfff7e6, emissive: 0xffc27a, emissiveIntensity: 0.9, roughness: 0.6 })
  const count = Math.max(1, Math.round(length / 0.9))
  for (let index = 0; index < count; index += 1) {
    const x = count === 1 ? 0 : (index / (count - 1) - 0.5) * (length - 0.8)
    const leaves = new T.Mesh(new T.IcosahedronGeometry(0.13, 1), green)
    leaves.position.set(x, TABLE_HEIGHT + 0.15, 0)
    leaves.scale.set(1.25, 0.8, 1.25)
    const candle = new T.Mesh(new T.CylinderGeometry(0.025, 0.025, 0.22, 8), wax)
    candle.position.set(x + 0.26, TABLE_HEIGHT + 0.11, 0.05)
    leaves.castShadow = true
    group.add(leaves, candle)
  }
  return group
}

export interface Furniture {
  group: T.Group
  dispose: () => void
}

export function buildFurniture(tables: readonly SeatingTable[], assignments: readonly Assignment[], blocks: readonly FloorBlock[]): Furniture {
  const group = new T.Group()
  const linen = new T.MeshStandardMaterial({ color: 0xf8f5ef, roughness: 0.95 })
  const total = tables.reduce((sum, table) => sum + table.chairs, 0)
  const chairs = new T.InstancedMesh(chairGeometry(), new T.MeshStandardMaterial({ roughness: 0.55, metalness: 0.1 }), Math.max(1, total))
  chairs.count = total
  chairs.castShadow = true
  const taken = new Set(assignments.map(assignment => `${assignment.tableId}:${assignment.chair}`))
  // Taken chairs are walnut; free ones are pale, so gaps at a table show at a glance.
  const filled = new T.Color(0x7c5a3a), empty = new T.Color(0xe4ddcf)
  const place = new T.Object3D()
  let next = 0

  for (const table of tables) {
    const box = tableBox(table.shape, table.chairs)
    const set = new T.Group()
    set.position.set(table.x * CM, 0, table.y * CM)
    // A clockwise turn on the plan is a turn the other way about the vertical axis here.
    set.rotation.y = (-table.rotation * Math.PI) / 180
    const top = table.shape === 'round'
      ? new T.Mesh(new T.CylinderGeometry((box.width * CM) / 2, (box.width * CM) / 2 + 0.05, TABLE_HEIGHT, 48), linen)
      : new T.Mesh(new T.BoxGeometry(box.width * CM, TABLE_HEIGHT, box.height * CM), linen)
    top.position.y = TABLE_HEIGHT / 2
    top.castShadow = true
    top.receiveShadow = true
    set.add(top, centrepiece(table.shape === 'round' || table.shape === 'square' ? 0.6 : box.width * CM))
    group.add(set)
    set.updateMatrixWorld(true)

    chairPoints(table.shape, table.chairs, 0).forEach((point, chair) => {
      // The plan leaves room for a name on each chair; real chairs tuck in closer to the table.
      const pull = table.shape === 'round' ? ((box.width / 2 + 38) / Math.hypot(point.x, point.y)) : 1
      const depth = table.shape === 'round' ? point.y * pull : Math.sign(point.y) * (box.height / 2 + 34)
      const across = table.shape === 'square' && Math.abs(point.y) <= box.height / 2 ? Math.sign(point.x) * (box.width / 2 + 34) : point.x * pull
      place.position.set(across * CM, 0, (table.shape === 'square' && Math.abs(point.y) <= box.height / 2 ? point.y : depth) * CM)
      place.rotation.set(0, facing(table, point), 0)
      place.scale.setScalar(1)
      place.updateMatrix()
      place.matrix.premultiply(set.matrixWorld)
      chairs.setMatrixAt(next, place.matrix)
      chairs.setColorAt(next, taken.has(`${table.id}:${chair}`) ? filled : empty)
      next += 1
    })

    const seated = assignments.filter(assignment => assignment.tableId === table.id).length
    const tag = label(table.label, `${seated} of ${table.chairs} seated`)
    tag.position.set(table.x * CM, 1.45, table.y * CM)
    group.add(tag)
  }
  chairs.instanceMatrix.needsUpdate = true
  if (chairs.instanceColor) chairs.instanceColor.needsUpdate = true
  group.add(chairs)

  for (const block of blocks) {
    const stage = /stage|platform|band/i.test(block.label)
    const height = stage ? 0.3 : 0.02
    const slab = new T.Mesh(
      new T.BoxGeometry(block.width * CM, height, block.height * CM),
      new T.MeshStandardMaterial({ color: stage ? 0x8a6a4a : 0x3a2e28, roughness: stage ? 0.7 : 0.15, metalness: stage ? 0 : 0.3 }),
    )
    slab.position.set(block.x * CM, height / 2 + 0.001, block.y * CM)
    slab.receiveShadow = true
    slab.castShadow = stage
    const tag = label(block.label, '')
    tag.position.set(block.x * CM, height + 0.9, block.y * CM)
    group.add(slab, tag)
  }

  const dispose = () => {
    group.traverse(object => {
      if (object instanceof T.Mesh || object instanceof T.Sprite) {
        object.geometry?.dispose()
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          (material as T.SpriteMaterial).map?.dispose()
          material.dispose()
        }
      }
    })
  }
  return { group, dispose }
}
