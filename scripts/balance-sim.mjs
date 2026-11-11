/**
 * Plays the game with a bot for N hours of game time and prints the pacing: when each
 * city opens, each rebirth happens and each tornado is bought, plus an hourly summary.
 *
 * It drives the real PlayerSession (shared/session.js) - the same code the server runs -
 * moving a fake position through the real city layouts, so what it measures is what
 * players get: the bot steers to whatever's nearest and quickest to tear up, hovering over
 * it until it breaks (every few things destroyed pay the city's Wins), Surges whenever it can, buys the next
 * tornado as soon as it can afford it, then upgrades and eggs with what's left, and
 * rebirths at max level. It plays at HUMAN_PACE of its tornado's top speed, to allow for
 * a real player's wandering.
 *
 * Usage: node scripts/balance-sim.mjs [hours=12] [--quiet] [--json]
 * (--json prints only the milestones, as JSON: what scripts/gen-guide.mjs reads.)
 */
import { EGGS, STAGES, TORNADOES, UPGRADES } from '../shared/balance.js'
import { payStep, stageLayout } from '../shared/cities.js'
import { formatNumber } from '../shared/format.js'
import { createProfile, isMaxLevel, nextTornado, tearTime, tornadoRadius, tornadoSpeed, upgradePrice } from '../shared/logic.js'
import { PlayerSession } from '../shared/session.js'
import { clampToWalkable, stageAt, stageEntry } from '../shared/world.js'

const HOURS = Number(process.argv[2]) || 12
const JSON_OUT = process.argv.includes('--json')
const QUIET = process.argv.includes('--quiet') || JSON_OUT
const milestones = { cities: {}, rebirths: {}, tornadoes: {} }
const DT = 0.1
const HUMAN_PACE = 0.7

