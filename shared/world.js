import { EGGS, PADS, STAGES, TORNADOES } from './balance.js'

/**
 * The world's layout: every gameplay-relevant position and trigger area.
 *
 * Shared by the client (which renders it) and the server (which validates positions
 * against it), so the two can never disagree about where a zone, a stand or a city is.
 *
 * Units are metres (the avatar is 1.8 tall). +X is east, -Z is north: "forward" from the
 * spawn, and the way along the chain of cities.
 *
 * The lobby is a floating island; north of it a bridge leads to the first city's gate,
 * and every city is an island of its own, each one bridge further north. Seen from the
 * spawn: the gate to the cities straight ahead, the tornado showroom on the left (west),
 * the Storm Zones on the right (east), the eggs and leaderboards behind you.
 *
 * Rects are `{ minX, maxX, minZ, maxZ }` on the ground plane.
 */

export const LOBBY = { minX: -56, maxX: 56, minZ: -46, maxZ: 46 }
export const SPAWN = { x: 0, z: 30 }

// --- Cities -------------------------------------------------------------------------

/** Half the side of every city island, the bridges between them, and how far apart. */
export const STAGE_HALF = 70
export const BRIDGE_LEN = 30
export const BRIDGE_HALF = 7
export const STAGE_PITCH = STAGE_HALF * 2 + BRIDGE_LEN
export const STAGE_COUNT = STAGES.length

/** The centre (z) of city `i`; every city is centred on x = 0. */
export const stageCenterZ = (i) => LOBBY.minZ - BRIDGE_LEN - STAGE_HALF - i * STAGE_PITCH

/** City `i`'s island. */
export function stageRect(i) {
  const cz = stageCenterZ(i)
  return { minX: -STAGE_HALF, maxX: STAGE_HALF, minZ: cz - STAGE_HALF, maxZ: cz + STAGE_HALF }
}

/** Where city `i`'s gate stands: across its bridge, at the island's south edge. */
export const gateZ = (i) => stageCenterZ(i) + STAGE_HALF

/** The bridge leading into city `i` (from the lobby, or from city i-1). */
export function bridgeRect(i) {
  const north = gateZ(i)
  const south = i === 0 ? LOBBY.minZ : stageRect(i - 1).minZ
  return { minX: -BRIDGE_HALF, maxX: BRIDGE_HALF, minZ: north, maxZ: south }
}

/** Where a teleport into city `i` puts you: just inside its gate, facing north. */
export const stageEntry = (i) => ({ x: 0, z: gateZ(i) - 32 })

/**
 * Which city (x, z) is in: its index if on its island, -1 anywhere else (the lobby, a
 * bridge, off the edge).
 */
export function stageAt(x, z) {
  if (z >= LOBBY.minZ) return -1
  const i = Math.floor((LOBBY.minZ - z) / STAGE_PITCH)
  if (i < 0 || i >= STAGE_COUNT) return -1
  const r = stageRect(i)
  return z <= r.maxZ && z >= r.minZ && Math.abs(x) <= STAGE_HALF ? i : -1
}

/**
 * The city (x, z) is nearest along the chain, for what to show: -1 in the lobby, else the
 * city whose island or bridge you're on.
 */
export function stageNear(z) {
  if (z >= LOBBY.minZ - 4) return -1
  return Math.min(STAGE_COUNT - 1, Math.max(0, Math.floor((LOBBY.minZ - z) / STAGE_PITCH)))
}

// --- Tornado showroom ----------------------------------------------------------------

/**
 * Two rows of display stands down the lobby's west side, each with a tornado spinning on
 * it: the first ten on the row nearer the middle, the next ten behind them. Standing on
 * a stand's glowing BUY spot (on the aisle side) buys or equips that tornado.
 */
const STAND_ROWS_X = [-27, -43]
const STANDS_PER_ROW = 10
const STAND_PITCH = 7.6
export const STAND_SIZE = 4.4
/** The BUY spot: this far from the stand towards the aisle, this big. */
export const BUY_SPOT_OFFSET = 4.6
export const BUY_SPOT_SIZE = 3.2

export const TORNADO_STANDS = TORNADOES.map((_, i) => {
  const row = Math.floor(i / STANDS_PER_ROW)
  const x = STAND_ROWS_X[row]
  const z = 34 - (i % STANDS_PER_ROW) * STAND_PITCH
  return { index: i, row, x, z, spotX: x + BUY_SPOT_OFFSET }
})

export const standRect = (stand) => ({
  minX: stand.x - STAND_SIZE / 2,
  maxX: stand.x + STAND_SIZE / 2,
  minZ: stand.z - STAND_SIZE / 2,
  maxZ: stand.z + STAND_SIZE / 2,
})
export const buySpotRect = (stand) => ({
  minX: stand.spotX - BUY_SPOT_SIZE / 2,
  maxX: stand.spotX + BUY_SPOT_SIZE / 2,
  minZ: stand.z - BUY_SPOT_SIZE / 2,
  maxZ: stand.z + BUY_SPOT_SIZE / 2,
})

// --- Storm Zones (training pads) ---------------------------------------------------

/** Glowing storm circles down the east side, the free one nearest the spawn. */
export const PAD_COUNT = PADS.length
export const PAD_X = 33
export const PAD_RADIUS = 3.8
const PAD0_Z = 31
const PAD_PITCH = 10.2
export const padCenterZ = (index) => PAD0_Z - index * PAD_PITCH

/** The square around pad `index`: a wall while it's locked. */
export function padRect(index) {
  const cz = padCenterZ(index)
  const r = PAD_RADIUS + 0.2
  return { minX: PAD_X - r, maxX: PAD_X + r, minZ: cz - r, maxZ: cz + r }
}

