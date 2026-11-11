import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Euler, Matrix4, Quaternion, Vector3 } from 'three'

import { remotePlayers } from '../../net/remotePlayers'
import { useQuality } from '../../store/quality'
import { createBoxInstances, disposeBlocks } from '../blocks'
import { onCity } from '../city/cityState'
import { sharedMaterials, STYLE } from '../materials'
import { runtime } from '../runtime'
import { debrisMesh, DUST, onShatter, onTear, owned, ownerOf, pieces, POOL, spawnDebris } from './debrisPool'
import { TORNADO_COLORS } from './funnel'

/**
 * Bricks whirling round every tornado: whatever you tear apart throws out pieces in its
 * own colours (and chips fly off big things while you tear at them), which the wind then
 * catches and spirals up your funnel; every tornado keeps a few chunks of dust and rubble
 * going round it so it always looks busy. One InstancedMesh over a fixed pool
 * (debrisPool.js). Off on LOW (no particles there): the objects' own boxes still burst
 * apart (cityState), and the funnel's shader draws its specks of debris by itself.
 */

/** Each tornado type's debris colours: its specks' colour among the dust. Built once. */
const REMOTE_DUST = Object.fromEntries(Object.entries(TORNADO_COLORS).map(([id, c]) => [id, [`#${c[2].getHexString()}`, ...DUST]]))

const _m = new Matrix4()
const _q = new Quaternion()
const _e = new Euler()
const _p = new Vector3()
const _f = new Vector3()
const _s = new Vector3()

export function Debris() {
  const enabled = useQuality((s) => s.settings.debris > 0)
  const ref = useRef(null)
  const ambient = useRef(0)

  const mesh = useMemo(() => {
    const m = createBoxInstances(POOL, sharedMaterials().toy, STYLE.STUDS)
    m.count = POOL
    return m
  }, [])

  useEffect(() => {
    debrisMesh.current = mesh
    const offShatter = onCity('shatter', onShatter)
    const offTear = onCity('tear', onTear)
    return () => {
      debrisMesh.current = null
      offShatter()
      offTear()
      for (const p of pieces) p.life = 0
      owned.clear()
      disposeBlocks(mesh)
    }
  }, [mesh])

  useFrame((_state, rawDelta) => {
    const m = ref.current
    if (!m) return
    m.visible = enabled
    if (!enabled) return
    const delta = Math.min(rawDelta, 0.05)

    // A few chunks always round every tornado: yours and the others in view.
    ambient.current += delta
    if (ambient.current > 0.3) {
      ambient.current = 0
      const mine = 3 + Math.round(runtime.tornado.radius)
      if ((owned.get('me') || 0) < mine) spawnDebris('me', 1, DUST, null, 0.3, 6)
      for (const r of remotePlayers.values()) {
        const want = 3 + Math.round(r.radius)
        if ((owned.get(r.sessionId) || 0) >= want) continue
        spawnDebris(r.sessionId, 1, REMOTE_DUST[r.tornado] ?? DUST, null, 0.32, 6)
      }
    }

    let alive = false
    for (let i = 0; i < POOL; i += 1) {
      const p = pieces[i]
      if (p.life <= 0) continue
      const o = ownerOf(p.owner)
      p.age += delta
      if (!o || p.age >= p.life) {
        p.life = 0
        owned.set(p.owner, Math.max(0, (owned.get(p.owner) || 1) - 1))
        m.setMatrixAt(i, _m.makeScale(0, 0, 0))
        alive = true
        continue
      }
      alive = true
      const t = p.age / p.life
      p.angle += p.speed * delta * (p.owner === 'me' ? runtime.tornado.spin : 1)
      const v = Math.min(0.92, p.rise + t * 0.8)
      const r = (0.28 + 0.78 * v) * o.radius * p.rFrac
      _p.set(o.x + Math.cos(p.angle) * r, o.y + v * o.height * 0.85, o.z + Math.sin(p.angle) * r)
      // Flying free from where it was thrown (falling a little) until the wind takes it.
      const blend = Math.min(1, p.age / p.blend)
      if (blend < 1) {
        const a = p.age
        _f.set(p.from.x + p.vel.x * a, Math.max(0.15, p.from.y + (p.vel.y - 5 * a) * a), p.from.z + p.vel.z * a)
        _p.lerp(_f, 1 - blend * blend)
      }
      p.rot.addScaledVector(p.spin, delta)
      _q.setFromEuler(_e.set(p.rot.x, p.rot.y, p.rot.z))
      const fade = t > 0.85 ? (1 - t) / 0.15 : 1
      _s.setScalar(p.size * fade)
      m.setMatrixAt(i, _m.compose(_p, _q, _s))
    }
    if (alive) m.instanceMatrix.needsUpdate = true
  })

  return <primitive ref={ref} object={mesh} />
}

export default Debris
