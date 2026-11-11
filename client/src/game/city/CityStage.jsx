import { useThree } from '@react-three/fiber'
import { useEffect, useState } from 'react'
import { Group, Sphere } from 'three'

import { STAGES } from '@shared/balance'
import { KINDS, LOT, payStep, PLAZA_RADIUS, ROAD, ROAD_AT, stageLayout, THEMES } from '@shared/cities'
import { formatNumber } from '@shared/format'
import { BRIDGE_HALF, BRIDGE_LEN, gateZ, STAGE_HALF } from '@shared/world'

import { getGame, useGame } from '../../store/game'
import { getQuality } from '../../store/quality'
import { BlockSet, disposeBlocks } from '../blocks'
import { LabelBatch } from '../labels/LabelBatch'
import { TEXT } from '../labels/lobbyLabels'
import { sharedMaterials, STYLE, STYLE_SWAY } from '../materials'
import { registerStageView, unregisterStageView } from './cityState'
import { buildKind } from './kinds'

/**
 * One city island, built from its layout (shared/cities.js): the ground, streets, lots,
 * plaza, bridge and gate in one InstancedMesh, and everything that can be swallowed in a
 * 3 x 3 grid of InstancedMeshes (each frustum-culled on its own), every object's boxes
 * kept together so it can be animated and hidden alone (cityState). The gate's sign and
 * the trophies' and landmark's labels are a LabelBatch of their own.
 *
 * Built in the browser's idle time when the city comes near (StageManager mounts it),
 * everything disposed when it goes: only the city you're in and its neighbours exist.
 */

const CHUNKS = 3
const CHUNK = (STAGE_HALF * 2) / CHUNKS
const SIDEWALK = '#c8ccd4'
const LINE = '#ffd21f'
const GATE_COLORS = ['#2f8ae8', '#ff5a3a', '#ffc21f', '#3fbf4a', '#b15cff', '#ff5fa8', '#22c8d8']


