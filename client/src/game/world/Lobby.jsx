import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import { Matrix4, Quaternion, Vector3 } from 'three'

import { RARITIES, TORNADOES } from '@shared/balance'
import { mulberry32 } from '@shared/rng'
import { BRIDGE_HALF, LOBBY, LOBBY_GATE, PAD_COUNT, PAD_RADIUS, PAD_X, padCenterZ, SPAWN, TORNADO_STANDS } from '@shared/world'

import { useQuality } from '../../store/quality'
import { BlockSet, disposeBlocks } from '../blocks'
import { glowTime } from '../glow'
import { PAD_COLORS } from '../labels/lobbyLabels'
import { sharedMaterials, STYLE, toyTime } from '../materials'
import { createRingMesh, disposeTornadoMesh, flushTornadoAttributes, writeTornado } from '../tornado/funnel'
import { buildEggStands } from './eggs'

/** The island is this much bigger than the walkable lobby all round: room for the towers. */
const RIM = 8
const TOWER_COLORS = ['#ff7a9a', '#ffb347', '#ffe066', '#7ae86a', '#5fd8ff', '#8a9aff', '#d08aff', '#ff8ad8']
/** Which tornado's colours each Storm Zone's swirl takes. */
const PAD_SWIRLS = ['frost', 'leaf', 'sand', 'fire', 'candy', 'galaxy', 'rainbow']

/** Everything in the lobby that stays put, as one BlockSet. */
function buildLobby({ density }) {
  const set = new BlockSet()
  const rand = mulberry32(77)
  const w = LOBBY.maxX - LOBBY.minX + RIM * 2
  const d = LOBBY.maxZ - LOBBY.minZ + RIM * 2

  // The floor, the island's cliffs into the sea, and the path from the spawn to the gate.
  set.add(0, -0.6, 0, w, 1.2, d, '#dfe6f6', STYLE.CHECKER)
  for (const side of [-1, 1]) {
    set.add(side * (w / 2 - 1.5), -3.2, 0, 3, 4.2, d, '#8a6a4a', STYLE.HILL)
    set.add(0, -3.2, side * (d / 2 - 1.5), w - 6, 4.2, 3, '#8a6a4a', STYLE.HILL)
  }
  set.add(0, 0.05, (SPAWN.z + LOBBY.minZ) / 2, 12, 0.1, SPAWN.z - LOBBY.minZ + 6, '#6f7cff', STYLE.STUDS)
  for (const side of [-1, 1]) set.add(side * 6.3, 0.08, (SPAWN.z + LOBBY.minZ) / 2, 0.6, 0.12, SPAWN.z - LOBBY.minZ + 6, '#ffffff', STYLE.SMOOTH)
  // The spawn: a golden star plate.
  set.add(SPAWN.x, 0.1, SPAWN.z, 8, 0.12, 8, '#ffd21f', STYLE.GLOW)
  set.add(SPAWN.x, 0.1, SPAWN.z, 8, 0.12, 8, '#ffb000', STYLE.GLOW, Math.PI / 4)
  set.add(SPAWN.x, 0.2, SPAWN.z, 5.6, 0.04, 5.6, '#fff6c8', STYLE.SMOOTH, Math.PI / 8)

  // Toy towers all round the edge, in every colour, taller towards the back.
  const ring = []
  for (let x = LOBBY.minX - RIM + 4; x <= LOBBY.maxX + RIM - 4; x += 7) ring.push([x, LOBBY.maxZ + RIM - 4, 1])
  for (let z = LOBBY.minZ + 2; z <= LOBBY.maxZ; z += 7) {
    ring.push([LOBBY.minX - RIM + 4, z, 0.8])
    ring.push([LOBBY.maxX + RIM - 4, z, 0.8])
  }
  for (let x = LOBBY.minX - RIM + 4; x <= LOBBY.maxX + RIM - 4; x += 7) if (Math.abs(x) > BRIDGE_HALF + 8) ring.push([x, LOBBY.minZ - RIM + 4, 0.6])
  for (const [x, z, tall] of ring) {
    if (rand() > density + 0.25) continue
    const h = (5 + rand() * 12) * tall
    const color = TOWER_COLORS[Math.floor(rand() * TOWER_COLORS.length)]
    set.addOn(x, 0, z, 6, h, 6, color, STYLE.WINDOWS)
    set.addOn(x, h, z, 6.6, 0.8, 6.6, '#ffffff', STYLE.STUDS)
    if (rand() < 0.5) set.addOn(x, h + 0.8, z, 3, 1.6, 3, TOWER_COLORS[Math.floor(rand() * TOWER_COLORS.length)], STYLE.STUDS)
  }

  // The gate to the cities, over the start of the bridge.
  for (const side of [-1, 1]) {
    set.addOn(side * LOBBY_GATE.halfGap, 0, LOBBY_GATE.z, 3, 14, 3, '#ff5fa8', STYLE.STRIPES)
    set.addOn(side * LOBBY_GATE.halfGap, 14, LOBBY_GATE.z, 3.8, 1.2, 3.8, '#ffffff', STYLE.STUDS)
    set.addOn(side * LOBBY_GATE.halfGap, 15.2, LOBBY_GATE.z, 1.6, 1.6, 1.6, '#ffe27a', STYLE.GLOW)
  }
  set.addOn(0, 13.2, LOBBY_GATE.z, LOBBY_GATE.halfGap * 2 + 4, 2.2, 2.4, '#6f7cff', STYLE.STUDS)
  set.addOn(0, 15.4, LOBBY_GATE.z, LOBBY_GATE.halfGap * 2, 1, 1.8, '#ffd21f', STYLE.GLOW)

  // The tornado showroom: a stand per tornado, a glowing BUY spot on its aisle side, and
  // a wall along the back.
  for (const stand of TORNADO_STANDS) {
    const t = TORNADOES[stand.index]
    const rarity = RARITIES[t.rarity].color
    set.addOn(stand.x, 0, stand.z, 4.4, 0.7, 4.4, '#2f3f8a', STYLE.STUDS)
    set.addOn(stand.x, 0.7, stand.z, 3.8, 0.4, 3.8, rarity, STYLE.GLOW)
    set.addOn(stand.x, 1.1, stand.z, 3.2, 0.1, 3.2, '#f4f7fb', STYLE.SMOOTH)
    set.addOn(stand.spotX, 0, stand.z, 3.2, 0.08, 3.2, '#2fd84a', STYLE.GLOW)
    set.addOn(stand.spotX, 0.08, stand.z, 2.6, 0.04, 2.6, '#e8fff0', STYLE.SMOOTH)
  }
  set.addOn(-51, 0, 0, 1.4, 9, 84, '#3a4aa8', STYLE.STUDS)
  set.addOn(-51, 9, 0, 1.8, 0.8, 85, '#5fd8ff', STYLE.GLOW)

  // The Storm Zones: a round plate each, rimmed in its colour (the swirl on it is a ring mesh).
  for (let i = 0; i < PAD_COUNT; i += 1) {
    const z = padCenterZ(i)
    const r = PAD_RADIUS * 1.66
    set.addOn(PAD_X, 0, z, r, 0.16, r, '#2a3050', STYLE.STUDS)
    set.addOn(PAD_X, 0, z, r, 0.16, r, '#2a3050', STYLE.STUDS, Math.PI / 4)
    set.addOn(PAD_X, 0.16, z, r + 0.3, 0.06, 0.5, PAD_COLORS[i], STYLE.GLOW)
    set.addOn(PAD_X, 0.16, z, 0.5, 0.06, r + 0.3, PAD_COLORS[i], STYLE.GLOW)
    set.addOn(PAD_X + PAD_RADIUS + 1.6, 0, z, 0.8, 3.2, 3, '#2a3050', STYLE.STUDS)
    set.addOn(PAD_X + PAD_RADIUS + 1.6, 3.2, z, 1, 0.4, 3.2, PAD_COLORS[i], STYLE.GLOW)
  }

  buildEggStands(set)

  // Lamps down the path and round the plaza.
  for (let z = LOBBY.minZ + 6; z < SPAWN.z - 4; z += 12) {
    for (const side of [-1, 1]) {
      set.addOn(side * 8.5, 0, z, 0.3, 4.2, 0.3, '#3a3f4a', STYLE.SMOOTH)
      set.addOn(side * 8.5, 4.2, z, 0.8, 0.6, 0.8, '#fff2a8', STYLE.GLOW)
    }
  }
  return set
}

