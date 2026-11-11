import { Matrix4, Quaternion, Sphere, Vector3 } from 'three'

import { HP_GRACE } from '@shared/balance'
import { forObjectsNear, objectById, reachFor, stageLayout } from '@shared/cities'
import { tearSpeed } from '@shared/logic'
import { stageAt } from '@shared/world'

import { getGame } from '../../store/game'
import { getQuality } from '../../store/quality'
import { stormWind } from '../materials'
import { runtime } from '../runtime'
import { funnelProfile } from '../tornado/funnel'

/**
 * Every city object's life on this client, outside React: torn apart (its boxes flying
 * into your funnel), gone, and back again; and the meshes each city stage registered, so
 * an object's boxes can be animated or hidden on their own.
 *
 * The server decides what your tornado swallows (shared/session.js). This side PREDICTS it
 * for show - an object bursts apart the moment your funnel reaches it, with a slightly
 * smaller reach than the server's, so a prediction is nearly always one the server then
 * confirms - and plays whatever the server confirms that it didn't predict. A prediction
 * never confirmed puts the object back after PREDICT_TIMEOUT. Objects come back when the
 * server would bring them back (their respawn time).
 *
 * How a thing is destroyed (all of it on the CPU, into the instance matrices the city
 * already draws with - no extra draw calls):
 * - Near your funnel, before it's reached, it leans in and shudders (the toy shader's
 *   sway, from `stormWind`, written here once a frame).
 * - Reached, it rips loose with a violent shake and bursts into its boxes, each thrown out
 *   and up, tumbling; the wind catches them and they whirl round and round inside the
 *   funnel, climbing it, cut down to chunks its size, until they vanish into the clouds
 *   at its top a few seconds later. They go wherever your tornado goes.
 * - Nothing needs a level: anything can be torn up, faster the stronger you are next to it
 *   (tearSpeed). Whatever takes more than a moment shakes harder and harder while you hold
 *   your funnel over it, its upper parts lifting loose and twisting, groaning and shedding
 *   pieces, until it breaks the same way.
 * Listeners (onCity) add the rest: rubble left behind, bricks and dust, sounds, the shake.
 */

/** How long a thing's pieces take to burst out and be caught by the wind (ms), by size. */
const CATCH_MS = { tiny: 380, small: 480, medium: 560, large: 650, huge: 800, trophy: 800, landmark: 1100 }
/** How long the pieces then whirl round inside the funnel, climbing it, before they're gone (ms). */
const ORBIT_MS = 2600
const ORBIT_MS_BIG = 3400
const orbitMs = (o) => (o.size === 'landmark' || o.size === 'huge' ? ORBIT_MS_BIG : ORBIT_MS)
/** How long a thing flies in whole, past the frame's box budget (ms); how long it pops back in. */
const WHOLE_MS = 700
const POP_MS = 320
/** A prediction the server hasn't confirmed by then was wrong: put the object back. */
const PREDICT_TIMEOUT = 2400
/** Predict a little inside the server's reach, so predictions are confirmed. */
const PREDICT_MARGIN = 0.5
/** Anything torn up in this long or less is predicted to break; slower things wait for the server (s). */
const QUICK_TEAR = 0.6
/** How often something you're tearing at throws off pieces and creaks (ms). */
const TEAR_FX_MS = 260

/** stage index -> view: { chunks: InstancedMesh[], ranges: Int32Array (chunk, start, count per object), original: Float32Array[] } */
const views = new Map()
/**
 * object id -> { phase: 'absorb'|'down'|'pop', t0, confirmed, until, fx, fz (where
 * it stood), px, pz (where your tornado was when it was hit), mode: ''|'burst'|'whole' }
 */
const objects = new Map()
/** Spare state records, reused so the frame loop never allocates one. */
const spare = []
function stateFor(id, phase, t0, confirmed, fx = 0, fz = 0) {
  const s = spare.pop() ?? { phase: '', t0: 0, confirmed: false, until: 0, fx: 0, fz: 0, px: 0, pz: 0, mode: '' }
  s.phase = phase
  s.t0 = t0
  s.confirmed = confirmed
  s.until = 0
  s.fx = fx
  s.fz = fz
  s.px = runtime.player.position.x
  s.pz = runtime.player.position.z
  s.mode = ''
  objects.set(id, s)
  return s
}
function dropState(id) {
  const s = objects.get(id)
  if (!s) return
  objects.delete(id)
  if (spare.length < 512) spare.push(s)
}
/** Everything your funnel is tearing at: id -> { t (seconds of its hp), at (ms), fxAt (ms) }. */
export const contact = new Map()
/** Things shaking in your funnel right now (their boxes are moved: put back when it lets go). */
const tearing = new Set()

