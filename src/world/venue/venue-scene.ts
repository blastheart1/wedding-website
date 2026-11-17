import * as T from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import type { Assignment, SeatingTable } from '@/lib/seating/rules'
import { loadVenueAssets } from './assets'
import { buildFurniture, type FloorBlock, type Furniture } from './furniture'
import { buildHall, HALL } from './hall'

export type Viewpoint = 'overview' | 'entrance' | 'head'

export interface VenueContent {
  /** Hall size in plan units (centimetres). */
  room: { width: number; height: number }
  tables: readonly SeatingTable[]
  assignments: readonly Assignment[]
  shapes: readonly FloorBlock[]
}

export interface VenueScene {
  /** Rebuilds what has changed: the hall when its size changes, the furniture always. */
  update(content: VenueContent): void
  lookFrom(viewpoint: Viewpoint): void
  showLabels(visible: boolean): void
  resize(width: number, height: number): void
  dispose(): void
}

/** Frees what a built hall made for itself. The shared models and scans it was dressed with are left alone. */
function disposeHall(root: T.Object3D, shared: ReadonlySet<T.BufferGeometry>): void {
  root.traverse(object => {
    if (!(object instanceof T.Mesh)) return
    if (!shared.has(object.geometry)) object.geometry.dispose()
  })
}

/**
 * A view of the reception hall with the seat plan's tables inside, lit by a
 * real sky. It draws only when something changes (the camera moves, the plan
 * changes, the canvas is resized), so it costs nothing while it sits still.
 */
export async function createVenueScene(canvas: HTMLCanvasElement, content: VenueContent): Promise<VenueScene> {
  const assets = await loadVenueAssets()
  const sharedGeometry = new Set<T.BufferGeometry>()
  for (const model of Object.values(assets.models)) model.traverse(object => { if (object instanceof T.Mesh) sharedGeometry.add(object.geometry) })

  const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
  renderer.outputColorSpace = T.SRGBColorSpace
  renderer.toneMapping = T.ACESFilmicToneMapping
  renderer.toneMappingExposure = 0.9
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = T.PCFShadowMap

  const scene = new T.Scene()
  // The park sky is both what is seen outside and what lights the room.
  scene.background = assets.sky
  scene.backgroundBlurriness = 0.06
  scene.environment = assets.sky
  scene.environmentIntensity = 0.9
  // Light bounced up off the pale floor: without it the underside of the roof would sit in darkness.
  scene.add(new T.HemisphereLight(0xffffff, 0xe4dccb, 0.85))
  // Sun through the long wall of windows, for the shadows a room really has.
  const sun = new T.DirectionalLight(0xfff0d8, 2.4)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.bias = -0.0004
  sun.shadow.normalBias = 0.03
  scene.add(sun, sun.target)

  const camera = new T.PerspectiveCamera(48, 1, 0.1, 600)
  const controls = new OrbitControls(camera, canvas)
  controls.enableDamping = false
  controls.maxPolarAngle = Math.PI / 2 - 0.03
  controls.minDistance = 0.8
  controls.zoomToCursor = true

  let hall: T.Group | null = null
  let furniture: Furniture | null = null
  let size = { width: 0, length: 0 }
  let labels = true
  let frame = 0
  let disposed = false
  const draw = () => { frame = 0; if (!disposed) renderer.render(scene, camera) }
  const requestDraw = () => { if (!frame && !disposed) frame = requestAnimationFrame(draw) }
  controls.addEventListener('change', requestDraw)

  const lookFrom = (viewpoint: Viewpoint) => {
    const { width, length } = size
    const span = Math.max(width, length)
    if (viewpoint === 'entrance') {
      // Standing just inside the door at eye height, looking down the room.
      camera.position.set(width / 2, 1.62, length - 0.6)
      controls.target.set(width / 2, 1.2, length / 2 - 1)
    } else if (viewpoint === 'head') {
      // Seated at the head table, looking back toward the door.
      camera.position.set(width / 2 - 0.4, 1.25, 1.0)
      controls.target.set(width / 2, 1.05, length / 2 + 1)
    } else {
      camera.position.set(width / 2 + span * 0.62, span * 0.82, length + span * 0.38)
      controls.target.set(width / 2, 0.6, length / 2)
    }
    controls.maxDistance = span * 4
    controls.update()
    requestDraw()
  }

  const update = (next: VenueContent) => {
    const width = next.room.width / 100, length = next.room.height / 100
    if (!hall || width !== size.width || length !== size.length) {
      if (hall) { scene.remove(hall); disposeHall(hall, sharedGeometry) }
      size = { width, length }
      hall = buildHall(size, assets)
      scene.add(hall)
      const span = Math.max(width, length)
      sun.position.set(width / 2 - span * 1.1, span * 1.25, length / 2 + span * 0.35)
      sun.target.position.set(width / 2, 0, length / 2)
      const reach = span * 0.85
      Object.assign(sun.shadow.camera, { left: -reach, right: reach, top: reach, bottom: -reach, near: 1, far: span * 4 })
      sun.shadow.camera.updateProjectionMatrix()
      lookFrom('overview')
    }
    if (furniture) { scene.remove(furniture.group); furniture.dispose() }
    furniture = buildFurniture(assets, next.tables, next.assignments, next.shapes)
    furniture.showLabels(labels)
    scene.add(furniture.group)
    requestDraw()
  }

  update(content)

  return {
    update,
    lookFrom,
    showLabels(visible) { labels = visible; furniture?.showLabels(visible); requestDraw() },
    resize(width, height) {
      renderer.setSize(width, height, false)
      camera.aspect = width / Math.max(1, height)
      camera.updateProjectionMatrix()
      requestDraw()
    },
    dispose() {
      disposed = true
      if (frame) cancelAnimationFrame(frame)
      controls.removeEventListener('change', requestDraw)
      controls.dispose()
      if (hall) disposeHall(hall, sharedGeometry)
      furniture?.dispose()
      assets.dispose()
      renderer.dispose()
    },
  }
}

/** The hall's ceiling heights, for anything that describes the room in words. */
export const HALL_HEIGHTS = { eave: HALL.eave, ridge: HALL.ridge } as const
