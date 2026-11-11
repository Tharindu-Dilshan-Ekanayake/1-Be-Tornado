import { useFrame } from '@react-three/fiber'
import { Suspense, useEffect, useRef } from 'react'
import { Quaternion, Vector3 } from 'three'

import { isPadUnlocked, tornadoSpeed } from '@shared/logic'
import { clampToWalkable, LOBBY, padAt, STATIC_COLLIDERS } from '@shared/world'

import { getGame } from '../store/game'
import ErrorBoundary from '../ui/ErrorBoundary'
import FallbackAvatar from './FallbackAvatar'
import PlayerAvatar from './PlayerAvatar'
import { runtime } from './runtime'
import useKeyboard from './useKeyboard'

export const PLAYER_HEIGHT = 1.8
/** The tornado's solid core, for bumping into the lobby's stands and boards. */
const RADIUS = 0.7
const ACCELERATION = 7
/** The rider spins round inside the funnel this fast (radians a second). */
const RIDE_SPIN = 2.4

// Scratch objects, reused each frame so the loop allocates nothing.
const _input = new Vector3()
const _move = new Vector3()
const _camForward = new Vector3()
const _camRight = new Vector3()
const _targetQuat = new Quaternion()
const _up = new Vector3(0, 1, 0)
const _clamped = { x: 0, z: 0 }

/** Pushes a circle out of an axis-aligned rect. */
function pushOut(pos, rect) {
  const cx = Math.min(rect.maxX, Math.max(rect.minX, pos.x))
  const cz = Math.min(rect.maxZ, Math.max(rect.minZ, pos.z))
  const dx = pos.x - cx
  const dz = pos.z - cz
  const d2 = dx * dx + dz * dz
  if (d2 >= RADIUS * RADIUS) return
  if (d2 > 1e-8) {
    const d = Math.sqrt(d2)
    const push = (RADIUS - d) / d
    pos.x += dx * push
    pos.z += dz * push
    return
  }
  const left = pos.x - rect.minX
  const right = rect.maxX - pos.x
  const near = pos.z - rect.minZ
  const far = rect.maxZ - pos.z
  const m = Math.min(left, right, near, far)
  if (m === left) pos.x = rect.minX - RADIUS
  else if (m === right) pos.x = rect.maxX + RADIUS
  else if (m === near) pos.z = rect.minZ - RADIUS
  else pos.z = rect.maxZ + RADIUS
}

/**
 * The local player: a tornado gliding over the ground, steered relative to the camera
 * (joystick or WASD/arrows), as fast as its speed upgrades allow. No physics engine: the
 * ground is flat, and the only things it bumps into are the lobby's stands, boards and
 * locked Storm Zones (circle-vs-rect push-out). It's kept on the ground you may walk on:
 * the lobby, the cities you've opened and the bridges up to the first closed gate.
 *
 * Your Bloxity avatar rides inside the funnel, near its foot, whirling round with it.
 * The funnel itself is drawn by Tornadoes (it follows runtime.player).
 *
 * Reads and writes `runtime.player`; never touches React state per frame.
 */
export function Player({ onAvatarReady }) {
  const groupRef = useRef(null)
  const visualRef = useRef(null)
  const keys = useKeyboard()
  const spin = useRef(0)

  const motionRef = useRef({ time: 0, speed: 0, grounded: false, maxSpeed: 11, vy: 0, stride: 0, ride: 1 })

  // The blob shadow sits under the funnel, as wide as it.
  const casterRef = useRef(null)
  useEffect(() => {
    const caster = { position: runtime.player.position, size: 2 }
    casterRef.current = caster
    runtime.shadowCasters.add(caster)
    return () => runtime.shadowCasters.delete(caster)
  }, [])

  useFrame((state, rawDelta) => {
    const delta = Math.min(rawDelta, 0.05)
    const player = runtime.player
    const pos = player.position
    const k = keys.current
    const joy = runtime.input
    const motion = motionRef.current
    const velocity = player.velocity
    const { profile } = getGame()
    motion.time += delta

    // --- Input, relative to the camera ----------------------------------------
    _input.set(0, 0, 0)
    if (!player.frozen && !getGame().panel) {
      _input.set((k.right ? 1 : 0) - (k.left ? 1 : 0) + joy.joyX, 0, (k.backward ? 1 : 0) - (k.forward ? 1 : 0) - joy.joyY)
    }
    const amount = Math.min(1, _input.length())
    const top = tornadoSpeed(profile)
    if (amount > 0.02) {
      _input.normalize()
      state.camera.getWorldDirection(_camForward)
      _camForward.y = 0
      _camForward.normalize()
      _camRight.crossVectors(_camForward, _up).normalize()
      _move.set(0, 0, 0).addScaledVector(_camForward, -_input.z).addScaledVector(_camRight, _input.x).normalize().multiplyScalar(top * amount)
    } else {
      _move.set(0, 0, 0)
    }
    // A tornado carries its momentum: eased in and out, never an instant stop.
    velocity.lerp(_move, 1 - Math.exp(-ACCELERATION * delta))

    // --- Move, bump, stay on the ground you're allowed on -------------------------
    pos.x += velocity.x * delta
    pos.z += velocity.z * delta
    if (pos.z > LOBBY.minZ - 2) {
      for (const rect of STATIC_COLLIDERS) pushOut(pos, rect)
      for (const rect of runtime.dynamicColliders) pushOut(pos, rect)
    }
    clampToWalkable(pos.x, pos.z, profile.unlocked, _clamped)
    pos.x = _clamped.x
    pos.z = _clamped.z
    pos.y = 0

    const speed = Math.hypot(velocity.x, velocity.z)
    if (speed > 0.4) player.yaw = Math.atan2(velocity.x, velocity.z)
    player.speed = speed
    const pad = padAt(pos.x, pos.z)
    const training = pad >= 0 && speed < 1 && isPadUnlocked(profile, pad)
    const surging = performance.now() - runtime.tornado.surgeAt < 900
    player.anim = surging ? 'surge' : training ? 'run' : speed > 0.6 ? 'walk' : 'idle'

    // --- The rider, whirling round inside the funnel ------------------------------
    spin.current += delta * RIDE_SPIN * runtime.tornado.spin
    const group = groupRef.current
    const visual = visualRef.current
    if (group && visual) {
      const radius = runtime.tornado.radius
      const bob = Math.sin(motion.time * 2.6) * 0.25
      const orbit = Math.min(0.9, radius * 0.12)
      group.position.set(pos.x + Math.cos(spin.current) * orbit, 0.6 + radius * 0.18 + bob, pos.z + Math.sin(spin.current) * orbit)
      _targetQuat.setFromAxisAngle(_up, -spin.current * 1.2)
      visual.quaternion.slerp(_targetQuat, 1 - Math.pow(0.001, delta))
    }
    if (casterRef.current) casterRef.current.size = runtime.tornado.radius * 1.6

    motion.speed = speed
    motion.grounded = false
    motion.vy = 0
    motion.ride = 1
    motion.stride += delta * 6
  })

  return (
    <group ref={groupRef}>
      <group ref={visualRef}>
        <ErrorBoundary fallback={<FallbackAvatar motionRef={motionRef} onReady={onAvatarReady} />}>
          <Suspense fallback={<FallbackAvatar motionRef={motionRef} />}>
            <PlayerAvatar onReady={onAvatarReady} targetHeight={PLAYER_HEIGHT} motionRef={motionRef} />
          </Suspense>
        </ErrorBoundary>
      </group>
    </group>
  )
}

export default Player