// --- Listeners --------------------------------------------------------------------------

/**
 * What the effect systems hear:
 * - shatter(o): `o` starts being torn apart (rubble, bricks, its smash sound, the shake)
 * - swallowed(o): its last piece is in the funnel
 * - back(id): object `id` is whole again (its rubble goes)
 * - tear(o, progress): something slow to tear up that you're holding your funnel over, every TEAR_FX_MS
 * - bigBroken(o): a huge thing, Giant Trophy or Landmark broke (server-confirmed)
 * - reset(): every city is whole again
 * - stageGone(index): a city stage was unloaded
 */
const listeners = { shatter: [], swallowed: [], back: [], tear: [], bigBroken: [], reset: [], stageGone: [] }

/** Listens for city event `event` (see above); returns the function that stops it. */
export function onCity(event, fn) {
  listeners[event].push(fn)
  return () => {
    const list = listeners[event]
    const i = list.indexOf(fn)
    if (i >= 0) list.splice(i, 1)
  }
}

function emit(event, a, b) {
  const list = listeners[event]
  for (let i = 0; i < list.length; i += 1) list[i](a, b)
}

// --- Matrices -----------------------------------------------------------------------------

const _a = new Matrix4()
const _b = new Matrix4()
const _m = new Matrix4()
const _zero = new Matrix4().makeScale(0, 0, 0)
const _target = new Vector3()
const _p = new Vector3()
const _s = new Vector3()
const _q = new Quaternion()
const _axis = new Vector3()
/** Your tornado's bounds: chunks with pieces whirling in it are stretched over it. */
const _storm = new Sphere()

export function registerStageView(index, view) {
  views.set(index, view)
  // Things already gone (swallowed before this stage was drawn) start hidden.
  for (const [id, state] of objects) {
    if (Math.floor(id / 1000) !== index) continue
    if (state.phase === 'down' || state.phase === 'absorb') setObjectMatrix(view, id % 1000, _zero)
  }
}

export function unregisterStageView(index) {
  views.delete(index)
  for (const id of tearing) if (Math.floor(id / 1000) === index) tearing.delete(id)
  emit('stageGone', index)
}

/** Writes matrix `m` (or the original transform times `m`, with `relative`) to every box of object `n`. */
function setObjectMatrix(view, n, m, relative = false) {
  const chunk = view.ranges[n * 3]
  if (chunk < 0) return
  const start = view.ranges[n * 3 + 1]
  const count = view.ranges[n * 3 + 2]
  const mesh = view.chunks[chunk]
  const original = view.original[chunk]
  const array = mesh.instanceMatrix.array
  for (let i = start; i < start + count; i += 1) {
    if (relative) {
      _b.fromArray(original, i * 16)
      _m.multiplyMatrices(m, _b)
      _m.toArray(array, i * 16)
    } else {
      m.toArray(array, i * 16)
    }
  }
  mesh.instanceMatrix.addUpdateRange(start * 16, count * 16)
  mesh.instanceMatrix.needsUpdate = true
}

/** Puts object `n`'s boxes back exactly as built. */
function restoreObject(view, n) {
  const chunk = view.ranges[n * 3]
  if (chunk < 0) return
  const start = view.ranges[n * 3 + 1]
  const count = view.ranges[n * 3 + 2]
  const mesh = view.chunks[chunk]
  mesh.instanceMatrix.array.set(view.original[chunk].subarray(start * 16, (start + count) * 16), start * 16)
  mesh.instanceMatrix.addUpdateRange(start * 16, count * 16)
  mesh.instanceMatrix.needsUpdate = true
}