// --- Eggs, leaderboards, the free reward ---------------------------------------------

/** The egg stands, in a row behind the spawn on the east; the Volcano egg is the big one. */
export const EGG_STANDS = Object.keys(EGGS).map((eggId, i) => ({
  eggId,
  x: 8 + i * 8.5,
  z: 41,
  big: eggId === 'volcano',
}))
export const EGG_TRIGGER_RADIUS = 4.2

/** Four boards across the back of the lobby, behind the spawn on the west. */
export const LEADERBOARDS = [
  { id: 'rebirths', x: -40, z: 43.5 },
  { id: 'wins', x: -30, z: 43.5 },
  { id: 'destroyed', x: -20, z: 43.5 },
  { id: 'playtime', x: -10, z: 43.5 },
]

export const FREE_REWARD = { x: -12, z: 40, radius: 3 }

/** The lobby's gate to the cities: an arch over the bridge, pillars either side. */
export const LOBBY_GATE = { z: LOBBY.minZ + 1, halfGap: BRIDGE_HALF + 1.4 }

// --- Collision & walking ------------------------------------------------------------

const box = (x, z, halfX, halfZ) => ({ minX: x - halfX, maxX: x + halfX, minZ: z - halfZ, maxZ: z + halfZ })

/** Solid, never-changing obstacles in the lobby. Locked zones add their own at runtime. */
export const STATIC_COLLIDERS = [
  ...TORNADO_STANDS.map(standRect),
  ...EGG_STANDS.map((s) => box(s.x, s.z, s.big ? 2.2 : 1.7, s.big ? 2.2 : 1.7)),
  ...LEADERBOARDS.map((b) => box(b.x, b.z, 4.4, 0.5)),
  box(FREE_REWARD.x, FREE_REWARD.z, 1.4, 1.4),
  box(-LOBBY_GATE.halfGap, LOBBY_GATE.z, 1.2, 1.2),
  box(LOBBY_GATE.halfGap, LOBBY_GATE.z, 1.2, 1.2),
]

export const inRect = (r, x, z, margin = 0) =>
  x >= r.minX - margin && x <= r.maxX + margin && z >= r.minZ - margin && z <= r.maxZ + margin

/**
 * Walkable ground for a player who has opened cities up to `unlocked` (0-based): the
 * lobby, every open city's island and the bridges up to the first closed gate - you can
 * walk right up to it, and no further.
 */
export function walkableRects(unlocked) {
  const rects = [LOBBY]
  const open = Math.min(STAGE_COUNT - 1, Math.max(0, unlocked))
  for (let i = 0; i <= Math.min(STAGE_COUNT - 1, open + 1); i += 1) {
    const bridge = bridgeRect(i)
    if (i > open) bridge.minZ = gateZ(i) + 1.6
    rects.push(bridge)
    if (i <= open) rects.push(stageRect(i))
  }
  return rects
}

/** Clamps (x, z) into the walkable ground for `unlocked`, writing the nearest point to `out`. */
export function clampToWalkable(x, z, unlocked, out = { x: 0, z: 0 }) {
  let best = Infinity
  const open = Math.min(STAGE_COUNT - 1, Math.max(0, unlocked))
  const consider = (r) => {
    const cx = Math.min(r.maxX, Math.max(r.minX, x))
    const cz = Math.min(r.maxZ, Math.max(r.minZ, z))
    const d = (cx - x) ** 2 + (cz - z) ** 2
    if (d < best) {
      best = d
      out.x = cx
      out.z = cz
    }
  }
  consider(LOBBY)
  if (best === 0) return out
  // Only the cities near (x, z) can be nearest: no need to walk the whole chain.
  const near = z < LOBBY.minZ ? Math.floor((LOBBY.minZ - z) / STAGE_PITCH) : 0
  for (let i = Math.max(0, near - 1); i <= Math.min(STAGE_COUNT - 1, open + 1, near + 1); i += 1) {
    const bridge = bridgeRect(i)
    if (i > open) bridge.minZ = gateZ(i) + 1.6
    consider(bridge)
    if (i <= open) consider(stageRect(i))
    if (best === 0) break
  }
  // Far past where you're allowed (a stale position, a cheat): back to the last open city.
  if (best === Infinity) consider(stageRect(open))
  return out
}

/** Whether (x, z) is on Storm Zone `index`, give or take `margin`. */
export const onPad = (index, x, z, margin = 0) => Math.hypot(x - PAD_X, z - padCenterZ(index)) <= PAD_RADIUS + margin

/** Index of the Storm Zone under (x, z), or -1. */
export function padAt(x, z, margin = 0) {
  if (Math.abs(x - PAD_X) > PAD_RADIUS + margin + 1) return -1
  for (let i = 0; i < PAD_COUNT; i += 1) {
    if (onPad(i, x, z, margin)) return i
  }
  return -1
}

/** Index of the tornado stand whose BUY spot is under (x, z), or -1. */
export function standAt(x, z, margin = 0) {
  if (z < LOBBY.minZ || x > -15) return -1
  for (const stand of TORNADO_STANDS) {
    if (inRect(buySpotRect(stand), x, z, margin)) return stand.index
  }
  return -1
}

/** The egg stand within reach of (x, z), or null. */
export function eggStandNear(x, z) {
  for (const stand of EGG_STANDS) {
    const reach = EGG_TRIGGER_RADIUS + (stand.big ? 1 : 0)
    if (Math.hypot(stand.x - x, stand.z - z) <= reach) return stand
  }
  return null
}

/** Fastest a player can legitimately move (the best speed upgrades), for the server's anti-teleport check. */
export const MAX_MOVE_SPEED = 24
