import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Matrix4, Quaternion, Vector3 } from 'three'

import { TUTORIAL } from '@shared/balance'
import { stageLayout } from '@shared/cities'
import { gateZ, LOBBY, PAD_X, padCenterZ, TORNADO_STANDS } from '@shared/world'

import { getGame } from '../../store/game'
import { createToyInstances, PropBuilder } from '../blocks'
import { isPresent } from '../city/cityState'
import { sharedMaterials, STYLE } from '../materials'
import { runtime } from '../runtime'

const MAX_CHEVRONS = 16
const SPACING = 3
/** Stop drawing arrows this close to the goal. */
const ARRIVED = 3.5

/** The nearest thing still standing in the first city, looked up a few times a second. */
const near = { at: 0, x: 0, z: 0, found: false }
function nearestStanding(p) {
  const now = performance.now()
  if (now - near.at > 400) {
    near.at = now
    near.found = false
    let best = Infinity
    for (const o of stageLayout(0).objects) {
      if (!isPresent(o.id)) continue
      const d = (o.x - p.x) ** 2 + (o.z - p.z) ** 2
      if (d < best) {
        best = d
        near.x = o.x
        near.z = o.z
        near.found = true
      }
    }
  }
  return near.found ? { x: near.x, z: near.z, reach: 3 } : null
}

/** The lobby, from wherever you are: back over the bridge to its middle. */
const toLobby = (p) => (p.z < LOBBY.minZ - 2 ? { x: 0, z: LOBBY.minZ + 10, reach: 8 } : null)

/** Ground point each tutorial step leads to (null: none from here). */
const TARGETS = {
  // The first Storm Zone, in the lobby.
  pad: (p) => toLobby(p) ?? { x: PAD_X, z: padCenterZ(0), reach: 2.5 },
  // Through the lobby's gate and over the bridge into the first city.
  gate: (p) => (p.z > gateZ(0) ? { x: 0, z: gateZ(0) - 14, reach: 10 } : null),
  // Into the first city, then the nearest thing still standing in it.
  stuff: (p) => (p.z > gateZ(0) ? { x: 0, z: gateZ(0) - 14, reach: 10 } : nearestStanding(p)),
  // Back to the lobby.
  lobby: toLobby,
  // To the Gusty Swirl's BUY spot in the lobby's showroom.
  types: (p) => toLobby(p) ?? { x: TORNADO_STANDS[1].spotX, z: TORNADO_STANDS[1].z, reach: 1.6 },
}

const _m = new Matrix4()
const _q = new Quaternion()
const _p = new Vector3()
const _s = new Vector3(1, 1, 1)
const _up = new Vector3(0, 1, 0)

/** A flat ">"-shaped chevron lying on the ground, pointing along +Z. */
function chevronGeometry() {
  const p = new PropBuilder()
  for (const side of [-1, 1]) {
    p.box(side * 0.42, 0.05, -0.05, 1.15, 0.08, 0.38, '#ff9a1f', STYLE.GLOW, [0, side * 0.75, 0])
  }
  return p.build()
}

/**
 * Orange chevrons on the ground leading to the current tutorial goal, as in the
 * reference. They march towards the target and disappear once you get there.
 */
export function TutorialArrows() {
  const ref = useRef(null)
  const { mesh } = useMemo(() => {
    const m = createToyInstances(chevronGeometry(), sharedMaterials().toy, MAX_CHEVRONS)
    return { mesh: m }
  }, [])

  useEffect(
    () => () => {
      mesh.geometry.dispose()
      mesh.dispose()
    },
    [mesh],
  )

  useFrame((state) => {
    const instanced = ref.current
    if (!instanced) return
    const { profile } = getGame()
    const step = TUTORIAL[profile.tutorialStep]
    const player = runtime.player.position
    const target = step && TARGETS[step.target]?.(player)
    if (!target || runtime.camera.mode !== 'follow') {
      instanced.count = 0
      return
    }
    const dx = target.x - player.x
    const dz = target.z - player.z
    const dist = Math.hypot(dx, dz)
    if (dist < (target.reach ?? ARRIVED)) {
      instanced.count = 0
      return
    }
    const ux = dx / dist
    const uz = dz / dist
    _q.setFromAxisAngle(_up, Math.atan2(ux, uz))
    // March towards the goal.
    const offset = (state.clock.elapsedTime * 3) % SPACING
    let count = 0
    for (let d = 1.6 + offset; d < dist - 1 && count < MAX_CHEVRONS; d += SPACING) {
      const x = player.x + ux * d
      const z = player.z + uz * d
      // Clear of everything lying on the ground (roads, lot markings, plazas up to 0.3).
      _p.set(x, 0.36, z)
      // Fade in near the player, shrink near the goal - in plan only, so their height
      // above the floor never changes.
      const scale = Math.max(0.01, Math.min(1, (d - 1.2) / 1.5) * Math.min(1, (dist - d) / 2))
      _s.set(scale * 1.7, 1, scale * 1.7)
      instanced.setMatrixAt(count, _m.compose(_p, _q, _s))
      count += 1
    }
    instanced.count = count
    instanced.instanceMatrix.needsUpdate = true
  })

  return <primitive ref={ref} object={mesh} />
}

export default TutorialArrows