/** A steady pseudo-random 0-1 for integer `n`: each box's own throw, every frame the same. */
function hash(n) {
  let h = (n ^ 61) ^ (n >>> 16)
  h = Math.imul(h, 9)
  h ^= h >>> 4
  h = Math.imul(h, 0x27d4eb2d)
  h ^= h >>> 15
  return (h >>> 0) / 4294967296
}

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x)
const smooth = (a, b, x) => {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}

/**
 * Object `o`, `e` ms after it was hit (state `s`): every box on its own. Ripped loose with
 * a shake and thrown out and up, tumbling; then caught by the wind and whirled round and
 * round inside the funnel, climbing it, cut down to a chunk the funnel's size, until it
 * shrinks away into the clouds at the top. Returns false once it's all gone.
 */
function shatterBoxes(view, o, s, e, now) {
  const chunk = view.ranges[o.n * 3]
  if (chunk < 0) return false
  const catchMs = CATCH_MS[o.size] ?? 500
  const u = (e - catchMs * 0.4) / orbitMs(o)
  if (u >= 1) return false
  const start = view.ranges[o.n * 3 + 1]
  const count = view.ranges[o.n * 3 + 2]
  const mesh = view.chunks[chunk]
  const original = view.original[chunk]
  const array = mesh.instanceMatrix.array
  const p = runtime.player.position
  const radius = runtime.tornado.radius
  const height = runtime.tornado.height
  view.active[chunk] = 1
  const r = o.r
  // The burst.
  const burst = 0.9 + r * 0.6
  const lift = 1.2 + r * 0.7
  const tb = clamp01((e - catchMs * 0.08) / (catchMs * 0.7))
  const eb = 1 - (1 - tb) * (1 - tb) * (1 - tb)
  const rip = e < catchMs * 0.15 ? e / (catchMs * 0.15) : Math.max(0, 1 - (e - catchMs * 0.15) / (catchMs * 0.3))
  const ripAmp = rip * (0.1 + r * 0.05)
  // Caught by the wind, and whirling.
  const caught = smooth(catchMs * 0.2, catchMs * 1.1, e)
  const whirl = Math.max(0, e - catchMs * 0.25) / 1000
  const climb = Math.pow(clamp01(u), 0.8)
  const fade = 1 - smooth(0.82, 1, u)
  const cut = smooth(catchMs * 0.3, catchMs * 1.3, e)
  const chunkMax = Math.max(0.35, radius * 0.32)
  for (let i = start, j = 0; i < start + count; i += 1, j += 1) {
    const seed = o.id * 131 + j * 17
    const r1 = hash(seed)
    const r2 = hash(seed + 1)
    const r3 = hash(seed + 2)
    const b = i * 16
    const ox = original[b + 12]
    const oy = original[b + 13]
    const oz = original[b + 14]
    // Out from the object's middle (a box in the middle goes any way).
    const dx = ox - o.x
    const dz = oz - o.z
    const out = Math.hypot(dx, dz) > 0.15 ? Math.atan2(dz, dx) + (r1 - 0.5) * 1.3 : r1 * Math.PI * 2
    const dist = burst * (0.45 + r2) * eb
    let x = ox + Math.cos(out) * dist
    let z = oz + Math.sin(out) * dist
    let y = oy + lift * (0.35 + r3) * eb * (1 + oy / (2 + r))
    if (ripAmp > 0) {
      x += Math.sin(now * 0.071 + j * 1.7) * ripAmp
      z += Math.cos(now * 0.063 + j * 2.3) * ripAmp
      y += Math.abs(Math.sin(now * 0.05 + j)) * ripAmp * 0.6
    }
    // Round and round inside the funnel (wherever it's gone), climbing it.
    if (caught > 0) {
      const ang = Math.atan2(oz - s.pz, ox - s.px) + (3.4 + r1 * 2.8) * whirl
      const hv = Math.min(0.94, (0.05 + 0.88 * climb) * (0.75 + r3 * 0.4))
      const orbit = radius * funnelProfile(hv) * (0.5 + r2 * 0.42) * (1 + 0.12 * Math.sin(now * 0.004 + j))
      _target.set(p.x + Math.cos(ang) * orbit, p.y + height * hv, p.z + Math.sin(ang) * orbit)
      x += (_target.x - x) * caught
      y += (_target.y - y) * caught
      z += (_target.z - z) * caught
    }
    // Cut down to a chunk the funnel's size (a whole wall doesn't fly about), then gone at the top.
    const sx = Math.hypot(original[b], original[b + 1], original[b + 2])
    const sy = Math.hypot(original[b + 4], original[b + 5], original[b + 6])
    const sz = Math.hypot(original[b + 8], original[b + 9], original[b + 10])
    const size = Math.max(sx, sy, sz)
    const carried = Math.min(1, (chunkMax * (0.6 + r2 * 0.6)) / size)
    const k = Math.max(0.0001, (1 + (carried - 1) * cut) * fade)
    // Tumbling about its own axis, small things faster.
    _axis.set(r1 - 0.5, r2 - 0.3, r3 - 0.5).normalize()
    _q.setFromAxisAngle(_axis, (1.5 * eb + whirl * (2 + r2 * 5)) / (1 + Math.min(1, size / 8)))
    _m.compose(_p.set(x, y, z), _q, _s.set(k, k, k))
    _b.fromArray(original, b)
    _b.elements[12] = 0
    _b.elements[13] = 0
    _b.elements[14] = 0
    _m.multiply(_b).toArray(array, b)
  }
  mesh.instanceMatrix.addUpdateRange(start * 16, count * 16)
  mesh.instanceMatrix.needsUpdate = true
  return true
}

