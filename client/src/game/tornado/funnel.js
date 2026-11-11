import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  InstancedBufferAttribute,
  InstancedMesh,
  NormalBlending,
  PlaneGeometry,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
} from 'three'

import { TORNADOES } from '@shared/balance'

/**
 * The tornado itself: a funnel of nested see-through shells, drawn entirely in a shader -
 * spiralling streaks, wind bands, specks of debris whirling up it, a soft fresnel edge -
 * swaying and leaning into the way it travels. No textures. Every tornado on screen is one
 * instance of one InstancedMesh (colours and sway per instance), so a full server of them
 * costs a single draw call; the swirling rings on the ground under each are a second.
 *
 * The geometry is a unit funnel (1 tall, radius 1 at the top); each instance's matrix
 * scales it to its tornado's radius and height.
 */

/** Radius of the funnel at height v (0 bottom .. 1 top), as a share of the top's. */
export const funnelProfile = (v) => 0.24 + 0.76 * Math.pow(v, 1.45)

/** `aLayer` of the debris cloud round the funnel's foot (the shells are 0, 1, 2...). */
const SKIRT = 5
/** How tall the debris cloud is, as a share of the funnel. */
const SKIRT_HEIGHT = 0.17

/**
 * The unit funnel: `layers` nested shells (each a little narrower, slower and fainter than
 * the one outside it), `segments` round and `rings` up, and with `skirt` the churning cloud
 * of dust and debris round its foot. `aLayer` tells the shader which shell a vertex is on;
 * uv.x runs round, uv.y up (up the skirt, for the skirt).
 */
export function createFunnelGeometry({ layers = 2, segments = 24, rings = 12, skirt = false } = {}) {
  const positions = []
  const uvs = []
  const layerIds = []
  const indices = []
  let base = 0
  for (let layer = 0; layer < layers; layer += 1) {
    const scale = 1 - layer * 0.22
    const height = 1 - layer * 0.06
    for (let j = 0; j <= rings; j += 1) {
      const v = j / rings
      const r = funnelProfile(v) * scale
      for (let i = 0; i <= segments; i += 1) {
        const a = (i / segments) * Math.PI * 2
        positions.push(Math.cos(a) * r, v * height, Math.sin(a) * r)
        uvs.push(i / segments, v)
        layerIds.push(layer)
      }
    }
    const row = segments + 1
    for (let j = 0; j < rings; j += 1) {
      for (let i = 0; i < segments; i += 1) {
        const a = base + j * row + i
        indices.push(a, a + row, a + 1, a + 1, a + row, a + row + 1)
      }
    }
    base += (rings + 1) * row
  }
  if (skirt) {
    // A low, wide dome of dust: widest at the ground, hugging the funnel at its top.
    const skirtRings = 5
    for (let j = 0; j <= skirtRings; j += 1) {
      const v = j / skirtRings
      const r = (0.78 - 0.44 * v * v) * (1 + 0.12 * Math.sin(Math.PI * v))
      for (let i = 0; i <= segments; i += 1) {
        const a = (i / segments) * Math.PI * 2
        positions.push(Math.cos(a) * r, v * SKIRT_HEIGHT, Math.sin(a) * r)
        uvs.push(i / segments, v)
        layerIds.push(SKIRT)
      }
    }
    const row = segments + 1
    for (let j = 0; j < skirtRings; j += 1) {
      for (let i = 0; i < segments; i += 1) {
        const a = base + j * row + i
        indices.push(a, a + row, a + 1, a + 1, a + row, a + row + 1)
      }
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3))
  g.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2))
  g.setAttribute('aLayer', new BufferAttribute(new Float32Array(layerIds), 1))
  g.setIndex(indices)
  g.computeBoundingSphere()
  return g
}

const NOISE = /* glsl */ `
  float tHash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  float tNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(tHash(i), tHash(i + vec2(1.0, 0.0)), u.x), mix(tHash(i + vec2(0.0, 1.0)), tHash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  // Value noise that wraps round every \`period\` in x: no seam where the funnel's uv closes.
  float tNoiseP(vec2 p, float period) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float x0 = mod(i.x, period);
    float x1 = mod(i.x + 1.0, period);
    return mix(mix(tHash(vec2(x0, i.y)), tHash(vec2(x1, i.y)), u.x), mix(tHash(vec2(x0, i.y + 1.0)), tHash(vec2(x1, i.y + 1.0)), u.x), u.y);
  }
  vec3 tHue(float h) {
    return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  }
`

