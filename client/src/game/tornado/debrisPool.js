import { Color, Vector3 } from 'three'

import { KINDS } from '@shared/cities'

import { remotePlayers } from '../../net/remotePlayers'
import { getQuality } from '../../store/quality'
import { runtime } from '../runtime'

/**
 * The debris pool behind Debris.jsx: a fixed set of pieces, each whirling round one
 * tornado ('me' or a remote player's session id), reused oldest-first. A piece can start
 * with a throw (`vel`): it flies free for a moment - out of something being torn apart,
 * say - before the funnel's wind takes it. `Debris` moves them into an InstancedMesh once
 * a frame; nothing is allocated after start-up.
 */

export const POOL = 320
const _c = new Color()

export const pieces = Array.from({ length: POOL }, () => ({
  life: 0,
  age: 0,
  owner: '',
  angle: 0,
  speed: 0,
  rFrac: 1,
  rise: 0,
  size: 0.3,
  /** How long it takes the wind to take it (s): flying free from `from` with `vel` till then. */
  blend: 0.35,
  from: new Vector3(),
  vel: new Vector3(),
  rot: new Vector3(),
  spin: new Vector3(),
}))
export const owned = new Map()
let next = 0

/** Where owner `id` ('me' or a session id) is: { x, z, radius, height } or null. */
const _owner = { x: 0, y: 0, z: 0, radius: 1, height: 3 }
export function ownerOf(id) {
  if (id === 'me') {
    const p = runtime.player.position
    _owner.x = p.x
    _owner.y = p.y
    _owner.z = p.z
    _owner.radius = runtime.tornado.radius
    _owner.height = runtime.tornado.height
    return _owner
  }
  const r = remotePlayers.get(id)
  if (!r) return null
  _owner.x = r.position.x
  _owner.y = r.position.y
  _owner.z = r.position.z
  _owner.radius = r.radius
  _owner.height = r.radius * 3.4
  return _owner
}

export const debrisMesh = { current: null }

/** Takes the next piece of the pool for owner `id`, freeing whoever had it. */
function take(id) {
  const index = next
  next = (next + 1) % Math.min(POOL, getQuality().debris)
  const p = pieces[index]
  if (p.life > 0) owned.set(p.owner, Math.max(0, (owned.get(p.owner) || 1) - 1))
  owned.set(id, (owned.get(id) || 0) + 1)
  p.owner = id
  p.age = 0
  return index
}

/** Sends `count` pieces in `colors` (from point `from`, or the funnel's foot) round owner `id`'s tornado. */
export function spawnDebris(id, count, colors, from = null, size = 0.35, life = 5) {
  const mesh = debrisMesh.current
  if (!mesh || !getQuality().debris) return
  for (let i = 0; i < count; i += 1) {
    const index = take(id)
    const p = pieces[index]
    p.life = life * (0.7 + Math.random() * 0.6)
    p.angle = Math.random() * Math.PI * 2
    p.speed = 2.2 + Math.random() * 2.2
    p.rFrac = 0.7 + Math.random() * 0.5
    p.rise = Math.random() * 0.2
    p.size = size * (0.6 + Math.random() * 0.8)
    p.blend = 0.35
    p.vel.set(0, 0, 0)
    const o = ownerOf(id)
    if (from) p.from.copy(from)
    else if (o) p.from.set(o.x + Math.cos(p.angle) * o.radius, 0, o.z + Math.sin(p.angle) * o.radius)
    p.rot.set(Math.random() * 6, Math.random() * 6, Math.random() * 6)
    p.spin.set((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8)
    mesh.setColorAt(index, _c.set(colors[Math.floor(Math.random() * colors.length)]))
  }
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
}

export const DUST = ['#c9b896', '#8a96a6', '#6d7d8c', '#a8743f', '#5a6676']
const LANDMARK_COLORS = ['#e8e2d4', '#c8ccd4', '#8a8e9a', '#ffd21f', '#b8a888']

/**
 * Pieces blown out of `o`: from all over it, thrown out and up in its own colours (a
 * third of them dust), then caught by the wind and whirled up your funnel.
 */
function throwPieces(o, count, upOnly, speed) {
  const mesh = debrisMesh.current
  if (!mesh || !getQuality().debris) return
  const colors = KINDS[o.kind]?.c ?? LANDMARK_COLORS
  const tall = 0.8 + o.r * 1.3
  for (let i = 0; i < count; i += 1) {
    const index = take('me')
    const p = pieces[index]
    p.life = 2.6 + Math.random() * 1.8
    p.angle = Math.random() * Math.PI * 2
    p.speed = 2.6 + Math.random() * 2.4
    p.rFrac = 0.6 + Math.random() * 0.6
    p.rise = Math.random() * 0.25
    p.size = (0.22 + Math.random() * 0.3) * (0.8 + Math.min(1.6, o.r * 0.2))
    p.blend = 0.7 + Math.random() * 0.6
    const a = Math.random() * Math.PI * 2
    const spread = o.r * 0.6 * Math.random()
    p.from.set(o.x + Math.cos(a) * spread, (upOnly ? 0.5 + Math.random() * 0.5 : Math.random()) * tall, o.z + Math.sin(a) * spread)
    const v = speed * (0.6 + Math.random() * 0.8)
    p.vel.set(Math.cos(a) * v, (upOnly ? 1.2 : 0.6 + Math.random() * 0.7) * v, Math.sin(a) * v)
    p.rot.set(Math.random() * 6, Math.random() * 6, Math.random() * 6)
    p.spin.set((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14)
    const dust = i % 3 === 2
    mesh.setColorAt(index, _c.set(dust ? DUST[i % DUST.length] : colors[Math.floor(Math.random() * colors.length)]))
  }
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
}

/** Pieces for something torn apart: more for bigger things. */
const BURST = { tiny: 2, small: 4, medium: 6, large: 9, huge: 12, trophy: 12, landmark: 26 }
export function onShatter(o) {
  throwPieces(o, BURST[o.size] ?? 4, false, 4 + Math.min(6, o.r * 0.8))
}

/** Chips flying off a big thing you're tearing at, more the closer it is to breaking. */
export function onTear(o, progress) {
  throwPieces(o, 1 + Math.round(progress * 3), true, 2.5 + progress * 3)
}