/** The cheap way, past the frame's box budget: the object flies in whole. */
function swallowWhole(view, o, s, t) {
  const p = runtime.player.position
  const radius = runtime.tornado.radius
  const height = runtime.tornado.height
  const e = t * t
  const spin = t * (5 + 3 / Math.max(0.6, o.r))
  const pull = Math.min(1, e * 1.25)
  const orbit = radius * 0.7 * (1 - e)
  _target.set(p.x + Math.cos(spin) * orbit, 0, p.z + Math.sin(spin) * orbit)
  _target.x += (s.fx - _target.x) * (1 - pull)
  _target.z += (s.fz - _target.z) * (1 - pull)
  _target.y = height * (0.12 + 0.5 * e) * pull
  const scale = Math.max(0.05, 1 - e * 0.95)
  _a.makeTranslation(-s.fx, 0, -s.fz)
  _b.makeRotationY(spin * 0.6)
  _m.makeScale(scale, scale, scale)
  _b.multiply(_m).multiply(_a)
  _a.makeTranslation(_target.x, _target.y, _target.z)
  _a.multiply(_b)
  setObjectMatrix(view, o.n, _a, true)
}

/**
 * A big thing in your funnel, `progress` (0-1) of the way to breaking: it shakes harder
 * and harder, and its upper parts start to lift loose and twist.
 */
function tearBoxes(view, o, progress, now) {
  const chunk = view.ranges[o.n * 3]
  if (chunk < 0) return
  const start = view.ranges[o.n * 3 + 1]
  const count = view.ranges[o.n * 3 + 2]
  const mesh = view.chunks[chunk]
  const original = view.original[chunk]
  const array = mesh.instanceMatrix.array
  const top = 2 + o.r * 2
  const amp = (0.06 + 0.3 * progress) * (0.6 + o.r * 0.08)
  for (let i = start, j = 0; i < start + count; i += 1, j += 1) {
    const e = i * 16
    const ox = original[e + 12]
    const oy = original[e + 13]
    const oz = original[e + 14]
    const up = Math.min(1, Math.max(0, oy) / top)
    const a = amp * (0.35 + up)
    const r1 = hash(o.id * 131 + j * 17)
    const x = ox + Math.sin(now * 0.067 + j * 1.9) * a
    const z = oz + Math.cos(now * 0.059 + j * 2.7) * a
    const y = oy + progress * progress * up * (0.4 + o.r * 0.12) * (0.5 + r1) + Math.abs(Math.sin(now * 0.045 + j)) * a * 0.4
    _axis.set(r1 - 0.5, 0.6, hash(o.id * 131 + j * 17 + 2) - 0.5).normalize()
    _q.setFromAxisAngle(_axis, Math.sin(now * 0.021 + j) * 0.12 * progress * up)
    _m.compose(_p.set(x, y, z), _q, _s.set(1, 1, 1))
    _b.fromArray(original, e)
    _b.elements[12] = 0
    _b.elements[13] = 0
    _b.elements[14] = 0
    _m.multiply(_b).toArray(array, e)
  }
  mesh.instanceMatrix.addUpdateRange(start * 16, count * 16)
  mesh.instanceMatrix.needsUpdate = true
}

