import * as T from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { GRINDER, GROUP, LATTE, RECIPE, TIMELINE, artProgress, blondingAt, cameraAt, doseAt, flowAt, smooth, yieldAt } from '@/lib/espresso'
import { levelSetter, loadCoffeeAssets, radiusAt } from './assets'
import { POUR_END, POUR_START, pourableFoam } from './foam-material'

const COLORS = {
  paper: '#f7eee4',
  grounds: '#3d2516',
  espressoDark: '#2f1a0e',
  espressoBlond: '#c08a4c',
  milk: '#fffaf1',
} as const

/** The counter the machine's feet stand on, and the top of its drip tray. */
const COUNTER = LATTE[1]
const TRAY = -0.128
/** Sizes of the cups and pitcher next to the machine. */
const ESPRESSO_CUP_SIZE = 0.105
const LATTE_CUP_SIZE = 1.5
const PITCHER_SIZE = 1.3
/** The pitcher is held from the far right, over the part of the cup the milk has not reached yet. */
const PITCHER_TURN = 1.0
/** The pitcher's pouring lip, in the model's own units. */
const PITCHER_LIP = new T.Vector3(-0.057, 0.106, 0)
/** The grinder's size, and (in its own units) how far its feet are below its origin, where its fork holds a basket, and where grounds leave the chute. */
const GRINDER_SIZE = 0.4
const GRINDER_FEET = 1
const GRINDER_FORK = new T.Vector3(0, 0.16, 0.9)
const GRINDER_CHUTE_ABOVE_FORK = 0.09
/** Where the portafilter rests while it is dosed, and how it is turned on the way into the group head. */
const DOSING = new T.Vector3(GRINDER[0] + GRINDER_FORK.x * GRINDER_SIZE, GRINDER[1] + (GRINDER_FEET + GRINDER_FORK.y) * GRINDER_SIZE, GRINDER[2] + GRINDER_FORK.z * GRINDER_SIZE)
const DOSING_TURN = 0
const INSERT_TURN = -0.8
/** Half the gap between the two spouts. */
const SPOUT_GAP = 0.058
/** The screen keeps words at the top and controls at the bottom: the picture is fitted into what is left. */
const CLEAR_HEIGHT = 0.5
const HEADROOM = 0

export interface EspressoScene {
  /** Moves every part of the scene to its place at this moment of the animation. `shotGrams` is what this shot ends at. */
  setTime(time: number, shotGrams?: number): void
  resize(width: number, height: number): void
  render(): void
  dispose(): void
}

function liquidStream(material: T.Material): T.Mesh {
  // A unit-tall strand, a little thinner at the bottom, scaled to the fall it has to cover.
  const mesh = new T.Mesh(new T.CylinderGeometry(1, 0.6, 1, 10, 1, true), material)
  mesh.visible = false
  return mesh
}

/** Stretches a strand of liquid between two heights at one spot. */
function fall(stream: T.Mesh, x: number, top: number, bottom: number, z: number, width: number): void {
  const length = Math.max(0.001, top - bottom)
  stream.scale.set(width, length, width)
  stream.position.set(x, bottom + length / 2, z)
}

/**
 * The espresso easter egg: a real machine pulling one shot, then a rosetta
 * poured in milk. Everything is positioned from the time alone, so the scene
 * can be paused, replayed or jumped to any moment.
 */
