import { Vector3 } from 'three'

import { BASE_RADIUS, TORNADOES } from '@shared/balance'

import { runtime } from '../game/runtime'

/**
 * Other players, as the network last described them. Network callbacks write here;
 * the renderer reads it each frame and interpolates between snapshots, drawing
 * everyone ~110 ms in the past so 10 Hz updates still move smoothly.
 */

/** sessionId -> remote player */
export const remotePlayers = new Map()

const MAX_SNAPSHOTS = 24

export function upsertRemotePlayer(sessionId, state) {
  let r = remotePlayers.get(sessionId)
  if (!r) {
    r = {
      sessionId,
      name: '',
      /** Their verified Boxity user id ('' for guests): matches Boxity chat to them. */
      uid: '',
      snaps: [],
      position: new Vector3(state.x, state.y, state.z),
      /** Their velocity (m/s), worked out from the interpolated positions: the funnel's lean. */
      vx: 0,
      vz: 0,
      yaw: state.rotY,
      speed: 0,
      anim: 'idle',
      tornado: TORNADOES[0].id,
      radius: BASE_RADIUS,
      /** Their avatar's outfit, parsed from `look`; `lookKey` is the raw string. */
      look: null,
      lookKey: '',
      petIds: [],
      /** Follow state per equipped pet, grown as needed and reused. */
      pets: [],
      spin: Math.random() * 6,
    }
    r.shadow = { position: r.position, size: 2, visible: true }
    runtime.shadowCasters.add(r.shadow)
    remotePlayers.set(sessionId, r)
  }
  r.name = state.name
  r.uid = state.uid || ''
  r.anim = state.anim
  r.tornado = state.tornado || TORNADOES[0].id
  r.radius = state.radius > 0 ? state.radius : BASE_RADIUS
  r.level = state.level
  r.rebirths = state.rebirths
  if (state.look !== r.lookKey) {
    r.lookKey = state.look
    try {
      r.look = state.look ? JSON.parse(state.look) : null
    } catch {
      r.look = null
    }
  }
  r.petIds = [...state.petIds]
  while (r.pets.length < r.petIds.length) {
    r.pets.push({ id: '', position: r.position.clone(), yaw: 0, hop: 0 })
  }
  const last = r.snaps[r.snaps.length - 1]
  if (!last || last.x !== state.x || last.y !== state.y || last.z !== state.z || last.r !== state.rotY) {
    r.snaps.push({ t: performance.now(), x: state.x, y: state.y, z: state.z, r: state.rotY })
    if (r.snaps.length > MAX_SNAPSHOTS) r.snaps.shift()
  }
}

export function removeRemotePlayer(sessionId) {
  const r = remotePlayers.get(sessionId)
  if (!r) return
  runtime.shadowCasters.delete(r.shadow)
  remotePlayers.delete(sessionId)
}

export function clearRemotePlayers() {
  for (const id of [...remotePlayers.keys()]) removeRemotePlayer(id)
  runtime.remotePets.length = 0
}
