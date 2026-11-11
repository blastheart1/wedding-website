import * as T from 'three'

/** Where on the latte-art picture the pour begins and ends (texture coordinates). */
export const POUR_START: readonly [number, number] = [0.68, 0.27]
export const POUR_END: readonly [number, number] = [0.32, 0.78]

export interface FoamControls {
  /** 0: plain crema. 1: the whole rosetta is on the surface. */
  setReveal(amount: number): void
  /** Darkens the surface: espresso before the milk goes in. */
  tint: T.Color
}

/**
 * Makes the cup's photographed latte art appear the way it is poured: the
 * milk shows up behind a front that travels from the first leaf to the last.
 * Ahead of the front the same picture is shown with its milk painted out.
 */
export function pourableFoam(material: T.MeshStandardMaterial): FoamControls {
  const axis = new T.Vector2(POUR_END[0] - POUR_START[0], POUR_END[1] - POUR_START[1])
  axis.divideScalar(axis.lengthSq())
  const uniforms = {
    uReveal: { value: 0 },
    uTint: { value: new T.Color(1, 1, 1) },
    uCrema: { value: new T.Color('#dd9755') },
    uStart: { value: new T.Vector2(POUR_START[0], POUR_START[1]) },
    uAxis: { value: axis },
  }
  material.metalness = 0
  material.roughness = 0.55
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uReveal;\nuniform vec3 uTint;\nuniform vec3 uCrema;\nuniform vec2 uStart;\nuniform vec2 uAxis;')
      .replace('#include <map_fragment>', `#include <map_fragment>
      {
        vec2 fromStart = vMapUv - uStart;
        float along = dot(fromStart, uAxis);
        float across = dot(fromStart, vec2(-uAxis.y, uAxis.x));
        float front = mix(-0.55, 1.45, uReveal) + sin(across * 52.0) * 0.03;
        float shown = 1.0 - smoothstep(front - 0.08, front + 0.08, along);
        // Milk is told from crema by how much blue it carries, which holds in the picture's shaded parts too.
        float milk = smoothstep(0.17, 0.3, diffuseColor.b / max(diffuseColor.r, 0.001));
        vec3 plain = mix(diffuseColor.rgb, uCrema, milk);
        diffuseColor.rgb = mix(plain, diffuseColor.rgb, shown) * uTint;
      }`)
  }
  material.needsUpdate = true
  return { setReveal(amount) { uniforms.uReveal.value = amount }, tint: uniforms.uTint.value }
}