export async function createEspressoScene(canvas: HTMLCanvasElement): Promise<EspressoScene> {
  const assets = await loadCoffeeAssets()

  const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' })
  renderer.outputColorSpace = T.SRGBColorSpace
  // Neutral mapping keeps the creams and whites clean instead of greying them.
  renderer.toneMapping = T.NeutralToneMapping
  renderer.toneMappingExposure = 1.05
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = T.PCFShadowMap
  renderer.debug.checkShaderErrors = process.env.NODE_ENV !== 'production'

  const scene = new T.Scene()
  scene.background = new T.Color(COLORS.paper)
  const camera = new T.PerspectiveCamera(30, 1, 0.05, 60)

  // Soft studio light for the steel to reflect, and one warm lamp for shadows.
  const studio = new RoomEnvironment(), pmrem = new T.PMREMGenerator(renderer)
  const environment = pmrem.fromScene(studio, 0.04)
  studio.dispose(); pmrem.dispose()
  scene.environment = environment.texture
  scene.environmentIntensity = 0.85
  const lamp = new T.DirectionalLight('#fff1df', 1.6)
  lamp.position.set(2.2, 4, 3)
  lamp.castShadow = true
  lamp.shadow.mapSize.set(1024, 1024)
  lamp.shadow.camera.left = -2.2; lamp.shadow.camera.right = 2.2; lamp.shadow.camera.top = 2.2; lamp.shadow.camera.bottom = -2.2
  lamp.shadow.camera.near = 1; lamp.shadow.camera.far = 10
  lamp.shadow.radius = 4
  lamp.shadow.bias = -0.0008
  lamp.shadow.normalBias = 0.01
  scene.add(lamp)

  // The counter is the paper itself: only the shadows that fall on it are drawn.
  const counter = new T.Mesh(new T.PlaneGeometry(40, 40), new T.ShadowMaterial({ color: '#5a3d2c', opacity: 0.22 }))
  counter.rotation.x = -Math.PI / 2
  counter.position.y = COUNTER
  counter.receiveShadow = true
  scene.add(counter)

  // ── Grinder, to the right of the machine ──
  const grinder = new T.Group()
  grinder.position.set(GRINDER[0], GRINDER[1] + GRINDER_FEET * GRINDER_SIZE, GRINDER[2])
  grinder.scale.setScalar(GRINDER_SIZE)
  grinder.add(assets.grinder)
  scene.add(grinder)
  counter.renderOrder = 1

  // ── Machine and its centre portafilter ──
  scene.add(assets.machine)
  const { portafilter } = assets
  const locked = portafilter.position.clone()
  const grounds = new T.Mesh(new T.CircleGeometry(assets.basketRadius * 0.8, 36), new T.MeshStandardMaterial({ color: COLORS.grounds, roughness: 1 }))
  grounds.rotation.x = -Math.PI / 2
  grounds.position.y = 0.004
  portafilter.add(grounds)
  const groundsFalling = liquidStream(new T.MeshStandardMaterial({ color: COLORS.grounds, roughness: 1 }))
  scene.add(groundsFalling)

  // ── Espresso cup on the drip tray ──
  const cupRig = new T.Group()
  assets.espressoCup.scale.setScalar(ESPRESSO_CUP_SIZE)
  // The cup's handle is modelled pointing away: turn it to the front right.
  assets.espressoCup.rotation.y = -Math.PI * 0.75
  assets.espressoCup.position.y = -new T.Box3().setFromObject(assets.espressoCup).min.y
  cupRig.add(assets.espressoCup)
  scene.add(cupRig)
  const cupHome = new T.Vector3(GROUP[0], TRAY, GROUP[2])
  const setEspressoLevel = levelSetter(assets.espresso, 0.04)
  const espressoMaterial = assets.espresso.mesh.material as T.MeshStandardMaterial
  espressoMaterial.color.set('#e2b384')
  const espressoDepth = assets.espresso.top - assets.espresso.bottom
  const cupLip = new T.Vector3(-radiusAt(assets.espresso.inside, assets.espresso.top) * ESPRESSO_CUP_SIZE, assets.espresso.top * ESPRESSO_CUP_SIZE, 0)

  // ── Espresso: two strands and the first drops ──
  const espressoMaterialStream = new T.MeshStandardMaterial({ color: COLORS.espressoDark, roughness: 0.2 })
  const streams = [-1, 1].map(side => {
    const stream = liquidStream(espressoMaterialStream)
    stream.userData.side = side
    scene.add(stream)
    return stream
  })
  const drops = [0, 1, 2, 3].map(index => {
    const drop = new T.Mesh(new T.SphereGeometry(0.006, 10, 8), espressoMaterialStream)
    drop.userData.side = index % 2 === 0 ? -1 : 1
    scene.add(drop)
    return drop
  })
  const carriedPour = liquidStream(espressoMaterialStream)
  scene.add(carriedPour)

  // ── The cup waiting for milk ──
  const latte = new T.Group()
  latte.position.set(LATTE[0], LATTE[1], LATTE[2])
  latte.scale.setScalar(LATTE_CUP_SIZE)
  // Turned so the rosetta reads upright from the front: its wide leaves nearest, its tip furthest.
  latte.rotation.y = -Math.PI * 0.14
  latte.add(assets.latteCup)
  scene.add(latte)
  const setFoamLevel = levelSetter(assets.foam, 0.2)
  const foam = pourableFoam(assets.foam.mesh.material as T.MeshStandardMaterial)
  const espressoTint = new T.Color('#8a5a36'), noTint = new T.Color(1, 1, 1)
  const foamLow = assets.foam.inside[0][0] + 0.02

  // ── Milk pitcher, held by its pouring lip ──
  const pitcher = new T.Group()
  assets.pitcher.scale.setScalar(PITCHER_SIZE)
  assets.pitcher.position.copy(PITCHER_LIP).multiplyScalar(-PITCHER_SIZE)
  pitcher.add(assets.pitcher)
  const pitcherHand = new T.Group()
  pitcherHand.rotation.y = PITCHER_TURN
  pitcherHand.add(pitcher)
  scene.add(pitcherHand)
  const milk = liquidStream(new T.MeshStandardMaterial({ color: COLORS.milk, roughness: 0.35 }))
  scene.add(milk)

  const dark = new T.Color(COLORS.espressoDark), blond = new T.Color(COLORS.espressoBlond)
  const pourSpot = new T.Vector3(), lip = new T.Vector3(), aim = new T.Vector3(), stand = new T.Vector3()
  let aspect = 1

  /** A place on the latte-art picture, as a point in the room at the foam's surface. */
  function onFoam(u: number, v: number, height: number, into: T.Vector3): T.Vector3 {
    const { x, z } = assets.foam.uv
    return latte.localToWorld(into.set(x[0] * u + x[1] * v + x[2], height, z[0] * u + z[1] * v + z[2]))
  }

  function setTime(time: number, shotGrams: number = RECIPE.yieldGrams) {
    // Dose: grounds fall into the basket. Lock: the portafilter goes up into the group head and twists home.
    const dosed = doseAt(time) / RECIPE.doseGrams
    grounds.scale.setScalar(0.25 + dosed * 0.75)
    const travel = smooth((time - TIMELINE.doseEnd) / (TIMELINE.shotStart - TIMELINE.doseEnd - 0.55))
    const twist = smooth((time - (TIMELINE.shotStart - 0.6)) / 0.5)
    portafilter.position.lerpVectors(DOSING, locked, travel)
    portafilter.position.y -= 0.06 * Math.sin(Math.min(1, travel * 1.1) * Math.PI * 0.5) * (1 - twist)
    // It swings out in front of the machine on the way over from the grinder.
    portafilter.position.z += Math.sin(travel * Math.PI) * 0.75
    portafilter.rotation.y = DOSING_TURN + (INSERT_TURN - DOSING_TURN) * travel - INSERT_TURN * twist
    const grinding = time > 0.12 && dosed < 0.985
    groundsFalling.visible = grinding
    fall(groundsFalling, DOSING.x, DOSING.y + GRINDER_CHUTE_ABOVE_FORK, DOSING.y, DOSING.z, 0.007 + Math.sin(time * 31) * 0.0015)
    // The grinder hums while it runs.
    grinder.rotation.z = grinding ? Math.sin(time * 95) * 0.004 : 0

    // Shot: drops, then two strands that lighten as it runs. The espresso rises in the cup.
    const flow = flowAt(time, shotGrams), blonding = blondingAt(time)
    espressoMaterialStream.color.copy(dark).lerp(blond, smooth(blonding * 1.15))
    const carry = smooth((time - (TIMELINE.shotEnd + 0.1)) / 0.7)
    const tip = smooth((time - (TIMELINE.shotEnd + 0.7)) / 0.45)
    const emptied = smooth((time - (TIMELINE.shotEnd + 1.0)) / 0.45)
    const away = smooth((time - (TIMELINE.shotEnd + 1.4)) / 0.45)
    const filled = (yieldAt(time, shotGrams) / RECIPE.yieldGrams) * (1 - emptied)
    // A shot that ran far too fast fills the cup to the brim, and no further.
    const level = assets.espresso.bottom + espressoDepth * Math.min(0.9, 0.1 + filled * 0.5)
    setEspressoLevel(level)
    assets.espresso.mesh.visible = filled > 0.01
    const liquidTop = cupHome.y + assets.espressoCup.position.y + level * ESPRESSO_CUP_SIZE
    const spoutY = locked.y - assets.spoutDrop
    for (const stream of streams) {
      stream.visible = flow > 0.12 && carry === 0
      const strand = 0.0035 + flow * 0.0045 * (1 + Math.sin(time * 23 + stream.userData.side) * 0.08)
      fall(stream, locked.x + stream.userData.side * SPOUT_GAP, spoutY, liquidTop, locked.z, strand)
    }
    drops.forEach((drop, index) => {
      // Drops fall while the stream is still too weak to hold together: at the start and the end.
      drop.visible = flow > 0 && flow <= 0.5 && carry === 0
      const dropped = (time * 2.6 + index * 0.27) % 1
      drop.position.set(locked.x + drop.userData.side * SPOUT_GAP, spoutY - dropped * dropped * (spoutY - liquidTop), locked.z)
    })

    // The shot is carried to the larger cup, tipped in, and the empty cup set down beside it.
    const lifted = Math.sin(carry * Math.PI * 0.5) * (1 - away)
    cupRig.position.set(
      cupHome.x + (LATTE[0] + 0.09 - cupHome.x) * carry + away * 0.42,
      cupHome.y + (COUNTER + 0.42 - cupHome.y) * lifted + (COUNTER - cupHome.y) * away,
      cupHome.z + (LATTE[2] - cupHome.z) * carry + away * 0.16,
    )
    cupRig.rotation.z = tip * 1.75 * (1 - away)
    // Foam: first the espresso lands in the cup, then the milk lifts it to the rim as the rosetta is laid down.
    const art = artProgress(time)
    const rise = smooth(art / 0.82)
    const laid = smooth((art - 0.34) / 0.62)
    const foamHeight = foamLow + (assets.foam.top - foamLow) * (0.12 * emptied + 0.88 * rise)
    setFoamLevel(foamHeight)
    assets.foam.mesh.visible = emptied > 0.03
    foam.setReveal(laid)
    foam.tint.copy(espressoTint).lerp(noTint, smooth(art / 0.4))

    cupRig.updateMatrixWorld()
    carriedPour.visible = tip > 0.6 && emptied < 0.97
    if (carriedPour.visible) {
      cupRig.localToWorld(lip.copy(cupLip))
      fall(carriedPour, lip.x, lip.y, COUNTER + foamHeight * LATTE_CUP_SIZE, lip.z, 0.007)
    }

    // Milk: the pitcher comes in high to fill, drops close to draw, and wiggles from the first leaf to the last.
    const arrive = smooth((time - (TIMELINE.artStart - 0.7)) / 0.8)
    const leave = smooth((time - (TIMELINE.artEnd - 0.25)) / 0.7)
    const pouring = art > 0.02 && art < 0.985
    const wiggle = pouring ? Math.sin(time * 15) * 0.05 * laid * (1 - laid) * 4 : 0
    const u = 0.5 + (POUR_START[0] + (POUR_END[0] - POUR_START[0]) * laid - 0.5) * smooth(art / 0.34) + wiggle * 0.8
    const v = 0.5 + (POUR_START[1] + (POUR_END[1] - POUR_START[1]) * laid - 0.5) * smooth(art / 0.34) + wiggle * 0.6
    latte.updateMatrixWorld()
    onFoam(u, v, foamHeight, pourSpot)
    const hover = 0.26 - 0.19 * smooth((art - 0.2) / 0.25) + (1 - arrive) * 0.35 + leave * 0.45
    pitcherHand.visible = arrive > 0.01 && leave < 0.99
    pitcherHand.position.set(pourSpot.x + (1 - arrive + leave) * 0.9, pourSpot.y + hover, pourSpot.z - (1 - arrive + leave) * 0.9)
    pitcher.rotation.z = arrive * (1 - leave) * (0.75 + 0.35 * rise)
    milk.visible = pouring
    if (pouring) fall(milk, pourSpot.x, pitcherHand.position.y, pourSpot.y, pourSpot.z, 0.0075 * (0.75 + 0.25 * Math.sin(time * 9)))

    // Camera: stand far enough back that the shot's subject fits this screen, whatever its shape.
    const shot = cameraAt(time)
    const reach = 2 * Math.tan(T.MathUtils.degToRad(camera.fov / 2))
    const distance = Math.max(shot.span / (reach * aspect), shot.rise / (reach * CLEAR_HEIGHT))
    aim.set(shot.target[0], shot.target[1], shot.target[2])
    stand.set(shot.from[0], shot.from[1], shot.from[2]).normalize().multiplyScalar(distance).add(aim)
    camera.position.copy(stand)
    camera.lookAt(aim)
    // Slide the frame up a touch, so the subject sits clear of the words at the top.
    camera.translateY(HEADROOM * distance * reach)
  }

  // Build every shader before the first frame is shown, so the story starts without a hitch.
  setTime(0)
  await renderer.compileAsync(scene, camera)

  return {
    setTime,
    resize(width, height) {
      aspect = width / Math.max(1, height)
      camera.aspect = aspect
      camera.updateProjectionMatrix()
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
      renderer.setSize(width, height, false)
    },
    render() {
      renderer.render(scene, camera)
    },
    dispose() {
      scene.traverse(object => {
        const mesh = object as T.Mesh
        mesh.geometry?.dispose()
        for (const material of Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : []) {
          for (const value of Object.values(material)) if (value instanceof T.Texture) value.dispose()
          material.dispose()
        }
      })
      environment.dispose()
      renderer.dispose()
    },
  }
}
