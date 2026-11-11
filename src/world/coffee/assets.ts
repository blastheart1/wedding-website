import * as T from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'

const BASE = '/wedding/coffee'

/** Height and inside radius pairs, bottom to top: the shape a liquid takes inside a cup. */
export type Profile = readonly (readonly [number, number])[]

export interface Liquid {
  mesh: T.Mesh
  inside: Profile
  /** Heights of the liquid's top and bottom as modelled, in the model's own units. */
  top: number
  bottom: number
}

export interface Foam extends Liquid {
  /** Turns a point on the latte-art picture into a place on the foam: x = a·u + b·v + c, and the same for z. */
  uv: { x: readonly [number, number, number]; z: readonly [number, number, number] }
  radius: number
}

export interface CoffeeAssets {
  machine: T.Object3D
  portafilter: T.Object3D
  basketRadius: number
  /** How far below the basket rim the spouts end. */
  spoutDrop: number
  latteCup: T.Object3D
  foam: Foam
  espressoCup: T.Object3D
  espresso: Liquid
  pitcher: T.Object3D
  grinder: T.Object3D
}

function part<Kind extends T.Object3D>(root: T.Object3D, name: string): Kind {
  const found = root.getObjectByName(name)
  if (!found) throw new Error(`Coffee model is missing its "${name}" part`)
  return found as Kind
}

function shadows(root: T.Object3D): T.Object3D {
  root.traverse(object => {
    if ((object as T.Mesh).isMesh) { object.castShadow = true; object.receiveShadow = true }
  })
  return root
}

/** Loads the five models of the espresso scene. They are fetched only when the corner is peeled. */
export async function loadCoffeeAssets(): Promise<CoffeeAssets> {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
  const [machine, latteCup, espressoCup, pitcher, grinder] = await Promise.all(
    ['machine', 'latte-cup', 'espresso-cup', 'pitcher', 'grinder'].map(async name => shadows((await loader.loadAsync(`${BASE}/${name}.glb`)).scene)),
  )

  const portafilter = part(machine, 'Portafilter')
  const foamMesh = part<T.Mesh>(latteCup, 'Foam')
  const espressoMesh = part<T.Mesh>(espressoCup, 'Coffee')
  // Liquids take the light but should not throw shadows of their own onto the cup around them.
  foamMesh.castShadow = false
  espressoMesh.castShadow = false

  // The pitcher is modelled as plain white clay: finish it as brushed steel.
  const steel = new T.MeshStandardMaterial({ color: '#d9d6d0', metalness: 1, roughness: 0.36 })
  pitcher.traverse(object => {
    const mesh = object as T.Mesh
    if (!mesh.isMesh) return
    for (const old of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) old.dispose()
    mesh.material = steel
  })

  // The grinder's clear hopper makes its whole material see-through: let it still hide what is behind it.
  grinder.traverse(object => {
    const mesh = object as T.Mesh
    if (!mesh.isMesh) return
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.depthWrite = true
    mesh.renderOrder = 2
  })

  const foamData = foamMesh.userData as Omit<Foam, 'mesh'>
  const espressoData = espressoMesh.userData as Omit<Liquid, 'mesh'>
  const portafilterData = portafilter.userData as { basketRadius: number; spoutY: number }
  return {
    machine,
    portafilter,
    basketRadius: portafilterData.basketRadius,
    spoutDrop: -portafilterData.spoutY,
    latteCup,
    foam: { mesh: foamMesh, inside: foamData.inside, top: foamData.top, bottom: foamData.bottom, uv: foamData.uv, radius: foamData.radius },
    espressoCup,
    espresso: { mesh: espressoMesh, inside: espressoData.inside, top: espressoData.top, bottom: espressoData.bottom },
    pitcher,
    grinder,
  }
}

/** The inside radius of a cup at a height, read off its profile. */
export function radiusAt(profile: Profile, height: number): number {
  if (height <= profile[0][0]) return profile[0][1]
  for (let index = 1; index < profile.length; index++) {
    const [y, radius] = profile[index]
    if (height <= y) {
      const [lowY, lowRadius] = profile[index - 1]
      return lowRadius + (radius - lowRadius) * ((height - lowY) / (y - lowY || 1))
    }
  }
  return profile[profile.length - 1][1]
}

/**
 * Returns a function that sets a liquid's level inside its cup. The modelled
 * liquid is a full cup: it is flattened to a skin and narrowed to the cup's
 * inside radius at that height, so it never pokes through the wall.
 */
export function levelSetter(liquid: Liquid, skin: number): (height: number) => void {
  const { mesh } = liquid
  const home = mesh.position.clone(), size = mesh.scale.clone()
  const fullRadius = radiusAt(liquid.inside, liquid.top)
  return height => {
    const narrow = Math.min(1, radiusAt(liquid.inside, height) / fullRadius)
    mesh.scale.set(size.x * narrow, size.y * skin, size.z * narrow)
    mesh.position.set(home.x * narrow, height - (liquid.top - home.y) * skin, home.z * narrow)
  }
}