const _m = new Matrix4()
const _q = new Quaternion()
const _p = new Vector3()
const _s = new Vector3()

/**
 * The lobby island: one InstancedMesh for every box of it (floor, cliffs, towers, gate,
 * showroom stands, Storm Zone plates, egg stands, lamps) and one for the Storm Zones'
 * swirling rings. Built once; quality only decides how many towers ring it and whether it
 * casts realtime shadows.
 */
export function Lobby() {
  const shadows = useQuality((s) => s.settings.shadows === 'realtime')
  const density = useQuality((s) => s.settings.decorDensity)

  const meshes = useMemo(() => {
    performance.mark('pp:world-start')
    const blocks = buildLobby({ density }).build(sharedMaterials().blocks)
    const swirls = createRingMesh(PAD_COUNT)
    for (let i = 0; i < PAD_COUNT; i += 1) {
      _p.set(PAD_X, 0.3, padCenterZ(i))
      _s.set(PAD_RADIUS * 2.2, 1, PAD_RADIUS * 2.2)
      swirls.setMatrixAt(i, _m.compose(_p, _q.identity(), _s))
      writeTornado(swirls, i, PAD_SWIRLS[i], i * 0.31, 1)
    }
    swirls.count = PAD_COUNT
    swirls.instanceMatrix.needsUpdate = true
    flushTornadoAttributes(swirls)
    performance.mark('pp:world-end')
    return { blocks, swirls }
  }, [density])

  useEffect(
    () => () => {
      disposeBlocks(meshes.blocks)
      disposeTornadoMesh(meshes.swirls)
    },
    [meshes],
  )

  // Drives every animated toy-material style (water, glow) and the sea.
  useFrame((state) => {
    toyTime.value = state.clock.elapsedTime
    glowTime.value = state.clock.elapsedTime
  })

  return (
    <>
      <primitive object={meshes.blocks} castShadow={shadows} receiveShadow={shadows} />
      <primitive object={meshes.swirls} />
    </>
  )
}

export default Lobby