/** The sun's side, flat (sceneStyle LIGHTS.sunDirection): the funnel is lit from it. */
const SUN_XZ = (() => {
  const l = Math.hypot(-0.4, -0.45)
  return `vec2(${(-0.4 / l).toFixed(4)}, ${(-0.45 / l).toFixed(4)})`
})()

const funnelVertex = /* glsl */ `
  attribute float aLayer;
  attribute vec3 iColorA;
  attribute vec3 iColorB;
  attribute vec3 iColorC;
  /** glow, rainbow, seed, opacity */
  attribute vec4 iParams;
  /** lean x, lean z (share of the radius the top leans over), spin speed, sway */
  attribute vec4 iMotion;
  uniform float uTime;
  varying vec2 vUv;
  varying float vLayer;
  varying vec3 vColA;
  varying vec3 vColB;
  varying vec3 vColC;
  varying vec4 vParams;
  varying float vRim;
  varying float vSpin;
  varying float vShade;
  #include <fog_pars_vertex>
  ${NOISE}
  void main() {
    vec3 p = position;
    float v = uv.y;
    float t = uTime + iParams.z * 17.0;
    float ang = uv.x * 6.2831853;
    bool skirt = aLayer > ${SKIRT - 0.5};
    // The funnel snakes about, more the higher up, and leans into its travel; the dust
    // cloud at its foot stays on the ground, billowing.
    float bend = skirt ? 0.0 : v * v;
    if (skirt) {
      float puff = tNoiseP(vec2(uv.x * 9.0 - t * iMotion.z * 9.0 * 0.8, v * 2.0 - t * 0.9), 9.0);
      p.xz *= 0.85 + 0.35 * puff;
      p.y *= 0.8 + 0.5 * puff;
    } else {
      // Bulges racing round it: the outline itself shows it spinning.
      float spinT = uTime * iMotion.z;
      float ripple = sin(ang * 3.0 - spinT * 11.0 + v * 7.0 + iParams.z * 6.0) * 0.065 + sin(ang * 5.0 - spinT * 23.0 - v * 11.0) * 0.035;
      p.xz *= 1.0 + ripple * (0.35 + v);
    }
    p.x += (sin(t * 1.3 + v * 3.1) * 0.13 * iMotion.w + iMotion.x) * bend;
    p.z += (cos(t * 1.1 + v * 2.7) * 0.13 * iMotion.w + iMotion.y) * bend;
    vec4 world = modelMatrix * instanceMatrix * vec4(p, 1.0);
    vec3 n = normalize(mat3(modelMatrix * instanceMatrix) * vec3(position.x, 0.0, position.z) + vec3(0.0, 1e-4, 0.0));
    vec3 toEye = normalize(cameraPosition - world.xyz);
    vRim = 1.0 - abs(dot(n, toEye));
    // Lit from the sun's side, in shadow on the other: a solid, round, turning column.
    vShade = 0.66 + 0.5 * (0.5 + 0.5 * dot(normalize(n.xz + vec2(1e-4)), ${SUN_XZ}));
    vUv = uv;
    vLayer = aLayer;
    vColA = iColorA;
    vColB = iColorB;
    vColC = iColorC;
    vParams = iParams;
    vSpin = iMotion.z;
    vec4 mvPosition = viewMatrix * world;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`

