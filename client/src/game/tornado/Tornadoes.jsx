import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Matrix4, Quaternion, Vector3 } from 'three'

import { TORNADO_HEIGHT, TORNADOES } from '@shared/balance'
import { tornadoRadius } from '@shared/logic'
import { LOBBY, TORNADO_STANDS } from '@shared/world'

import { remotePlayers } from '../../net/remotePlayers'
import { getGame } from '../../store/game'
import { getQuality, useQuality } from '../../store/quality'
import { runtime } from '../runtime'
import { createFunnelMesh, createRingMesh, disposeTornadoMesh, flushTornadoAttributes, tornadoTime, writeTornado } from './funnel'

/** Yours plus everyone else in the server. */
const MAX_LIVE = 9
const STAND_DISPLAY = { radius: 1.25, height: 4.2, y: 1.15 }

const _m = new Matrix4()
const _q = new Quaternion()
const _p = new Vector3()
const _s = new Vector3()

/** A stable small number per session id, so remote tornadoes don't sway in step. */
function seedOf(id) {
  let h = 0
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return (h % 1000) / 1000
}

/**
 * Every tornado on screen: yours, the other players' (at the radius and type the server
 * says they have) and - when you're near the lobby - the showroom's spinning on their
 * stands. Two InstancedMeshes of the funnel (full detail for the live ones, a lighter one
 * for the displays) and one of ground rings: three draw calls for all of them.
 *
 * Your tornado's drawn size eases towards its real one (runtime.tornado.radius), so a new
 * ring or a rebirth grows or shrinks it smoothly; the camera and the absorb prediction
 * read the same eased value.
 */
export function Tornadoes() {
  const camera = useThree((s) => s.camera)
  const detail = useQuality((s) => s.settings.funnelDetail)

  const meshes = useMemo(() => {
    const live = createFunnelMesh(MAX_LIVE, detail)
    const rings = createRingMesh(MAX_LIVE)
    const stands = createFunnelMesh(TORNADO_STANDS.length, { layers: 1, segments: 14, rings: 8 })
    // The displays don't move: their colours are written once.
    TORNADO_STANDS.forEach((stand, i) => writeTornado(stands, i, TORNADOES[i].id, i * 0.137, 0.95, 0, 0, 1.4, 0.6))
    flushTornadoAttributes(stands)
    return { live, rings, stands }
  }, [detail])

  useEffect(
    () => () => {
      disposeTornadoMesh(meshes.live)
      disposeTornadoMesh(meshes.rings)
      disposeTornadoMesh(meshes.stands)
    },
    [meshes],
  )

  const liveRef = useRef(null)
  const ringsRef = useRef(null)
  const standsRef = useRef(null)

  useFrame((state, rawDelta) => {
    const live = liveRef.current
    const rings = ringsRef.current
    const stands = standsRef.current
    if (!live || !rings || !stands) return
    const delta = Math.min(rawDelta, 0.05)
    tornadoTime.value = state.clock.elapsedTime
    const settings = getQuality()

    // --- Yours ---------------------------------------------------------------------
    const { profile } = getGame()
    const t = runtime.tornado
    const target = tornadoRadius(profile)
    t.radius += (target - t.radius) * (1 - Math.exp(-2.2 * delta))
    t.height = t.radius * TORNADO_HEIGHT
    t.spin += (1 - t.spin) * (1 - Math.exp(-1.5 * delta))
    const p = runtime.player.position
    const v = runtime.player.velocity
    let n = 0
    const place = (x, y, z, radius, height, typeId, seed, vx, vz, spin) => {
      // Leans into the wind it makes: up to a third of its radius at the top.
      const lean = Math.min(0.35, Math.hypot(vx, vz) / 40)
      const len = Math.hypot(vx, vz) || 1
      _p.set(x, y, z)
      _s.set(radius, height, radius)
      _q.identity()
      live.setMatrixAt(n, _m.compose(_p, _q, _s))
      writeTornado(live, n, typeId, seed, 1, (vx / len) * lean, (vz / len) * lean, spin, 1)
      _p.y += 0.06
      _s.set(radius * 2.6, 1, radius * 2.6)
      rings.setMatrixAt(n, _m.compose(_p, _q, _s))
      writeTornado(rings, n, typeId, seed, 0.9)
      n += 1
    }
    place(p.x, p.y, p.z, t.radius, t.height, profile.equippedTornado, 0.5, v.x, v.z, t.spin)

    // --- Everyone else's ------------------------------------------------------------
    for (const r of remotePlayers.values()) {
      if (n >= MAX_LIVE) break
      if (camera.position.distanceTo(r.position) > settings.remoteDrawDistance + r.radius * 4) continue
      r.seed ??= seedOf(r.sessionId)
      place(r.position.x, r.position.y, r.position.z, r.radius, r.radius * TORNADO_HEIGHT, r.tornado, r.seed, r.vx, r.vz, 1 + (r.anim === 'surge' ? 1.5 : 0))
    }
    live.count = n
    rings.count = n
    live.instanceMatrix.needsUpdate = true
    rings.instanceMatrix.needsUpdate = true
    flushTornadoAttributes(live)
    flushTornadoAttributes(rings)

    // --- The showroom, only when the lobby's in view ----------------------------------
    const nearLobby = camera.position.z > LOBBY.minZ - 140
    stands.visible = nearLobby
    if (nearLobby && stands.count === 0) {
      TORNADO_STANDS.forEach((stand, i) => {
        _p.set(stand.x, STAND_DISPLAY.y, stand.z)
        _s.set(STAND_DISPLAY.radius, STAND_DISPLAY.height, STAND_DISPLAY.radius)
        _q.identity()
        stands.setMatrixAt(i, _m.compose(_p, _q, _s))
      })
      stands.count = TORNADO_STANDS.length
      stands.instanceMatrix.needsUpdate = true
    }
  })

  return (
    <>
      <primitive ref={ringsRef} object={meshes.rings} />
      <primitive ref={liveRef} object={meshes.live} />
      <primitive ref={standsRef} object={meshes.stands} />
    </>
  )
}

export default Tornadoes
