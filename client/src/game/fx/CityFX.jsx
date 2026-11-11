import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, DoubleSide, RingGeometry, ShaderMaterial, Vector3 } from 'three'

import { STAGES } from '@shared/balance'
import { KINDS, stageLayout } from '@shared/cities'
import { surgeReach, tearTime } from '@shared/logic'
import { stageAt } from '@shared/world'

import { sfx } from '../../audio/sfx'
import { getGame } from '../../store/game'
import { contact, contactProgress, onCity } from '../city/cityState'
import { runtime } from '../runtime'
import { burst } from './fxQueue'
import { placeProgress, PROGRESS_POOL_SIZE } from './progressBars'

const _v = new Vector3()
/** How high over a big thing its bar floats. */
const BAR_HEIGHT = { huge: 8, trophy: 5, landmark: 12 }
/** Things that take at least this long to tear up (s) get a bar showing how far along you are. */
const BAR_MIN_TIME = 1

/** The sound and the jolt of something torn apart: bigger things, a deeper crunch and a harder shake. */
const SMASH = { tiny: 0, small: 1, medium: 2, large: 3, huge: 4, trophy: 4, landmark: 5 }
const SHAKE = { tiny: 0, small: 0.03, medium: 0.07, large: 0.14, huge: 0.3, trophy: 0.3, landmark: 0.5 }
function onShatter(o) {
  sfx.smash(SMASH[o.size] ?? 1)
  runtime.camera.shake = Math.max(runtime.camera.shake, SHAKE[o.size] ?? 0)
}

/** Something straining in your funnel: it groans and cracks, and the bigger it is, the more the ground shakes. */
function onTear(o, progress) {
  sfx.tear(progress)
  runtime.camera.shake = Math.max(runtime.camera.shake, (SHAKE[o.size] ?? 0.1) * (0.3 + progress))
}

function onBigBroken(o) {
  const big = o.size === 'landmark'
  runtime.camera.shake = Math.max(runtime.camera.shake, big ? 1.4 : o.size === 'trophy' ? 0.6 : 0.3)
  burst({ x: o.x, y: big ? 12 : 5, z: o.z, count: big ? 70 : 30, palette: o.wins > 0 ? 'gold' : 'confetti', speed: big ? 12 : 8 })
  if (big) sfx.landmarkBreak()
  else if (o.size === 'trophy') sfx.trophyBreak()
}

const ringVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`
const ringFragment = /* glsl */ `
  uniform float uFade;
  varying vec2 vUv;
  void main() {
    gl_FragColor = vec4(1.0, 0.95, 0.75, uFade * (0.4 + 0.6 * vUv.x));
  }
`

/**
 * What the cities do on screen besides themselves: the crunch and jolt of everything you
 * tear apart, the groans and cracks of things straining in your funnel, a bar over each
 * that takes a while showing how far along it is, the camera's jolt and a shower of gold when a trophy or landmark
 * breaks, and your Surge's shockwave racing out across the ground.
 */
export function CityFX() {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const waveRef = useRef(null)

  const wave = useMemo(() => {
    const geometry = new RingGeometry(0.86, 1, 64, 1)
    geometry.rotateX(-Math.PI / 2)
    const material = new ShaderMaterial({
      uniforms: { uFade: { value: 0 } },
      vertexShader: ringVertex,
      fragmentShader: ringFragment,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
    })
    return { geometry, material }
  }, [])

  useEffect(() => {
    const off = [onCity('bigBroken', onBigBroken), onCity('shatter', onShatter), onCity('tear', onTear)]
    return () => {
      for (const f of off) f()
      wave.geometry.dispose()
      wave.material.dispose()
    }
  }, [wave])

  useFrame(() => {
    // --- The bars over big things being torn up ---------------------------------------
    const p = runtime.player.position
    const stage = stageAt(p.x, p.z)
    let slot = 0
    if (stage >= 0 && contact.size) {
      const layout = stageLayout(stage)
      const { profile } = getGame()
      for (const [id] of contact) {
        if (slot >= PROGRESS_POOL_SIZE) break
        if (Math.floor(id / 1000) !== stage) continue
        const o = layout.objects[id % 1000]
        if (tearTime(profile, o) < BAR_MIN_TIME) continue
        _v.set(o.x, BAR_HEIGHT[o.size] ?? 3 + o.r * 1.2, o.z).project(camera)
        if (_v.z > 1) continue
        const name = o.size === 'landmark' ? STAGES[stage].landmark.name : o.size === 'trophy' ? 'Giant Trophy' : KINDS[o.kind]?.name ?? 'Tearing up'
        // Kept clear of the header at the top and the level bar at the bottom.
        const y = Math.min(size.height * 0.68, Math.max(size.height * 0.3, (-_v.y * 0.5 + 0.5) * size.height))
        placeProgress(slot, name, contactProgress(o), (_v.x * 0.5 + 0.5) * size.width, y)
        slot += 1
      }
    }
    for (let i = slot; i < PROGRESS_POOL_SIZE; i += 1) placeProgress(i, null)

    // --- The Surge's shockwave --------------------------------------------------------
    const mesh = waveRef.current
    if (mesh) {
      const t = (performance.now() - runtime.tornado.surgeAt) / 650
      mesh.visible = t >= 0 && t < 1
      if (mesh.visible) {
        const reach = runtime.tornado.radius * surgeReach(getGame().profile)
        const r = reach * (0.2 + 0.8 * (1 - (1 - t) * (1 - t)))
        mesh.position.set(p.x, 0.4, p.z)
        mesh.scale.set(r, 1, r)
        mesh.material.uniforms.uFade.value = 1 - t
      }
    }
  })

  return <mesh ref={waveRef} geometry={wave.geometry} material={wave.material} visible={false} renderOrder={4} />
}

export default CityFX