const fmtTime = (s) => {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m ${String(Math.floor(s % 60)).padStart(2, '0')}s`
}

let seed = 12345
const rand = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0
  return seed / 4294967296
}

const profile = createProfile('sim', 'Bot')
const pos = { x: 0, y: 0, z: 30 }
let t = 0
const events = []
const log = (text) => {
  events.push(`${fmtTime(t).padStart(8)}  ${text}`)
  if (!QUIET) console.log(events[events.length - 1])
}

const session = new PlayerSession(profile, {
  now: 0,
  emit: (type, payload) => {
    if (type === 'stage') {
      milestones.cities[payload.index] = Math.round(t)
      log(`CITY ${payload.index + 1} ${payload.name} opens (level ${profile.level}, R${profile.rebirths})`)
    }
    if (type === 'cityWins' && !firstWins[payload.stage]) {
      firstWins[payload.stage] = true
      log(`first Wins from city ${payload.stage + 1}: +${formatNumber(payload.wins)}`)
    }
  },
  getPosition: () => pos,
  setPosition: (x, z) => {
    pos.x = x
    pos.z = z
  },
  rand,
})

const firstWins = {}
let stage = 0
let target = null
let lastPick = -1
let lastShop = -1
let rebirthsSeen = 0

/**
 * The city to be in: the first one until you've bought your first tornado (as the guide
 * says); then the furthest open one where most things tear up quickly for you.
 */
function bestStage() {
  if (!profile.ownedTornadoes.includes('gust')) return 0
  for (let s = profile.unlocked; s >= 0; s -= 1) {
    const objs = stageLayout(s).objects
    const ok = objs.filter((o) => tearTime(profile, o) <= 1.2).length
    if (ok / objs.length >= 0.45 || s === 0) return s
  }
  return 0
}

/** The best thing to go for: near and quick to tear up (clearing the city is what pays). */
function pickTarget(now) {
  const layout = stageLayout(stage)
  const speed = tornadoSpeed(profile) * HUMAN_PACE
  let best = null
  let bestScore = Infinity
  for (const o of layout.objects) {
    const time = tearTime(profile, o)
    if (time > 25) continue
    const back = session.down.get(o.id)
    if (back !== undefined && back > now) continue
    const d = Math.hypot(o.x - pos.x, o.z - pos.z)
    const score = d + time * speed
    if (score < bestScore) {
      bestScore = score
      best = o
    }
  }
  return best
}

function shop() {
  const next = nextTornado(profile)
  if (next && profile.wins >= next.cost) {
    session.handle('buyTornado', { id: next.id }, t * 1000)
    milestones.tornadoes[next.id] = Math.round(t)
    log(`buys ${next.name} (x${next.power}) for ${formatNumber(next.cost)} Wins`)
    return
  }
  // Saving for the next tornado comes first, unless it's far off.
  const saving = next ? next.cost : Infinity
  for (const id of Object.keys(UPGRADES)) {
    const price = upgradePrice(profile, id)
    if (price !== null && price <= profile.wins * 0.4 && (profile.wins - price >= saving * 0.5 || price < saving * 0.1)) {
      session.handle('buyUpgrade', { id }, t * 1000)
      return
    }
  }
  const eggs = Object.entries(EGGS).reverse()
  for (const [eggId, egg] of eggs) {
    if (profile.pets.length >= 40) break
    if (profile.wins >= egg.cost.wins * 4 && profile.wins - egg.cost.wins >= saving * 0.6) {
      // The bot hatches from anywhere (the real thing needs the stand).
      const before = profile.pets.length
      const { hatchEgg, equipBestPets } = logic
      hatchEgg(profile, eggId, 1, { rand })
      if (profile.pets.length > before) equipBestPets(profile)
      return
    }
  }
}

const logic = await import('../shared/logic.js')

const hourly = []
const end = HOURS * 3600
let nextHour = 3600
for (; t < end; t += DT) {
  const now = t * 1000
  if (t - lastPick > 20) {
    lastPick = t
    const s = bestStage()
    if (s !== stage || stageAt(pos.x, pos.z) !== s) {
      stage = s
      session.handle('teleport', { stage: s }, now)
      target = null
    }
  }
  if (t - lastShop > 4) {
    lastShop = t
    shop()
  }
  if (!target || (session.down.get(target.id) ?? 0) > now) target = pickTarget(now)
  if (target) {
    const dx = target.x - pos.x
    const dz = target.z - pos.z
    const d = Math.hypot(dx, dz)
    const hold = tearTime(profile, target) > DT && d < tornadoRadius(profile) * 0.8
    if (!hold && d > 0.05) {
      const step = Math.min(d, tornadoSpeed(profile) * HUMAN_PACE * DT)
      pos.x += (dx / d) * step
      pos.z += (dz / d) * step
      clampToWalkable(pos.x, pos.z, profile.unlocked, pos)
    }
  }
  if (now >= session.surgeReadyAt) session.handle('surge', {}, now)
  session.tick(DT, now)
  if (isMaxLevel(profile)) session.handle('rebirth', {}, now)
  if (profile.rebirths !== rebirthsSeen) {
    rebirthsSeen = profile.rebirths
    milestones.rebirths[profile.rebirths] = Math.round(t)
    log(`REBIRTH ${profile.rebirths} (now cap ${15 + 8 * profile.rebirths})`)
  }
  if (t >= nextHour) {
    nextHour += 3600
    hourly.push(
      `${String(hourly.length + 1).padStart(3)}h  R${profile.rebirths}  lvl ${profile.level}  city ${profile.unlocked + 1}  ${tornadoName()}  ${formatNumber(profile.wins)} Wins  ${formatNumber(profile.stats.absorbed)} absorbed  pets x${logic.petMultiplier(profile).toFixed(1)}  ups ${Object.values(profile.upgrades).join('/')}`,
    )
  }
  // Wander off target now and then, as players do.
  if (rand() < 0.002) target = null
  void stageEntry
}

function tornadoName() {
  return TORNADOES.find((x) => x.id === profile.equippedTornado).name
}

if (JSON_OUT) {
  console.log(JSON.stringify(milestones))
  process.exit(0)
}
console.log('\n--- Hourly ---')
for (const line of hourly) console.log(line)
console.log('\n--- Cities ---')
for (const s of STAGES) console.log(`${String(s.index + 1).padStart(2)} ${s.name.padEnd(18)} lvl ${String(s.level).padStart(3)}  +${formatNumber(s.wins).padStart(5)} Wins per ${payStep(s.index)} destroyed  power x${formatNumber(s.power)}`)
