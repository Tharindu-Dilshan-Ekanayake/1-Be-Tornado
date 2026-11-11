import { useEffect, useMemo } from 'react'
import { Color, Euler, Matrix4, Quaternion, Vector3 } from 'three'

import { KINDS } from '@shared/cities'

import { getQuality } from '../../store/quality'
import { createBoxInstances, disposeBlocks, toColor } from '../blocks'
import { sharedMaterials, STYLE } from '../materials'
import { onCity } from './cityState'

/**
 * The wreckage your tornado leaves: where something was torn up, a scorched patch of
 * ground and a few broken chunks in its colours stay until it comes back, so a path of
 * destruction trails behind you through the city.
 *
 * One InstancedMesh of boxes (one draw call, hidden when there's none), a fixed pool
 * reused oldest-first (`rubble` in the quality preset: how much of it is used). Nothing
 * moves, so it costs nothing a frame: boxes are written only when something breaks or
 * comes back.
 */

const MAX = 320
/** Broken chunks per thing torn up (plus a scorched patch for anything bigger than tiny). */
const CHUNKS = { tiny: 1, small: 2, medium: 3, large: 4, huge: 5, trophy: 4, landmark: 9 }
/** How high the ground under it is: trophies and landmarks stand on plazas. */
const BASE = { trophy: 0.25, landmark: 0.25 }
const SCORCH = new Color('#6e6052')
const STONE = ['#8a8e9a', '#b8b0a0', '#6d6a64']

const _m = new Matrix4()
const _q = new Quaternion()
const _e = new Euler()
const _p = new Vector3()
const _s = new Vector3()
const _c = new Color()
const _zero = new Matrix4().makeScale(0, 0, 0)

const state = { mesh: null, owners: new Int32Array(MAX).fill(-1), next: 0, used: 0 }

function put(id, x, y, z, sx, sy, sz, rx, ry, rz, color) {
  const mesh = state.mesh
  const cap = Math.min(MAX, getQuality().rubble)
  const i = state.next % cap
  state.next = (i + 1) % cap
  if (state.owners[i] < 0) state.used += 1
  state.owners[i] = id
  _q.setFromEuler(_e.set(rx, ry, rz))
  mesh.setMatrixAt(i, _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz)))
  mesh.setColorAt(i, color)
}

function flush() {
  const mesh = state.mesh
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  mesh.visible = state.used > 0
}

function spawn(o) {
  if (!state.mesh || !getQuality().rubble) return
  const base = BASE[o.size] ?? 0.1
  const r = o.r
  if (o.size !== 'tiny') {
    const w = Math.min(11, 0.6 + r * 1.15)
    put(o.id, o.x, base + 0.04, o.z, w, 0.08, w * (0.85 + Math.random() * 0.3), 0, Math.random() * Math.PI, 0, SCORCH)
  }
  const colors = KINDS[o.kind]?.c ?? STONE
  const scale = Math.min(2.6, Math.max(0.35, r * 0.5))
  const n = CHUNKS[o.size] ?? 2
  for (let k = 0; k < n; k += 1) {
    const a = Math.random() * Math.PI * 2
    const d = Math.random() * r * 0.55
    const sx = (0.3 + Math.random() * 0.5) * scale
    const sy = (0.15 + Math.random() * 0.35) * scale
    const sz = (0.3 + Math.random() * 0.5) * scale
    _c.copy(toColor(colors[k % colors.length])).multiplyScalar(0.5 + Math.random() * 0.15)
    put(o.id, o.x + Math.cos(a) * d, base + sy * 0.4, o.z + Math.sin(a) * d, sx, sy, sz, (Math.random() - 0.5) * 0.6, Math.random() * Math.PI, (Math.random() - 0.5) * 0.6, _c)
  }
  flush()
}

/** Clears the pieces of object `id` (by 'id'), of every object in stage `id` (by 'stage'), or all. */
function clear(by, id = -1) {
  if (!state.mesh || !state.used) return
  let changed = false
  for (let i = 0; i < MAX; i += 1) {
    const owner = state.owners[i]
    if (owner < 0) continue
    if (by === 'id' && owner !== id) continue
    if (by === 'stage' && Math.floor(owner / 1000) !== id) continue
    state.owners[i] = -1
    state.used -= 1
    state.mesh.setMatrixAt(i, _zero)
    changed = true
  }
  if (changed) flush()
}

const onBack = (id) => clear('id', id)
const onReset = () => clear('all')
const onStageGone = (index) => clear('stage', index)

export function Rubble() {
  const mesh = useMemo(() => {
    const m = createBoxInstances(MAX, sharedMaterials().toy, STYLE.STUDS)
    m.count = MAX
    m.visible = false
    return m
  }, [])

  useEffect(() => {
    state.mesh = mesh
    state.owners.fill(-1)
    state.used = 0
    state.next = 0
    const off = [
      onCity('shatter', spawn),
      onCity('back', onBack),
      onCity('reset', onReset),
      onCity('stageGone', onStageGone),
    ]
    return () => {
      for (const f of off) f()
      state.mesh = null
      disposeBlocks(mesh)
    }
  }, [mesh])

  return <primitive object={mesh} />
}

export default Rubble
