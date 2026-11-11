import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, BufferAttribute, BufferGeometry, DoubleSide, MeshBasicMaterial, Vector3 } from 'three'

import { STAGES } from '@shared/balance'
import { THEMES } from '@shared/cities'
import { stageNear } from '@shared/world'

import { sfx } from '../../audio/sfx'
import { getQuality } from '../../store/quality'
import { runtime } from '../runtime'
import { skyUniforms } from '../skyState'
import { setStormOverlay } from './stormOverlay'

/**
 * The storm that hangs over the cities while your tornado tears through them: the lobby
 * is a clear day, but cross a bridge and the sky turns slate-grey, heavy clouds roll over
 * (Sky.jsx), the fog closes in (stageLook.js), the light dims (Lighting.jsx) and the screen's
 * edges darken. Every several seconds lightning strikes somewhere ahead of you: a jagged
 * bolt from the clouds to the ground, a flash that lights up the sky and everything under
 * it, and thunder rolling in after it - sooner and louder the closer it hit.
 *
 * Writes runtime.storm (level, flash) for the others to read. The bolt is one small mesh
 * (52 vertices), drawn only for the moment it flashes.
 */

const SEGMENTS = 12
const POINTS = SEGMENTS + 1
const TOP = 95
/** How stormy each city gets (the night ones less: they're dark already). */
const STORM_LEVEL = STAGES.map((s) => (THEMES[s.theme].night ? 0.45 : 0.85))

/** Two crossed ribbons, so the bolt shows from every side; shaped afresh by every strike. */
function createBolt() {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(POINTS * 4 * 3), 3))
  const index = []
  for (let ribbon = 0; ribbon < 2; ribbon += 1) {
    const base = ribbon * POINTS * 2
    for (let i = 0; i < SEGMENTS; i += 1) {
      const a = base + i * 2
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
  }
  geometry.setIndex(index)
  const material = new MeshBasicMaterial({
    color: '#e4ecff',
    transparent: true,
    opacity: 0,
    blending: AdditiveBlending,
    depthWrite: false,
    fog: false,
    side: DoubleSide,
    toneMapped: false,
  })
  return { geometry, material }
}

/** A fresh jagged bolt from the clouds down to (x, z). */
function shapeBolt(geometry, x, z) {
  const pos = geometry.attributes.position.array
  const sx = x + (Math.random() - 0.5) * 24
  const sz = z + (Math.random() - 0.5) * 24
  let jx = 0
  let jz = 0
  for (let i = 0; i < POINTS; i += 1) {
    const v = i / SEGMENTS
    const y = TOP * (1 - v)
    // Zig-zagging, pinned at the top and where it hits.
    if (i > 0 && i < SEGMENTS) {
      jx = jx * 0.4 + (Math.random() - 0.5) * 9
      jz = jz * 0.4 + (Math.random() - 0.5) * 9
    } else {
      jx = 0
      jz = 0
    }
    const cx = sx + (x - sx) * v + jx
    const cz = sz + (z - sz) * v + jz
    const w = 1.5 * (1 - 0.55 * v)
    const a = i * 2 * 3
    pos[a] = cx - w
    pos[a + 1] = y
    pos[a + 2] = cz
    pos[a + 3] = cx + w
    pos[a + 4] = y
    pos[a + 5] = cz
    const b = (POINTS * 2 + i * 2) * 3
    pos[b] = cx
    pos[b + 1] = y
    pos[b + 2] = cz - w
    pos[b + 3] = cx
    pos[b + 4] = y
    pos[b + 5] = cz + w
  }
  geometry.attributes.position.needsUpdate = true
}

const _dir = new Vector3()

/** A flash's brightness `e` seconds after the strike: a flash, a flicker, a second flash, fading. */
const flashAt = (e) => (e < 0 || e > 1.2 ? 0 : e < 0.06 ? 1 : e < 0.11 ? 0.2 : e < 0.17 ? 0.9 : 0.9 * Math.exp(-(e - 0.17) * 8))

export function Storm() {
  const camera = useThree((s) => s.camera)
  const boltRef = useRef(null)
  const strike = useRef({ at: -10, next: 6, power: 1 })
  const bolt = useMemo(() => createBolt(), [])

  useEffect(
    () => () => {
      bolt.geometry.dispose()
      bolt.material.dispose()
      runtime.storm.level = 0
      runtime.storm.flash = 0
      setStormOverlay(0, 0)
    },
    [bolt],
  )

  useFrame((state, rawDelta) => {
    const dt = Math.min(rawDelta, 0.1)
    const now = state.clock.elapsedTime
    const storm = runtime.storm
    const settings = getQuality()
    skyUniforms.time.value = now

    // --- How stormy: over the cities, darker the bigger your tornado ------------------
    const p = runtime.player.position
    const near = stageNear(p.z)
    const target = near >= 0 ? STORM_LEVEL[near] * (0.8 + 0.2 * Math.min(1, runtime.tornado.radius / 14)) : 0
    storm.level += (target - storm.level) * (1 - Math.exp(-0.7 * dt))

    // --- Lightning ---------------------------------------------------------------------
    const s = strike.current
    if (storm.strikeNow) {
      storm.strikeNow = false
      s.next = now
    }
    if (storm.level < 0.3) s.next = Math.max(s.next, now + 3)
    else if (now >= s.next) {
      s.at = now
      s.next = now + 5 + Math.random() * 9
      // Somewhere ahead of you, so you see it.
      camera.getWorldDirection(_dir)
      const angle = Math.atan2(_dir.z, _dir.x) + (Math.random() - 0.5) * 2.2
      const dist = 45 + Math.random() * 80
      const closeness = 1 - (dist - 45) / 80
      s.power = (0.55 + 0.45 * closeness) * Math.min(1, storm.level / 0.6)
      if (settings.lightningBolt && boltRef.current) shapeBolt(boltRef.current.geometry, p.x + Math.cos(angle) * dist, p.z + Math.sin(angle) * dist)
      setTimeout(() => sfx.thunder(closeness), (0.25 + dist / 180) * 1000)
    }
    const e = now - s.at
    storm.flash = flashAt(e) * s.power
    const mesh = boltRef.current
    if (mesh) {
      mesh.visible = settings.lightningBolt && e >= 0 && e < 0.4
      if (mesh.visible) mesh.material.opacity = Math.min(1, flashAt(e) * 1.3)
    }

    setStormOverlay(settings.stormVignette ? storm.level : 0, storm.flash * 0.5)
  })

  // Visible at first so the start-up shader warm-up compiles it; hidden from the first frame.
  return <mesh ref={boltRef} geometry={bolt.geometry} material={bolt.material} frustumCulled={false} renderOrder={5} />
}

export default Storm
