import { useFrame } from '@react-three/fiber'
import { lazy, Suspense, useEffect, useMemo } from 'react'
import { AdditiveBlending, DoubleSide, PlaneGeometry, ShaderMaterial } from 'three'

import { BRIDGE_HALF, gateZ, STAGE_COUNT } from '@shared/world'

import { useGame } from '../../store/game'
import { tornadoTime } from '../tornado/funnel'
import { updateCity } from './cityState'

// Each city is built by its own chunk, fetched only when one comes near: nothing of the
// cities is in the start-up bundle.
const CityStage = lazy(() => import('./CityStage'))

const barrierVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
/** A shimmering wall of hexes across the closed gate. */
const barrierFragment = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    vec2 p = vUv * vec2(14.0, 10.0);
    vec2 h = vec2(p.x + 0.5 * mod(floor(p.y), 2.0), p.y);
    vec2 f = abs(fract(h) - 0.5);
    float edge = smoothstep(0.38, 0.5, max(f.x, f.y));
    float wave = 0.5 + 0.5 * sin(vUv.y * 18.0 - uTime * 3.0 + vUv.x * 4.0);
    float fade = smoothstep(0.0, 0.15, vUv.y) * (1.0 - smoothstep(0.85, 1.0, vUv.y));
    vec3 col = mix(vec3(1.0, 0.25, 0.35), vec3(1.0, 0.75, 0.3), wave);
    gl_FragColor = vec4(col, (0.12 + edge * 0.55 + wave * 0.08) * fade);
  }
`

/** The first closed gate: a force field across it, until your level opens it. */
function GateBarrier({ index }) {
  const mesh = useMemo(() => {
    const material = new ShaderMaterial({
      uniforms: { uTime: tornadoTime },
      vertexShader: barrierVertex,
      fragmentShader: barrierFragment,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
    })
    return { geometry: new PlaneGeometry(BRIDGE_HALF * 2 + 1.5, 12), material }
  }, [])
  useEffect(
    () => () => {
      mesh.geometry.dispose()
      mesh.material.dispose()
    },
    [mesh],
  )
  return <mesh geometry={mesh.geometry} material={mesh.material} position={[0, 6, gateZ(index) + 0.4]} renderOrder={3} />
}

/**
 * Which cities exist right now: the one you're in or heading to, and its neighbours
 * (on every preset: the one you've just left behind stays in view when you look back). Each is a lazily loaded CityStage, built when it comes near
 * and disposed when it's left behind. Also runs the cities' per-frame life (cityState:
 * what your funnel is swallowing, what's coming back).
 */
export function StageManager() {
  const near = useGame((s) => s.zone.near)
  const unlocked = useGame((s) => s.profile.unlocked)

  const shown = useMemo(() => {
    const base = Math.max(0, near)
    const from = near < 0 ? 0 : Math.max(0, base - 1)
    const to = Math.min(STAGE_COUNT - 1, base + 1)
    const list = []
    for (let i = from; i <= to; i += 1) list.push(i)
    return list
  }, [near])

  useFrame((_state, delta) => {
    updateCity(performance.now(), Math.min(delta, 0.05))
  })

  const locked = unlocked + 1
  return (
    <>
      <Suspense fallback={null}>
        {shown.map((i) => (
          <CityStage key={i} index={i} />
        ))}
      </Suspense>
      {locked < STAGE_COUNT && shown.includes(locked) && <GateBarrier index={locked} />}
    </>
  )
}

export default StageManager