const funnelFragment = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  varying float vLayer;
  varying vec3 vColA;
  varying vec3 vColB;
  varying vec3 vColC;
  varying vec4 vParams;
  varying float vRim;
  varying float vSpin;
  varying float vShade;
  #include <fog_pars_fragment>
  ${NOISE}
  void main() {
    float v = vUv.y;
    float a = vUv.x;
    float t = uTime + vParams.z * 7.0;
    if (vLayer > ${SKIRT - 0.5}) {
      // The debris cloud: churning brown-grey dust swept round, thick low down, thinning to nothing at its top.
      float turnS = t * 0.8 * vSpin;
      vec2 q = vec2((a - turnS) * 10.0, v * 2.6 - t * 1.0);
      float n = tNoiseP(q, 10.0) * 0.6 + tNoiseP(q * vec2(2.0, 2.0) + vec2(0.0, 1.7), 20.0) * 0.4;
      vec3 dust = mix(vec3(0.36, 0.32, 0.27), vColB * 0.55, 0.3) * (0.7 + 0.55 * n) * vShade;
      float alpha = smoothstep(0.25, 0.7, n) * 0.8 * (1.0 - smoothstep(0.45, 1.0, v)) * smoothstep(0.0, 0.1, v) * (0.55 + 0.45 * vRim);
      gl_FragColor = vec4(dust, alpha * vParams.w);
      #include <colorspace_fragment>
      #include <fog_fragment>
      return;
    }
    // Every shell turns about once a second (the inner ones faster), its streaks swept
    // round and climbing in a spiral.
    float turn = t * (0.8 + vLayer * 0.35) * vSpin;
    vec2 q = vec2((a + v * 0.35 - turn) * 8.0, v * 3.2 - t * 0.9);
    float n = tNoiseP(q, 8.0) * 0.6 + tNoiseP(q * vec2(2.0, 2.3) + vec2(0.0, 3.7), 16.0) * 0.4;
    float streak = smoothstep(0.34, 0.8, n);
    // Bright wind sheets wrapping round it in a spiral, sweeping round with it.
    float bands = smoothstep(0.62, 1.0, 0.5 + 0.5 * sin((a - turn) * 12.5663706 + v * 16.0 - t * 1.5));
    vec3 col = mix(vColB, vColA, clamp(streak * 0.8 + v * 0.25 + bands * 0.35, 0.0, 1.0));
    if (vParams.y > 0.5) col = mix(col, tHue(fract(a + v * 0.6 - uTime * 0.25)), 0.55);
    // Debris whirling round and up inside it: little chips, faster than the wind.
    vec2 cp = vec2((a - turn * 1.4) * 48.0, v * 26.0 - t * 2.2);
    vec2 cell = vec2(mod(floor(cp.x), 48.0), floor(cp.y));
    vec2 fc = fract(cp) - 0.5;
    float speck = step(0.955, tHash(cell + vLayer * 13.1)) * step(abs(fc.x), 0.34) * step(abs(fc.y), 0.3);
    speck *= smoothstep(0.02, 0.2, v) * (1.0 - smoothstep(0.75, 0.95, v));
    col = mix(col, vColC * 0.85, speck);
    // Denser than glass: a soft core, a solid edge.
    float alpha = (0.36 + 0.5 * streak + 0.25 * bands) * (0.55 + 0.45 * vRim);
    alpha += speck * 0.8;
    // Soft at the very bottom, fading out at the top into the clouds.
    alpha *= smoothstep(0.0, 0.04, v) * (1.0 - smoothstep(0.84, 1.0, v));
    alpha *= vParams.w * (1.0 - vLayer * 0.14);
    // Lit on the sun's side, a touch darker low down and in the folds, glowing types glowing.
    vec3 shade = col * vShade * (0.8 + 0.28 * v + 0.18 * streak) + col * vParams.x * (0.35 + 0.5 * streak);
    shade += vec3(0.1) * pow(vRim, 3.0) * (1.0 - streak * 0.5);
    gl_FragColor = vec4(shade, clamp(alpha, 0.0, 0.95));
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`

const ringVertex = /* glsl */ `
  attribute vec3 iColorA;
  attribute vec4 iParams;
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vCol;
  varying vec4 vParams;
  #include <fog_pars_vertex>
  void main() {
    vUv = uv;
    vCol = iColorA;
    vParams = iParams;
    vec4 mvPosition = viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`

/** Rings rippling out from the funnel's foot, and dust swirling round it. */
const ringFragment = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vCol;
  varying vec4 vParams;
  #include <fog_pars_fragment>
  ${NOISE}
  void main() {
    vec2 c = vUv - 0.5;
    float d = length(c) * 2.0;
    if (d > 1.0) discard;
    float t = uTime * 0.55 + vParams.z * 5.0;
    float rings = 0.0;
    for (int i = 0; i < 3; i++) {
      float r = fract(t + float(i) / 3.0);
      float w = 0.025 + 0.02 * r;
      rings += (1.0 - smoothstep(0.0, w, abs(d - (0.18 + r * 0.82)))) * (1.0 - r);
    }
    float ang = atan(c.y, c.x);
    float dust = tNoiseP(vec2(ang * 0.9549297 - uTime * 3.0 - d * 4.0, d * 6.0 - uTime), 6.0) * (1.0 - smoothstep(0.15, 0.6, d)) * smoothstep(0.05, 0.2, d);
    float alpha = rings * 0.95 + dust * 0.55;
    vec3 col = mix(vCol, vec3(1.0), 0.45) + vCol * vParams.x * 0.4;
    gl_FragColor = vec4(col, alpha * vParams.w);
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`

const uTime = { value: 0 }
/** The shared clock every tornado shader reads (advance once a frame). */
export const tornadoTime = uTime

function makeMaterial(vertexShader, fragmentShader, side) {
  const m = new ShaderMaterial({
    uniforms: UniformsUtils.merge([UniformsLib.fog, { uTime: { value: 0 } }]),
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    side,
    blending: NormalBlending,
    fog: true,
  })
  m.uniforms.uTime = uTime
  return m
}

/** Adds the per-instance attributes the tornado shaders read. */
function addInstanceAttributes(geometry, max) {
  geometry.setAttribute('iColorA', new InstancedBufferAttribute(new Float32Array(max * 3), 3))
  geometry.setAttribute('iColorB', new InstancedBufferAttribute(new Float32Array(max * 3), 3))
  geometry.setAttribute('iColorC', new InstancedBufferAttribute(new Float32Array(max * 3), 3))
  geometry.setAttribute('iParams', new InstancedBufferAttribute(new Float32Array(max * 4), 4))
  geometry.setAttribute('iMotion', new InstancedBufferAttribute(new Float32Array(max * 4), 4))
}

/** Up to `max` funnels: an InstancedMesh, empty to start with. */
export function createFunnelMesh(max, detail) {
  const geometry = createFunnelGeometry(detail)
  addInstanceAttributes(geometry, max)
  const mesh = new InstancedMesh(geometry, makeMaterial(funnelVertex, funnelFragment, DoubleSide), max)
  mesh.count = 0
  mesh.frustumCulled = false
  mesh.renderOrder = 2
  return mesh
}

/** Up to `max` sets of ground rings. */
export function createRingMesh(max) {
  const geometry = new PlaneGeometry(1, 1)
  geometry.rotateX(-Math.PI / 2)
  addInstanceAttributes(geometry, max)
  const mesh = new InstancedMesh(geometry, makeMaterial(ringVertex, ringFragment, DoubleSide), max)
  mesh.count = 0
  mesh.frustumCulled = false
  mesh.renderOrder = 1
  return mesh
}

export function disposeTornadoMesh(mesh) {
  mesh.geometry.dispose()
  mesh.material.dispose()
  mesh.dispose()
}

/** Each tornado type's colours, parsed once: [outer, inner, specks] Colors. */
export const TORNADO_COLORS = Object.fromEntries(TORNADOES.map((t) => [t.id, t.colors.map((c) => new Color(c))]))
const TYPE_BY_ID = Object.fromEntries(TORNADOES.map((t) => [t.id, t]))

/**
 * Writes instance `i` of a funnel or ring mesh's tornado attributes: its type's colours
 * and glow, `seed` (so no two sway in step), `opacity`, the lean and the spin.
 */
export function writeTornado(mesh, i, typeId, seed, opacity = 1, leanX = 0, leanZ = 0, spin = 1, sway = 1) {
  const g = mesh.geometry
  const colors = TORNADO_COLORS[typeId] ?? TORNADO_COLORS.breeze
  const type = TYPE_BY_ID[typeId] ?? TORNADOES[0]
  const a = g.attributes
  colors[0].toArray(a.iColorA.array, i * 3)
  colors[1].toArray(a.iColorB.array, i * 3)
  colors[2].toArray(a.iColorC.array, i * 3)
  const p = a.iParams.array
  p[i * 4] = type.glow
  p[i * 4 + 1] = type.rainbow ? 1 : 0
  p[i * 4 + 2] = seed
  p[i * 4 + 3] = opacity
  const m = a.iMotion.array
  m[i * 4] = leanX
  m[i * 4 + 1] = leanZ
  m[i * 4 + 2] = spin
  m[i * 4 + 3] = sway
}

/** Marks every tornado attribute of `mesh` for upload this frame. */
export function flushTornadoAttributes(mesh) {
  const a = mesh.geometry.attributes
  a.iColorA.needsUpdate = true
  a.iColorB.needsUpdate = true
  a.iColorC.needsUpdate = true
  a.iParams.needsUpdate = true
  a.iMotion.needsUpdate = true
}