/** The island, streets, lots, plaza, trophy circles, bridge and gate: everything that stays put. */
function buildStatic(index, layout) {
  const t = THEMES[layout.theme]
  const set = new BlockSet()
  const cz = layout.cz
  const asphalt = t.roadStyle === 'asphalt'

  // The island: a slab of ground, cliffs dropping into the sea all round.
  set.add(0, -0.6, cz, STAGE_HALF * 2, 1.2, STAGE_HALF * 2, t.ground, STYLE.STUDS)
  for (const side of [-1, 1]) {
    set.add(side * (STAGE_HALF - 1.5), -3.2, cz, 3, 4.2, STAGE_HALF * 2, t.edge, STYLE.HILL)
    set.add(0, -3.2, cz + side * (STAGE_HALF - 1.5), STAGE_HALF * 2 - 6, 4.2, 3, t.edge, STYLE.HILL)
  }
  // The walkway round the edge.
  for (const side of [-1, 1]) {
    set.add(0, 0.03, cz + side * 68, 136, 0.06, 4, t.road, asphalt ? STYLE.ROAD : STYLE.STUDS)
    set.add(side * 68, 0.03, cz, 4, 0.06, 136, t.road, asphalt ? STYLE.ROAD : STYLE.STUDS)
  }

  // The lots, each with ground that says what it is.
  for (const lot of layout.lots) {
    const ground = lot.type === 'parking' ? '#4a4e5a' : lot.type === 'plaza' || lot.type === 'towers' ? '#e2e4ea' : lot.type === 'field' ? t.field : t.lot
    const style = lot.type === 'parking' ? STYLE.ROAD : lot.type === 'plaza' || lot.type === 'towers' ? STYLE.CHECKER : STYLE.STUDS
    set.add(lot.x, 0.05, lot.z, LOT, 0.1, LOT, ground, style)
    if (lot.type === 'field') {
      for (let r = 0; r < 6; r += 1) set.add(lot.x, 0.12, lot.z - 11.25 + r * 4.5, LOT - 2, 0.1, 1.6, '#6a4a2a', STYLE.STUDS)
    } else if (lot.type === 'parking') {
      for (let i = 0; i < 6; i += 1) {
        const along = Math.abs(lot.x) > Math.abs(lot.z - cz)
        const a = -12 + i * 4.8
        if (along) set.add(lot.x, 0.11, lot.z + a, 9, 0.02, 0.2, '#ffffff', STYLE.SMOOTH)
        else set.add(lot.x + a, 0.11, lot.z, 0.2, 0.02, 9, '#ffffff', STYLE.SMOOTH)
      }
    } else if (lot.type === 'park' || lot.type === 'plaza') {
      set.add(lot.x, 0.11, lot.z, 3, 0.04, LOT - 2, t.road, STYLE.STUDS)
      set.add(lot.x, 0.11, lot.z, LOT - 2, 0.04, 3, t.road, STYLE.STUDS)
    }
  }

  // The streets: three across, three along.
  for (const at of [-ROAD_AT, 0, ROAD_AT]) {
    set.add(at, 0.04, cz, ROAD, 0.08, 136, t.road, asphalt ? STYLE.ROAD : STYLE.STUDS)
    set.add(0, 0.045, cz + at, 136, 0.08, ROAD, t.road, asphalt ? STYLE.ROAD : STYLE.STUDS)
    if (asphalt) {
      for (let z = -64; z <= 64; z += 5) {
        if (Math.abs(Math.abs(z) - ROAD_AT) < 5 || Math.abs(z) < 5) continue
        set.add(at, 0.09, cz + z, 0.25, 0.02, 2.2, LINE, STYLE.SMOOTH)
        set.add(z, 0.09, cz + at, 2.2, 0.02, 0.25, LINE, STYLE.SMOOTH)
      }
      for (const side of [-1, 1]) {
        set.add(at + side * (ROAD / 2 + 0.6), 0.08, cz, 1.2, 0.16, 136, SIDEWALK, STYLE.STUDS)
        set.add(0, 0.085, cz + at + side * (ROAD / 2 + 0.6), 136, 0.16, 1.2, SIDEWALK, STYLE.STUDS)
      }
    }
  }

  // The landmark's plaza and the trophies' circles.
  const plaza = (x, z, r, color, rim) => {
    const w = r * 1.66
    set.add(x, 0.16, z, w, 0.18, w, color, STYLE.CHECKER)
    set.add(x, 0.16, z, w, 0.18, w, color, STYLE.CHECKER, Math.PI / 4)
    set.add(x, 0.27, z, w + 0.4, 0.06, 0.4, rim, STYLE.GLOW)
  }
  plaza(0, cz, PLAZA_RADIUS + 1, '#f2ead8', '#ffd21f')
  for (const n of layout.trophies) {
    const o = layout.objects[n]
    plaza(o.x, o.z, 5.4, '#fff4cc', '#ffc21f')
  }

  // The bridge in, over the sea, and the gate over its end.
  const gz = gateZ(index)
  const bz = gz + BRIDGE_LEN / 2
  set.add(0, -0.5, bz, BRIDGE_HALF * 2, 1, BRIDGE_LEN, '#c8ccd4', STYLE.PLATE)
  set.add(0, 0.02, bz, BRIDGE_HALF * 2 - 3, 0.04, BRIDGE_LEN, t.road, asphalt ? STYLE.ROAD : STYLE.STUDS)
  for (const side of [-1, 1]) {
    set.add(side * (BRIDGE_HALF - 0.3), 0, bz, 0.5, 1.1, BRIDGE_LEN, '#ffffff', STYLE.STRIPES)
    for (let k = 0; k < 3; k += 1) set.add(side * (BRIDGE_HALF - 1.5), -4.5, gz + 5 + k * 10, 2, 4, 2, '#8a8e9a', STYLE.STUDS)
  }
  const gate = GATE_COLORS[index % GATE_COLORS.length]
  for (const side of [-1, 1]) {
    set.add(side * (BRIDGE_HALF + 2.4), 6, gz, 3.6, 12, 3.6, gate, STYLE.STRIPES)
    set.add(side * (BRIDGE_HALF + 2.4), 12.6, gz, 4.2, 1.2, 4.2, '#ffffff', STYLE.STUDS)
    set.add(side * (BRIDGE_HALF + 2.4), 13.8, gz, 1.6, 1.6, 1.6, '#ffe27a', STYLE.GLOW)
  }
  set.add(0, 12.6, gz, BRIDGE_HALF * 2 + 8, 2.4, 2.4, gate, STYLE.STUDS)
  set.add(0, 14.4, gz, BRIDGE_HALF * 2 + 2, 1.2, 1.6, '#ffffff', STYLE.STUDS)

  const mesh = set.build(sharedMaterials().blocks)
  return mesh
}