const viewOf = (id) => views.get(Math.floor(id / 1000))

/** Whether object `id` is there to be swallowed right now (on this client). */
export const isPresent = (id) => {
  const s = objects.get(id)
  return !s || s.phase === 'pop'
}

function startAbsorb(o, now, confirmed) {
  tearing.delete(o.id)
  stateFor(o.id, 'absorb', now, confirmed, o.x, o.z)
  emit('shatter', o)
}

/**
 * The server says these were swallowed (an 'absorb' event): confirm the predictions,
 * start the ones it took that we didn't predict, and note when each comes back.
 */
export function confirmAbsorbed(ids, now = performance.now()) {
  for (const id of ids) {
    const o = objectById(id)
    if (!o) continue
    const s = objects.get(id)
    if (s && s.phase === 'absorb') s.confirmed = true
    else if (s && s.phase === 'down') s.confirmed = true
    else startAbsorb(o, now, true)
    objects.get(id).until = now + o.respawn * 1000 + 250
    dropContact(id)
    if (o.size === 'huge' || o.size === 'trophy' || o.size === 'landmark') emit('bigBroken', o)
  }
}

/** Everything comes back (a reconnect: the new server session has every city whole). */
export function resetCityState() {
  for (const [id] of objects) {
    const view = viewOf(id)
    if (view) restoreObject(view, id % 1000)
  }
  for (const id of tearing) {
    const view = viewOf(id)
    if (view) restoreObject(view, id % 1000)
  }
  tearing.clear()
  for (const [id] of [...objects]) dropState(id)
  contact.clear()
  emit('reset')
}

/** Spare contact records, reused so the frame loop never allocates one. */
const spareContacts = []
function dropContact(id) {
  const c = contact.get(id)
  if (!c) return
  contact.delete(id)
  if (spareContacts.length < 256) spareContacts.push(c)
}

/**
 * Once a frame: tear at everything your funnel is over (predicting what breaks), tear
 * apart everything it's swallowing, bring back what's due, and shake whatever you're
 * tearing at - harder the closer it is to breaking.
 */
