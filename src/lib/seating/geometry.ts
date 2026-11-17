import type { TableShape } from './rules'

/**
 * Where things sit on the floor. Everything is in floor units (one unit is one
 * CSS pixel at 100% zoom). Shared by the planner and by the guest's small map.
 */

export const FLOOR = { width: 1600, height: 1000, min: 600, max: 4000, grid: 10 } as const

/** A chair is drawn as a name pill; pills never overlap at this spacing. */
export const CHAIR = { width: 74, height: 22, spacing: 80 } as const

export interface Point { x: number; y: number }
export interface Box { width: number; height: number }

const ROUND_MIN_RING = 84
const ROUND_INSET = 44
const SIDE_GAP = 16
const END_GAP = 42

const perSide = (shape: TableShape, chairs: number): number =>
  shape === 'couple' ? chairs : shape === 'rect' ? Math.ceil(chairs / 2) : Math.ceil(chairs / 4)

const ringRadius = (chairs: number): number => Math.max(ROUND_MIN_RING, (chairs * CHAIR.spacing) / (2 * Math.PI))

/** The table top itself, before rotation. A round table's box is its diameter both ways. */
export function tableBox(shape: TableShape, chairs: number): Box {
  if (shape === 'round') {
    const diameter = Math.round((ringRadius(chairs) - ROUND_INSET) * 2)
    return { width: diameter, height: diameter }
  }
  const length = Math.max(shape === 'square' ? 96 : 120, perSide(shape, chairs) * CHAIR.spacing + 8)
  if (shape === 'square') return { width: length, height: length }
  return { width: length, height: shape === 'couple' ? 54 : 62 }
}

/** Evenly spaced positions along a side of the given length, centred on zero. */
const along = (count: number, length: number): number[] =>
  Array.from({ length: count }, (_unused, index) => ((index + 0.5) / count) * length - length / 2)

function squareSides(chairs: number): [number, number, number, number] {
  // Filled in the order top, bottom, right, left so a small table stays balanced.
  const base = Math.floor(chairs / 4)
  const extra = chairs % 4
  return [base + (extra > 0 ? 1 : 0), base + (extra > 2 ? 1 : 0), base + (extra > 1 ? 1 : 0), base]
}

function unrotated(shape: TableShape, chairs: number): Point[] {
  const box = tableBox(shape, chairs)
  if (shape === 'round') {
    const radius = ringRadius(chairs)
    return Array.from({ length: chairs }, (_unused, index) => {
      const angle = (index / chairs) * 2 * Math.PI - Math.PI / 2
      return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius }
    })
  }
  const above = -(box.height / 2 + SIDE_GAP)
  if (shape === 'couple') return along(chairs, box.width).map(x => ({ x, y: above }))
  if (shape === 'rect') {
    const top = Math.ceil(chairs / 2)
    return [
      ...along(top, box.width).map(x => ({ x, y: above })),
      ...along(chairs - top, box.width).map(x => ({ x, y: -above })),
    ]
  }
  // Square: numbered clockwise from the top left.
  const [top, right, bottom, left] = squareSides(chairs)
  const beside = box.width / 2 + END_GAP
  return [
    ...along(top, box.width).map(x => ({ x, y: above })),
    ...along(right, box.height).map(y => ({ x: beside, y })),
    ...along(bottom, box.width).reverse().map(x => ({ x, y: -above })),
    ...along(left, box.height).reverse().map(y => ({ x: -beside, y })),
  ]
}

export function rotatePoint(point: Point, degrees: number): Point {
  const angle = (degrees * Math.PI) / 180
  const cos = Math.cos(angle), sin = Math.sin(angle)
  return { x: point.x * cos - point.y * sin, y: point.x * sin + point.y * cos }
}

/** The centre of each chair relative to the table's centre, chair 0 first. */
export function chairPoints(shape: TableShape, chairs: number, rotation = 0): Point[] {
  return unrotated(shape, chairs).map(point => {
    const turned = rotatePoint(point, rotation)
    return { x: Math.round(turned.x * 10) / 10, y: Math.round(turned.y * 10) / 10 }
  })
}

/** How far the table and its chairs reach from its centre: used to keep tables inside the room. */
export function tableReach(shape: TableShape, chairs: number): number {
  const box = tableBox(shape, chairs)
  const corner = shape === 'round' ? box.width / 2 : Math.hypot(box.width / 2, box.height / 2)
  const farthestChair = Math.max(...unrotated(shape, chairs).map(point => Math.hypot(point.x, point.y)), 0) + CHAIR.width / 2
  return Math.ceil(Math.max(corner, farthestChair))
}

export const snap = (value: number): number => Math.round(value / FLOOR.grid) * FLOOR.grid

export const clamp = (value: number, low: number, high: number): number => Math.min(high, Math.max(low, value))
