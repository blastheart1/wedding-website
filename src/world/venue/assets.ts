import * as T from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'

/**
 * The real models, scanned materials and sky the hall is dressed with.
 * Everything lives in public/wedding/venue and is fetched only when the
 * 3D hall is opened. Sources and licences are listed in the project notes.
 */

const BASE = '/wedding/venue/'

const MODELS = [
  'chair', 'round-table', 'long-cloth', 'place-setting', 'wine-glass', 'flowers', 'aircon',
  'chandelier', 'wall-lantern', 'fire-extinguisher', 'potted-plant', 'fern', 'shrub',
] as const
export type ModelName = (typeof MODELS)[number]

const SURFACES = ['floor', 'wall', 'roof', 'drive'] as const
export type SurfaceName = (typeof SURFACES)[number]

const TREES = ['tree-island-tree-01', 'tree-island-tree-02', 'tree-island-tree-03', 'tree-jacaranda-tree', 'tree-tree-small-02'] as const

export interface Surface { colour: T.Texture; normal: T.Texture; roughness: T.Texture }

export interface VenueAssets {
  models: Record<ModelName, T.Object3D>
  surfaces: Record<SurfaceName, Surface>
  trees: T.Texture[]
  /** The park sky: lights the hall and is seen through the glass. */
  sky: T.Texture
  dispose(): void
}

export async function loadVenueAssets(): Promise<VenueAssets> {
  const gltf = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
  const images = new T.TextureLoader()
  const picture = async (file: string, colour: boolean, tiled: boolean): Promise<T.Texture> => {
    const texture = await images.loadAsync(BASE + file)
    if (colour) texture.colorSpace = T.SRGBColorSpace
    if (tiled) texture.wrapS = texture.wrapT = T.RepeatWrapping
    texture.anisotropy = 8
    return texture
  }
  const [models, surfaces, trees, sky] = await Promise.all([
    Promise.all(MODELS.map(async name => [name, (await gltf.loadAsync(`${BASE}${name}.glb`)).scene] as const)),
    Promise.all(SURFACES.map(async name => [name, {
      colour: await picture(`${name}_diff.webp`, true, true),
      normal: await picture(`${name}_nor.webp`, false, true),
      roughness: await picture(`${name}_rough.webp`, false, true),
    }] as const)),
    Promise.all(TREES.map(name => picture(`${name}.webp`, true, false))),
    new HDRLoader().loadAsync(BASE + 'sky.hdr'),
  ])
  sky.mapping = T.EquirectangularReflectionMapping
  const loaded: VenueAssets = {
    models: Object.fromEntries(models) as unknown as Record<ModelName, T.Object3D>,
    surfaces: Object.fromEntries(surfaces) as unknown as Record<SurfaceName, Surface>,
    trees,
    sky,
    dispose() {
      for (const model of Object.values(loaded.models)) disposeObject(model)
      for (const surface of Object.values(loaded.surfaces)) { surface.colour.dispose(); surface.normal.dispose(); surface.roughness.dispose() }
      for (const tree of trees) tree.dispose()
      sky.dispose()
    },
  }
  return loaded
}

export function disposeObject(root: T.Object3D): void {
  root.traverse(object => {
    if (!(object instanceof T.Mesh)) return
    object.geometry.dispose()
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      for (const value of Object.values(material)) if (value instanceof T.Texture) value.dispose()
      material.dispose()
    }
  })
}

/**
 * A material using one of the scanned surfaces, repeated `repeatX` by `repeatY` times.
 * With `painted`, only the scan's relief and sheen are used and the colour is the paint's own:
 * for surfaces that are painted or polished to one even colour in the real hall.
 */
export function surfaceMaterial(surface: Surface, repeatX: number, repeatY: number, options: T.MeshStandardMaterialParameters = {}, painted = false): T.MeshStandardMaterial {
  const tile = (texture: T.Texture) => { const copy = texture.clone(); copy.repeat.set(repeatX, repeatY); copy.needsUpdate = true; return copy }
  return new T.MeshStandardMaterial({ ...(painted ? {} : { map: tile(surface.colour) }), normalMap: tile(surface.normal), roughnessMap: tile(surface.roughness), ...options })
}

export interface Fit {
  /** Scale the model so it is this tall, wide (x) or deep (z), in metres. Unset sides follow in proportion. */
  height?: number
  width?: number
  depth?: number
  /** Quarter turns and the like, applied before measuring: radians about the vertical axis. */
  turn?: number
  /** Tip the model up from lying on its back or side: radians about x. */
  tip?: number
}

/**
 * A copy of a model standing on the floor at the origin: turned as asked,
 * scaled to real size, centred, and with shadows on. Models come from many
 * authors in many units, so each is measured rather than trusted.
 */
export function placed(source: T.Object3D, fit: Fit): T.Group {
  const model = source.clone(true)
  const turned = new T.Group()
  turned.add(model)
  model.rotation.set(fit.tip ?? 0, fit.turn ?? 0, 0)
  turned.updateMatrixWorld(true)
  const box = new T.Box3().setFromObject(turned), size = box.getSize(new T.Vector3())
  const scaleX = fit.width !== undefined ? fit.width / size.x : undefined
  const scaleY = fit.height !== undefined ? fit.height / size.y : undefined
  const scaleZ = fit.depth !== undefined ? fit.depth / size.z : undefined
  const even = scaleY ?? scaleX ?? scaleZ ?? 1
  const scale = new T.Vector3(scaleX ?? even, scaleY ?? even, scaleZ ?? even)
  const centre = box.getCenter(new T.Vector3())
  // Stand it on the floor, centred. The offset is measured after the turn, so it goes on the turned group.
  turned.position.set(-centre.x, -box.min.y, -centre.z)
  const wrapper = new T.Group()
  wrapper.add(turned)
  wrapper.scale.copy(scale)
  wrapper.traverse(object => { if (object instanceof T.Mesh) { object.castShadow = true; object.receiveShadow = true } })
  return wrapper
}

export interface Crowd {
  group: T.Group
  /** Places copy number `index` using a world matrix, optionally tinted. */
  set(index: number, matrix: T.Matrix4, tint?: T.Color): void
  finish(): void
  /** Frees what this crowd made itself. The shared model it was copied from is left alone. */
  dispose(): void
}

/**
 * Many copies of one model drawn in a handful of calls: each of its meshes
 * becomes one instanced mesh with the model's own placement baked in.
 */
export function crowd(model: T.Object3D, count: number, restyle?: (material: T.MeshStandardMaterial, name: string) => void): Crowd {
  const group = new T.Group()
  model.updateMatrixWorld(true)
  const parts: T.InstancedMesh[] = []
  model.traverse(object => {
    if (!(object instanceof T.Mesh)) return
    const geometry = object.geometry.clone().applyMatrix4(object.matrixWorld)
    const material = (Array.isArray(object.material) ? object.material[0] : object.material).clone() as T.MeshStandardMaterial
    restyle?.(material, material.name)
    const part = new T.InstancedMesh(geometry, material, Math.max(1, count))
    part.count = count
    part.castShadow = true
    part.receiveShadow = true
    parts.push(part)
    group.add(part)
  })
  return {
    group,
    set(index, matrix, tint) { for (const part of parts) { part.setMatrixAt(index, matrix); if (tint) part.setColorAt(index, tint) } },
    finish() { for (const part of parts) { part.instanceMatrix.needsUpdate = true; if (part.instanceColor) part.instanceColor.needsUpdate = true } },
    dispose() { for (const part of parts) { part.geometry.dispose(); (part.material as T.Material).dispose() } },
  }
}
