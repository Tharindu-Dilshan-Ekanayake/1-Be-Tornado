import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Color, Matrix4, Quaternion, Vector3 } from 'three'

import { remotePlayers } from '../../net/remotePlayers'
import { getQuality } from '../../store/quality'
import { createBoxInstances, disposeBlocks } from '../blocks'
import { sharedMaterials, STYLE } from '../materials'
import { runtime } from '../runtime'
import { hideNameplatesFrom, NAMEPLATE_POOL_SIZE, placeNameplate } from './nameplates'
import { riderPosition } from './rider'

/** Remote players are drawn this far in the past, so 10 Hz updates interpolate. */
const INTERP_DELAY_MS = 110
const MAX_REMOTES = 8
const PARTS = 6
const S = 0.36

/** Classic blocky figure: [x, y(pivot), size, hangs from pivot]. */
const PART_LAYOUT = [
  { key: 'head', pos: [0, 1.62, 0], size: [1.2 * S, 1 * S, 1 * S] },
  { key: 'torso', pos: [0, 1.08, 0], size: [2 * S, 2 * S, 1 * S] },
  { key: 'armL', pos: [-1.5 * S, 1.44, 0], size: [1 * S, 2 * S, 1 * S], swing: -1 },
  { key: 'armR', pos: [1.5 * S, 1.44, 0], size: [1 * S, 2 * S, 1 * S], swing: 1 },
  { key: 'legL', pos: [-0.5 * S, 0.72, 0], size: [1 * S, 2 * S, 1 * S], swing: 1 },
  { key: 'legR', pos: [0.5 * S, 0.72, 0], size: [1 * S, 2 * S, 1 * S], swing: -1 },
]

const palette = (list) => list.map((c) => new Color(c))
const SHIRTS = palette(['#e8423a', '#2f7fe6', '#3ccf4e', '#9b4dff', '#ff9a1f', '#1d1f26', '#ffffff', '#ff5fa8'])
const PANTS = palette(['#2d3a5c', '#1d1f26', '#4a3a2a', '#3a3a46', '#2f5aa8'])
const SKINS = palette(['#f5cd47', '#e8b48a', '#c98a5a', '#8a5a3a', '#ffd9b3'])

function hashString(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i += 1) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

const _m = new Matrix4()
const _base = new Matrix4()
const _local = new Matrix4()
const _rot = new Matrix4()
const _scale = new Matrix4()
const _q = new Quaternion()
const _s = new Vector3(1, 1, 1)
const _v = new Vector3()
const _up = new Vector3(0, 1, 0)
const _target = new Vector3()
const _dir = new Vector3()
const _at = new Vector3()

function lerpAngle(a, b, t) {
  let d = b - a
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return a + d * t
}

/** Interpolates a remote player to `renderTime`, and works out their velocity. */
function interpolate(r, renderTime, delta) {
  const snaps = r.snaps
  if (snaps.length === 0) return
  let i = snaps.length - 1
  while (i > 0 && snaps[i - 1].t > renderTime) i -= 1
  const b = snaps[i]
  const a = snaps[Math.max(0, i - 1)]
  const span = b.t - a.t
  const t = span > 0 ? Math.min(1, Math.max(0, (renderTime - a.t) / span)) : 1
  const px = r.position.x
  const pz = r.position.z
  r.position.set(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t)
  r.yaw = lerpAngle(a.r, b.r, t)
  const k = 1 - Math.exp(-8 * delta)
  r.vx += ((r.position.x - px) / Math.max(delta, 1e-3) - r.vx) * k
  r.vz += ((r.position.z - pz) / Math.max(delta, 1e-3) - r.vz) * k
  r.speed = Math.hypot(r.vx, r.vz)
  while (snaps.length > 2 && snaps[1].t < renderTime) snaps.shift()
}