/**
 * Everything that can be swallowed, in CHUNKS x CHUNKS meshes. Returns the meshes, each
 * object's (chunk, first box, box count), a copy of every mesh's matrices as built (to
 * put things back after they've been swallowed or wobbled) and of their bounds.
 */
function buildObjects(index, layout) {
  const sets = Array.from({ length: CHUNKS * CHUNKS }, () => new BlockSet())
  const ranges = new Int32Array(layout.objects.length * 3).fill(-1)
  for (const o of layout.objects) {
    const cx = Math.min(CHUNKS - 1, Math.max(0, Math.floor((o.x + STAGE_HALF) / CHUNK)))
    const cz = Math.min(CHUNKS - 1, Math.max(0, Math.floor((o.z - layout.cz + STAGE_HALF) / CHUNK)))
    const chunk = cz * CHUNKS + cx
    const set = sets[chunk]
    const start = set.count
    const cos = Math.cos(o.rot)
    const sin = Math.sin(o.rot)
    const k = o.s
    const put = (lx, base, lz, w, h, d, color, style = STYLE.STUDS, ry = 0, rz = 0, rx = 0) => {
      // STYLE_SWAY: it leans and shakes in your tornado's wind (materials.js).
      set.add(o.x + (lx * cos + lz * sin) * k, (base + h / 2) * k, o.z + (-lx * sin + lz * cos) * k, w * k, h * k, d * k, color, style + STYLE_SWAY, o.rot + ry, rx, rz)
    }
    const kind = o.size === 'landmark' ? { arch: 'landmark', v: layout.theme } : KINDS[o.kind]
    buildKind(put, kind)
    ranges[o.n * 3] = chunk
    ranges[o.n * 3 + 1] = start
    ranges[o.n * 3 + 2] = set.count - start
  }
  const chunks = sets.map((set) => {
    const mesh = set.build(sharedMaterials().blocks)
    // Bounds that also cover anything thrown up out of it, so it isn't culled mid-burst.
    if (mesh.boundingSphere) mesh.boundingSphere = new Sphere(mesh.boundingSphere.center.clone(), mesh.boundingSphere.radius + 12)
    return mesh
  })
  const original = chunks.map((m) => m.instanceMatrix.array.slice())
  // Each chunk's bounds as built: cityState stretches them over your tornado while pieces
  // of the chunk are whirling in it, so they aren't culled when you've carried them off.
  const bounds = chunks.map((m) => m.boundingSphere.clone())
  return { chunks, ranges, original, bounds, active: new Uint8Array(chunks.length) }
}

/** The gate's sign: the city's number and name, and its level (or LOCKED). */
function gateSpec(index, unlocked) {
  const s = STAGES[index]
  const lines = [
    { text: `STAGE ${index + 1}`, size: 70, gradient: TEXT.white },
    { text: s.name, size: 54, gradient: TEXT.gold },
  ]
  if (index > unlocked) lines.push({ text: `LOCKED - Reach Level ${s.level}`, size: 44, icon: 'lock', gradient: TEXT.red })
  else lines.push({ text: `Destroy ${payStep(index)} things: +${formatNumber(s.wins)} Wins`, size: 38, icon: 'trophy', gradient: TEXT.price })
  return { lines, pxPerUnit: 26 }
}

