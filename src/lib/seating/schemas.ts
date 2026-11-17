import { z } from 'zod'
import { FLOOR } from './geometry'
import { CHAIRS, ROTATION_STEP, TABLE_SHAPES } from './rules'

/** Everything the seat plan accepts from a browser is checked here first. */

const id = z.number().int().positive().max(999_999_999)
const coordinate = z.number().int().min(0).max(FLOOR.max)
const label = (what: string) => z.string().trim().min(1, `${what} needs a name.`).max(40, `${what} names can be up to 40 characters.`)
const chairs = z.number().int().min(CHAIRS.min, 'A table needs at least one chair.').max(CHAIRS.max, `A table can have up to ${CHAIRS.max} chairs.`)
const rotation = z.number().int().min(0).max(345).refine(value => value % ROTATION_STEP === 0, 'Tables turn in steps of 15 degrees.')
const shape = z.enum(TABLE_SHAPES)

export const tableCreateSchema = z.object({
  label: label('A table').optional(),
  shape: shape.default('round'),
  chairs: chairs.default(CHAIRS.start),
  x: coordinate,
  y: coordinate,
  rotation: rotation.default(0),
})

export const tableUpdateSchema = z.object({
  id,
  label: label('A table').optional(),
  shape: shape.optional(),
  chairs: chairs.optional(),
  x: coordinate.optional(),
  y: coordinate.optional(),
  rotation: rotation.optional(),
})

export const tableDeleteSchema = z.object({ id })

export const moveSchema = z.object({
  invitationId: id,
  index: z.number().int().min(0).max(19),
  target: z.object({ tableId: id, chair: z.number().int().min(0).max(CHAIRS.max - 1).optional() }).nullable(),
})

const floorShape = z.object({
  id: z.string().regex(/^[a-z0-9-]{4,40}$/),
  label: label('A shape'),
  x: coordinate,
  y: coordinate,
  width: z.number().int().min(40).max(2000),
  height: z.number().int().min(40).max(2000),
})

export const planSchema = z.object({
  published: z.boolean(),
  room: z.object({
    width: z.number().int().min(FLOOR.min).max(FLOOR.max),
    height: z.number().int().min(FLOOR.min).max(FLOOR.max),
  }),
  shapes: z.array(floorShape).max(30, 'The floor can hold up to 30 shapes.'),
})

export type TableCreateInput = z.infer<typeof tableCreateSchema>
export type TableUpdateInput = z.infer<typeof tableUpdateSchema>
export type MoveInput = z.infer<typeof moveSchema>
export type FloorShape = z.infer<typeof floorShape>
export type SeatingPlan = z.infer<typeof planSchema>

export const DEFAULT_PLAN: SeatingPlan = { published: false, room: { width: FLOOR.width, height: FLOOR.height }, shapes: [] }

/** Stored JSON is validated, never trusted: anything unreadable falls back to an empty, unpublished plan. */
export function parsePlan(raw: string | null | undefined): SeatingPlan {
  if (!raw) return DEFAULT_PLAN
  try {
    const parsed = planSchema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : DEFAULT_PLAN
  } catch {
    return DEFAULT_PLAN
  }
}