/** Writes one blocky figure's six parts from `base`, flailing; returns the next free instance. */
function writeFigure(body, instance, r, base, time) {
  const h = hashString(r.sessionId)
  const shirt = SHIRTS[h % SHIRTS.length]
  const pants = PANTS[(h >>> 8) % PANTS.length]
  const skin = SKINS[(h >>> 16) % SKINS.length]
  for (const part of PART_LAYOUT) {
    const hangs = part.swing !== undefined
    const isArm = part.key.startsWith('arm')
    const angle = hangs ? (isArm ? -2.5 + Math.sin(time * 9 + part.swing) * 0.4 : Math.sin(time * 7) * 0.4 * part.swing) : 0
    _local.makeTranslation(part.pos[0], part.pos[1], part.pos[2])
    _rot.makeRotationX(angle)
    _scale.makeScale(part.size[0], part.size[1], part.size[2])
    if (hangs) _scale.setPosition(0, -part.size[1] / 2, 0)
    _m.copy(base).multiply(_local).multiply(_rot).multiply(_scale)
    body.setMatrixAt(instance, _m)
    body.setColorAt(instance, part.key === 'torso' ? shirt : part.key.startsWith('leg') ? pants : skin)
    instance += 1
  }
  return instance
}

/**
 * Everyone else in the server: where they are (interpolated, ~110 ms behind), riding in
 * their tornado (Tornadoes draws the funnels) as a blocky figure - or their real avatar,
 * for the nearest few (RemoteAvatars) - with name tags and their pets circling their funnel.
 */
export function RemotePlayers() {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)
  const bodyRef = useRef(null)

  const assets = useMemo(() => {
    const body = createBoxInstances(MAX_REMOTES * PARTS, sharedMaterials().toy, STYLE.SMOOTH)
    return { body }
  }, [])

  useEffect(
    () => () => {
      disposeBlocks(assets.body)
      hideNameplatesFrom(0)
    },
    [assets],
  )

  useFrame((state, rawDelta) => {
    const body = bodyRef.current
    if (!body) return
    const delta = Math.min(rawDelta, 0.05)
    const settings = getQuality()
    const renderTime = performance.now() - INTERP_DELAY_MS
    const t = state.clock.elapsedTime

    let instance = 0
    let plate = 0
    runtime.remotePets.length = 0

    for (const r of remotePlayers.values()) {
      interpolate(r, renderTime, delta)
      r.shadow.size = r.radius * 1.6
      const distance = camera.position.distanceTo(r.position)
      const visible = distance < settings.remoteDrawDistance + r.radius * 4
      r.shadow.visible = visible
      if (!visible) continue

      riderPosition(r, t, _at)
      if (!r.fullAvatar && instance + PARTS <= MAX_REMOTES * PARTS) {
        _q.setFromAxisAngle(_up, -(r.spin + t * 2.4) * 1.2)
        _base.compose(_at, _q, _s)
        instance = writeFigure(body, instance, r, _base, t + r.spin)
      }

      // Name tag over the rider.
      if (plate < NAMEPLATE_POOL_SIZE) {
        _v.set(_at.x, _at.y + 2.4, _at.z)
        if (distance < settings.remoteNameDistance + r.radius * 2) {
          _v.project(camera)
          if (_v.z < 1) {
            const fade = Math.min(1, (settings.remoteNameDistance + r.radius * 2 - distance) / 6)
            placeNameplate(plate, r.name, (_v.x * 0.5 + 0.5) * size.width, (-_v.y * 0.5 + 0.5) * size.height, fade, r.uid)
          } else placeNameplate(plate, '', null)
        } else placeNameplate(plate, '', null)
        plate += 1
      }

      // Their pets ride round their funnel.
      for (let i = 0; i < r.petIds.length && i < r.pets.length; i += 1) {
        const pet = r.pets[i]
        pet.id = r.petIds[i]
        const a = (i / 3) * Math.PI * 2 + t * 0.9
        const ring = r.radius + 1.2
        _target.set(r.position.x + Math.cos(a) * ring, 0, r.position.z + Math.sin(a) * ring)
        _dir.copy(pet.position)
        pet.position.lerp(_target, 1 - Math.exp(-6 * delta))
        if (_dir.distanceTo(pet.position) > 0.005) pet.yaw = Math.atan2(pet.position.x - _dir.x, pet.position.z - _dir.z)
        pet.hop = Math.abs(Math.sin(t * 7 + i)) * 0.35
        runtime.remotePets.push(pet)
      }
    }
    hideNameplatesFrom(plate)
    body.count = instance
    body.instanceMatrix.needsUpdate = true
    if (body.instanceColor) body.instanceColor.needsUpdate = true
  })

  return <primitive ref={bodyRef} object={assets.body} />
}

export default RemotePlayers
