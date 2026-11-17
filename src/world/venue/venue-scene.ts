import * as T from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import type { Assignment, SeatingTable } from '@/lib/seating/rules'
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
  resize(width: number, height: number): void
  dispose(): void
}

function disposeTree(root: T.Object3D): void {
  root.traverse(object => {
    if (!(object instanceof T.Mesh)) return
    object.geometry.dispose()
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      (material as T.MeshStandardMaterial).map?.dispose()
      material.dispose()
    }
  })
}

/**
 * A view of the reception hall with the seat plan's tables inside. It draws
 * only when something changes (the camera moves, the plan changes, the canvas
 * is resized), so it costs nothing while it sits still.
 */
export function createVenueScene(canvas: HTMLCanvasElement, content: VenueContent): VenueScene {
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
  renderer.outputColorSpace = T.SRGBColorSpace
  renderer.toneMapping = T.NeutralToneMapping
  renderer.toneMappingExposure = 0.82
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = T.PCFShadowMap

  const scene = new T.Scene()
  scene.background = new T.Color(0xdbe8ee)
  scene.fog = new T.Fog(0xdbe8ee, 45, 140)
  const pmrem = new T.PMREMGenerator(renderer), studio = new RoomEnvironment()
  const environment = pmrem.fromScene(studio, 0.04)
  scene.environment = environment.texture
  scene.environmentIntensity = 0.4
  scene.add(new T.HemisphereLight(0xffffff, 0x8a9a78, 0.55))
  // Late-morning sun through the long wall of windows.
  const sun = new T.DirectionalLight(0xfff1dc, 2.2)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.bias = -0.0004
  sun.shadow.normalBias = 0.03
  scene.add(sun, sun.target)

  const camera = new T.PerspectiveCamera(48, 1, 0.1, 400)
  const controls = new OrbitControls(camera, canvas)
  controls.enableDamping = false
  controls.maxPolarAngle = Math.PI / 2 - 0.03
  controls.minDistance = 0.8
  controls.zoomToCursor = true

  let hall: T.Group | null = null
  let furniture: Furniture | null = null
  let size = { width: 0, length: 0 }
  let frame = 0
  let disposed = false
  const draw = () => { frame = 0; if (!disposed) renderer.render(scene, camera) }
  const requestDraw = () => { if (!frame && !disposed) frame = requestAnimationFrame(draw) }
  controls.addEventListener('change', requestDraw)

  const lookFrom = (viewpoint: Viewpoint) => {
    const { width, length } = size
    const span = Math.max(width, length)
    if (viewpoint === 'entrance') {
      camera.position.set(width / 2, 1.6, length - 0.5)
      controls.target.set(width / 2, 1.25, length / 2 - 1)
    } else if (viewpoint === 'head') {
      camera.position.set(width / 2, 1.6, 0.6)
      controls.target.set(width / 2, 1.2, length / 2 + 1)
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
      if (hall) { scene.remove(hall); disposeTree(hall) }
      size = { width, length }
      hall = buildHall(size)
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
    furniture = buildFurniture(next.tables, next.assignments, next.shapes)
    scene.add(furniture.group)
    requestDraw()
  }

  update(content)

  return {
    update,
    lookFrom,
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
      if (hall) disposeTree(hall)
      furniture?.dispose()
      environment.dispose()
      pmrem.dispose()
      studio.dispose()
      renderer.dispose()
    },
  }
}

/** The hall's ceiling heights, for anything that describes the room in words. */
export const HALL_HEIGHTS = { eave: HALL.eave, ridge: HALL.ridge } as const