function buildLabels(index, layout, unlocked) {
  // The city's signs are big: they fade away before the camera gets close enough for one to fill the view.
  const batch = new LabelBatch({ pageSize: Math.min(1024, getQuality().maxTexture), nearFade: 26 })
  const s = STAGES[index]
  const gz = gateZ(index)
  batch.add('gate', [0, 18.5, gz], gateSpec(index, unlocked), { fade: 160, reserve: gateSpec(index, -1) })
  for (const n of layout.trophies) {
    const o = layout.objects[n]
    batch.add(`o${n}`, [o.x, 10.5, o.z], {
      lines: [
        { text: 'GIANT TROPHY', size: 44, gradient: TEXT.gold },
        { text: 'Huge Power!', size: 36, icon: 'bolt', gradient: TEXT.white },
      ],
      pxPerUnit: 34,
    }, { fade: 120 })
  }
  const lm = layout.objects[layout.landmark]
  batch.add(`o${lm.n}`, [0, 32, lm.z], {
    lines: [
      { text: s.landmark.name.toUpperCase(), size: 52, gradient: TEXT.blue },
      { text: 'LANDMARK', size: 36, gradient: TEXT.white },
    ],
    pxPerUnit: 26,
  }, { fade: 170 })
  return batch
}

export function CityStage({ index }) {
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  const scene = useThree((s) => s.scene)
  const unlocked = useGame((s) => s.profile.unlocked)
  const [built, setBuilt] = useState(null)
  const [labels, setLabels] = useState(null)

  // Built when the browser's idle, so a city coming into view never costs a frame.
  useEffect(() => {
    let cancelled = false
    let made = null
    const build = () => {
      if (cancelled) return
      const layout = stageLayout(index)
      const statics = buildStatic(index, layout)
      const objects = buildObjects(index, layout)
      made = { statics, ...objects }
      setBuilt(made)
    }
    const id = 'requestIdleCallback' in window ? requestIdleCallback(build, { timeout: 400 }) : setTimeout(build, 30)
    return () => {
      cancelled = true
      if ('cancelIdleCallback' in window) cancelIdleCallback(id)
      else clearTimeout(id)
      if (made) {
        disposeBlocks(made.statics)
        for (const m of made.chunks) disposeBlocks(m)
      }
    }
  }, [index])

  useEffect(() => {
    if (!built) return undefined
    registerStageView(index, built)
    return () => unregisterStageView(index)
  }, [built, index])

  // The signs, once the city's up (the font and an atlas page, async).
  useEffect(() => {
    if (!built) return undefined
    let cancelled = false
    const batch = buildLabels(index, stageLayout(index), getGame().profile.unlocked)
    batch
      .build()
      .then((meshes) => (!cancelled && meshes.length && !import.meta.env.DEV ? gl.compileAsync(new Group().add(...meshes), camera, scene).catch(() => null) : null))
      .then(() => {
        if (cancelled) return
        batch.setMaxDistance(getQuality().labelDistance + 60)
        setLabels(batch)
      })
    return () => {
      cancelled = true
      setLabels(null)
      batch.dispose()
    }
  }, [built, index, gl, camera, scene])

  // A gate opening (or a rebirth on a fresh save) redraws its sign.
  useEffect(() => {
    labels?.update('gate', gateSpec(index, unlocked))
  }, [labels, unlocked, index])

  if (!built) return null
  const shadows = getQuality().shadows === 'realtime'
  return (
    <>
      <primitive object={built.statics} receiveShadow={shadows} />
      {built.chunks.map((mesh) => (
        <primitive key={mesh.uuid} object={mesh} castShadow={shadows} receiveShadow={shadows} />
      ))}
      {labels?.meshes.map((mesh) => <primitive key={mesh.uuid} object={mesh} />)}
    </>
  )
}

export default CityStage