export function updateCity(now, delta) {
  const { profile } = getGame()
  const p = runtime.player.position
  const radius = runtime.tornado.radius
  let budget = getQuality().shatterBoxes
  let tears = 0

  // --- Tear at what's in reach (predicting the server) --------------------------------
  const stage = stageAt(p.x, p.z)
  // The wind that makes everything near the funnel lean and shudder (materials.js).
  stormWind.value.set(p.x, p.z, radius * 1.05, stage >= 0 ? 1 : 0)
  if (stage >= 0 && stage <= profile.unlocked && views.has(stage)) {
    const layout = stageLayout(stage)
    forObjectsNear(layout, p.x, p.z, p.x, p.z, radius + 1, (o) => {
      const d = Math.hypot(o.x - p.x, o.z - p.z)
      if (d > reachFor(radius, o) - PREDICT_MARGIN) return
      if (!isPresent(o.id)) return
      const speed = tearSpeed(profile, o)
      let c = contact.get(o.id)
      if (!c) {
        c = spareContacts.pop() ?? { t: 0, at: 0, fxAt: 0 }
        c.t = 0
        c.fxAt = 0
        contact.set(o.id, c)
      }
      c.t = Math.min(o.hp, c.t + delta * speed)
      c.at = now
      const slow = o.hp / speed
      if (c.t >= o.hp) {
        // Quick ones go at once; slow ones (a Landmark...) shake on until the server says
        // it's broken, so nothing ever breaks here and then comes back.
        if (slow <= QUICK_TEAR) {
          dropContact(o.id)
          startAbsorb(o, now, false)
        }
        return
      }
      // Something that takes a while groans and sheds pieces as it goes.
      if (slow > 0.35 && now - c.fxAt > TEAR_FX_MS && tears < 3) {
        c.fxAt = now
        tears += 1
        emit('tear', o, c.t / o.hp)
      }
    })
  }
  for (const [id, c] of contact) if (now - c.at > HP_GRACE * 1000) dropContact(id)

  // --- Everything being torn at shakes --------------------------------------------
  for (const id of tearing) {
    if (contact.has(id) && isPresent(id)) continue
    // Let go of (or already breaking): put it back as it was.
    tearing.delete(id)
    const view = viewOf(id)
    if (view && isPresent(id)) restoreObject(view, id % 1000)
  }
  for (const [id, c] of contact) {
    const view = viewOf(id)
    if (!view || !isPresent(id)) continue
    const o = objectById(id)
    if (!o) continue
    // Shakes while you hold it, settling once you've moved off it.
    const hold = 1 - clamp01((now - c.at) / 600)
    const boxes = view.ranges[o.n * 3 + 2]
    if (hold <= 0 || boxes > budget) {
      if (tearing.delete(id)) restoreObject(view, id % 1000)
      continue
    }
    budget -= boxes
    tearing.add(id)
    tearBoxes(view, o, (c.t / o.hp) * hold, now)
  }

  // --- Animate -----------------------------------------------------------------------
  for (const view of views.values()) view.active.fill(0)
  for (const [id, s] of objects) {
    const view = viewOf(id)
    const n = id % 1000
    if (s.phase === 'absorb') {
      const o = objectById(id)
      const e = now - s.t0
      if (!s.confirmed && e > PREDICT_TIMEOUT) {
        // Never confirmed: the server didn't count it. Back it comes.
        if (view) restoreObject(view, n)
        dropState(id)
        emit('back', id)
        continue
      }
      // Burst into its boxes if this frame's budget has room for them, or else fly in whole
      // (decided once: it never switches mid-flight).
      if (!s.mode) {
        const boxes = view ? view.ranges[n * 3 + 2] : 0
        s.mode = view && boxes <= budget ? 'burst' : 'whole'
      }
      let going
      if (s.mode === 'burst') {
        if (view) budget -= view.ranges[n * 3 + 2]
        going = view ? shatterBoxes(view, o, s, e, now) : e < CATCH_MS[o.size] * 0.4 + orbitMs(o)
      } else {
        going = e < WHOLE_MS
        if (going && view) swallowWhole(view, o, s, e / WHOLE_MS)
      }
      if (!going) {
        if (view) setObjectMatrix(view, n, _zero)
        s.phase = 'down'
        emit('swallowed', o)
      }
    } else if (s.phase === 'down') {
      if (!s.confirmed && now - s.t0 > PREDICT_TIMEOUT + orbitMs(objectById(id))) {
        // Never confirmed: the server didn't count it. Back it comes.
        if (view) restoreObject(view, n)
        dropState(id)
        emit('back', id)
      } else if (s.confirmed && now >= s.until) {
        s.phase = 'pop'
        s.t0 = now
        emit('back', id)
      }
    } else if (s.phase === 'pop') {
      const t = (now - s.t0) / POP_MS
      if (t >= 1) {
        if (view) restoreObject(view, n)
        dropState(id)
        continue
      }
      if (!view) continue
      const o = objectById(id)
      const k = t < 0.7 ? (t / 0.7) * 1.12 : 1.12 - ((t - 0.7) / 0.3) * 0.12
      _a.makeTranslation(-o.x, 0, -o.z)
      _m.makeScale(k, k, k)
      _b.makeTranslation(o.x, 0, o.z).multiply(_m).multiply(_a)
      setObjectMatrix(view, n, _b, true)
    }
  }

  // --- Chunks with pieces whirling in your funnel: their bounds stretch over it -----
  _storm.center.set(p.x, p.y + runtime.tornado.height * 0.5, p.z)
  _storm.radius = runtime.tornado.height * 0.6 + radius * 1.2
  for (const view of views.values()) {
    for (let c = 0; c < view.chunks.length; c += 1) {
      const sphere = view.chunks[c].boundingSphere
      if (!sphere) continue
      sphere.copy(view.bounds[c])
      if (view.active[c]) sphere.union(_storm)
    }
  }
}

/** How far along tearing up big thing `id` is (0-1), on this client. */
export function contactProgress(o) {
  const c = contact.get(o.id)
  return c ? Math.min(1, c.t / o.hp) : 0
}
