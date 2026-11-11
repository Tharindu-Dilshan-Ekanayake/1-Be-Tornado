import {
  AD_REWARDS,
  BADGES,
  BASE_RADIUS,
  BASE_SPEED,
  BIG_STORM,
  DAILY_INTERVAL_MS,
  dayNumber,
  DAILY_REWARDS,
  EGGS,
  FREE_REWARD,
  GEM_PRODUCTS,
  healthForLevel,
  ITEMS,
  LEVEL_PACKS,
  levelCap,
  loginMultiplier,
  MAX_EQUIPPED_PETS,
  MAX_PET_INVENTORY,
  OFFLINE_MAX_MS,
  OFFLINE_MIN_MS,
  OFFLINE_RATE,
  PADS,
  PETS,
  PLAYTIME_REWARDS,
  RARITIES,
  REBIRTH_SKIP_PAYS,
  rebirthGift,
  rebirthMultiplier,
  RING_RADIUS,
  RING_TEAR,
  TEAR_FASTEST,
  TEAR_SLOWEST,
  TOUGH_STEP,
  ringsFor,
  SHOP,
  STAGES,
  streakBonus,
  SURGE_COOLDOWN,
  SURGE_RADIUS,
  TORNADO_HEIGHT,
  TORNADOES,
  TRAIN_INTERVAL,
  TUTORIAL,
  upgradeCost,
  UPGRADES,
} from './balance.js'
import { KINDS } from './cities.js'

/**
 * Game rules as pure functions over a plain profile object.
 *
 * The server runs these authoritatively; the client runs the very same functions for
 * offline play and for display (costs, multipliers, what a button would do). Mutating
 * functions change the profile in place and return a small result describing what
 * happened, which is what gets sent to the client as an event.
 *
 * `session` is the per-connection state that is never saved: when this session
 * started, which playtime rewards were claimed, the free-reward flag.
 */

export const PROFILE_VERSION = 1

export function createProfile(id, name) {
  return {
    v: PROFILE_VERSION,
    id,
    name,
    /** Power (the template's name). Your level follows from it. */
    health: 0,
    wins: 0,
    rebirths: 0,
    level: 1,
    equippedTornado: TORNADOES[0].id,
    ownedTornadoes: [TORNADOES[0].id],
    /** The furthest city whose gate is open (index into STAGES): open for good. */
    unlocked: 0,
    /** Upgrade levels (balance UPGRADES), kept through rebirths. */
    upgrades: { size: 0, speed: 0, surge: 0 },
    pets: [],
    equippedPets: [],
    nextPetUid: 1,
    items: {},
    boosts: { health: 0, wins: 0 },
    passes: {},
    daily: { start: 0, claimed: [] },
    freeRewardClaimed: false,
    tutorialStep: 0,
    badges: [],
    /** Every kind of thing (cities KINDS ids) you've ever swallowed: the Index. */
    index: [],
    stats: {
      absorbed: 0,
      trophies: 0,
      clears: 0,
      landmarks: 0,
      trains: 0,
      playtime: 0,
      bestHealth: 0,
      totalWins: 0,
      bestStreak: 0,
      surges: 0,
    },
    lastPad: -1,
    lastSeen: 0,
    settings: { autoRebirth: false },
    /** Today's quests (engage.js): the day they're for, the three, the bonus chest taken. */
    quests: { day: -1, list: [], bonus: false },
    /** Login streak: the last day played (balance.dayNumber), days in a row, the best run. */
    streak: { day: -1, days: 0, best: 0 },
  }
}

const whole = (n, max = Infinity) => Math.min(max, Math.max(0, Math.floor(Number(n)) || 0))

/** Fills in anything missing from an older or partial save. Never throws. */
export function normalizeProfile(raw, id, name) {
  const base = createProfile(id, name)
  if (!raw || typeof raw !== 'object') return base
  const p = { ...base, ...raw, id, name: name || raw.name || base.name }
  p.boosts = { ...base.boosts, ...(raw.boosts || {}) }
  p.stats = { ...base.stats, ...(raw.stats || {}) }
  p.settings = { autoRebirth: raw.settings?.autoRebirth === true }
  p.daily = { ...base.daily, ...(raw.daily || {}) }
  p.upgrades = Object.fromEntries(Object.entries(UPGRADES).map(([key, u]) => [key, whole(raw.upgrades?.[key], u.max)]))
  const streak = raw.streak && typeof raw.streak === 'object' ? raw.streak : {}
  p.streak = {
    day: Number.isInteger(streak.day) ? streak.day : -1,
    days: whole(streak.days),
    best: whole(streak.best),
  }
  const quests = raw.quests && typeof raw.quests === 'object' ? raw.quests : {}
  p.quests = {
    day: Number.isInteger(quests.day) ? quests.day : -1,
    list: Array.isArray(quests.list)
      ? quests.list
          .filter((q) => q && typeof q.type === 'string' && Number.isFinite(q.target))
          .map((q) => ({ type: q.type, tier: Math.max(0, Math.min(2, Math.floor(q.tier) || 0)), target: q.target, progress: Math.max(0, Number(q.progress) || 0), claimed: q.claimed === true }))
      : [],
    bonus: quests.bonus === true,
  }
  p.items = Object.fromEntries(Object.entries(raw.items || {}).filter(([itemId, n]) => ITEMS[itemId] && Number.isFinite(n) && n > 0))
  p.passes = Object.fromEntries(Object.entries(raw.passes || {}).filter(([productId]) => SHOP[productId]?.kind === 'pass'))
  p.health = Number.isFinite(raw.health) ? Math.max(0, raw.health) : 0
  p.wins = Number.isFinite(raw.wins) ? Math.max(0, raw.wins) : 0
  p.rebirths = whole(raw.rebirths)
  p.pets = Array.isArray(raw.pets) ? raw.pets.filter((pet) => PETS[pet?.id] && Number.isInteger(pet.uid)) : []
  p.nextPetUid = Math.max(whole(raw.nextPetUid), ...p.pets.map((pet) => pet.uid + 1), 1)
  p.equippedPets = Array.isArray(raw.equippedPets)
    ? raw.equippedPets.filter((uid) => p.pets.some((pet) => pet.uid === uid)).slice(0, MAX_EQUIPPED_PETS)
    : []
  const owned = Array.isArray(raw.ownedTornadoes) ? raw.ownedTornadoes.filter((t) => tornadoIndex(t) >= 0) : []
  p.ownedTornadoes = owned.length ? [...new Set(owned)] : [TORNADOES[0].id]
  if (!p.ownedTornadoes.includes(p.equippedTornado)) p.equippedTornado = p.ownedTornadoes[0]
  p.index = Array.isArray(raw.index) ? [...new Set(raw.index.filter((kind) => KINDS[kind]))] : []
  p.badges = Array.isArray(raw.badges) ? raw.badges.filter((b) => BADGES[b]) : []
  // Levels follow from Power; recompute rather than trust a stored one. Open gates stay open.
  p.level = levelFor(p.health, p.rebirths)
  p.unlocked = Math.min(STAGES.length - 1, Math.max(0, whole(raw.unlocked)))
  // The tutorial is for brand-new players only: anyone who has rebirthed is past it.
  if (p.rebirths > 0) p.tutorialStep = TUTORIAL.length
  p.tutorialStep = whole(p.tutorialStep, TUTORIAL.length)
  p.v = PROFILE_VERSION
  return p
}

export function createSession(now) {
  return { start: now, playtimeClaimed: [], freeRewardTaken: false, adAt: {} }
}

// --- Lookups ------------------------------------------------------------------------

export const tornadoIndex = (id) => TORNADOES.findIndex((t) => t.id === id)
export const tornadoById = (id) => TORNADOES.find((t) => t.id === id) || TORNADOES[0]

export function isPadUnlocked(profile, index) {
  const pad = PADS[index]
  if (!pad) return false
  if (pad.product) return Boolean(profile.passes[pad.product])
  return profile.rebirths >= pad.rebirths
}

/**
 * Power values are kept to a tenth below a million and whole above, so repeated small
 * gains don't pile up float dust.
 */
export const tidy = (value) => (value < 1e6 ? Math.round(value * 10) / 10 : Math.round(value))

/** "Nice" price or amount: two significant figures (692 -> 690, 1934 -> 1900). */
export function niceRound(n) {
  if (n < 100) return Math.max(1, Math.round(n))
  const step = 10 ** (Math.floor(Math.log10(n)) - 1)
  return Math.round(n / step) * step
}

// --- Levels -------------------------------------------------------------------------

/** The level `health` reaches, never above the cap for `rebirths`. */
export function levelFor(health, rebirths) {
  const cap = levelCap(rebirths)
  let level = 1
  while (level < cap && health >= healthForLevel(level + 1)) level += 1
  return level
}

export const isMaxLevel = (profile) => profile.level >= levelCap(profile.rebirths)

/** 0..1 through the current level: what the level bar fills to. */
export function levelProgress(profile) {
  if (isMaxLevel(profile)) return 1
  const from = healthForLevel(profile.level)
  const to = healthForLevel(profile.level + 1)
  return Math.max(0, Math.min(1, (profile.health - from) / Math.max(1e-9, to - from)))
}

/** 0..1 progress towards being able to rebirth, by levels. */
export function rebirthProgress(profile) {
  const cap = levelCap(profile.rebirths)
  if (profile.level >= cap) return 1
  return Math.max(0, Math.min(1, (profile.level - 1 + levelProgress(profile)) / Math.max(1, cap - 1)))
}

// --- Your tornado -------------------------------------------------------------------

/** The funnel's radius at its base (metres): rings from your level, the size upgrade, Big Storm. */
export function tornadoRadius(profile) {
  const rings = ringsFor(profile.level)
  const upgrade = 1 + UPGRADES.size.step * (profile.upgrades?.size || 0)
  return (BASE_RADIUS + RING_RADIUS * (rings - 1)) * upgrade * (profile.passes?.bigStorm ? BIG_STORM : 1)
}
export const tornadoHeight = (profile) => tornadoRadius(profile) * TORNADO_HEIGHT

/** How fast your tornado moves (m/s). */
export const tornadoSpeed = (profile) => BASE_SPEED * (1 + UPGRADES.speed.step * (profile.upgrades?.speed || 0))

/** Seconds between Surges, and how far one reaches (times your radius). */
export const surgeCooldown = (profile) => Math.max(8, SURGE_COOLDOWN - (profile.upgrades?.surge || 0))
export const surgeReach = (profile) => SURGE_RADIUS * (1 + 0.08 * (profile.upgrades?.surge || 0))

/** How much your rings speed up tearing (each ring past the first, RING_TEAR more). */
export const tearRate = (profile) => 1 + RING_TEAR * (ringsFor(profile.level) - 1)

const TORNADO_POWER = Object.fromEntries(TORNADOES.map((t) => [t.id, t.power]))
/** How strong your tornado is at tearing things up, in levels: your level plus its type's. */
export const tearStrength = (profile) => profile.level + Math.log2(TORNADO_POWER[profile.equippedTornado] || 1)

/**
 * How fast your funnel tears up object `o` (seconds of its hp per second held over it):
 * twice as fast for every TOUGH_STEP levels stronger you are than it's tough, and faster
 * with every ring. Anything can be torn up by anyone; it just takes a weak tornado longer.
 */
export function tearSpeed(profile, o) {
  const k = Math.pow(2, (tearStrength(profile) - o.level) / TOUGH_STEP)
  return tearRate(profile) * Math.min(TEAR_FASTEST, Math.max(TEAR_SLOWEST, k))
}

/** Seconds your funnel has to be over `o` to tear it up. */
export const tearTime = (profile, o) => o.hp / tearSpeed(profile, o)

// --- Multipliers --------------------------------------------------------------------

/** Equipped pets stack additively: x3 and x2 together make x4, not x6. */
export function petMultiplier(profile) {
  let total = 1
  for (const uid of profile.equippedPets) {
    const pet = profile.pets.find((p) => p.uid === uid)
    if (pet && PETS[pet.id]) total += PETS[pet.id].mult - 1
  }
  return total
}

export const isBoostActive = (profile, kind, now) => (profile.boosts[kind] || 0) > now

/** The x2 Power pass and potion; they stack. */
export function healthBoostMultiplier(profile, now) {
  return (profile.passes.healthX2 ? 2 : 1) * (isBoostActive(profile, 'health', now) ? 2 : 1)
}

/**
 * Days in a row you've played, as of `now`: your login streak while it's alive (played
 * today or yesterday), else 0. (engage.applyStreak counts the days.)
 */
export function loginDays(profile, now) {
  const s = profile.streak
  if (!s || s.days <= 0) return 0
  return dayNumber(now) - s.day <= 1 ? s.days : 0
}

/** The x2 Wins pass and potion (they stack), and your login streak's bonus. */
export function winsMultiplier(profile, now) {
  return (profile.passes.winsX2 ? 2 : 1) * (isBoostActive(profile, 'wins', now) ? 2 : 1) * loginMultiplier(loginDays(profile, now))
}

/** Everything that multiplies a Power gain except the tornado and what earned it. */
export function gainMultiplier(profile, now) {
  return rebirthMultiplier(profile.rebirths) * petMultiplier(profile) * healthBoostMultiplier(profile, now)
}

/** Your tornado's power times everything else: what one unit of Power is worth to you. */
export const powerMultiplier = (profile, now) => tornadoById(profile.equippedTornado).power * gainMultiplier(profile, now)

/** Power from one gain while moving around (WALK_STEP metres). */
export const baseGain = (profile, now) => tidy(powerMultiplier(profile, now))

/** Power from one tick in Storm Zone `index`. */
export function padGain(profile, index, now) {
  const pad = PADS[index]
  if (!pad) return 0
  return tidy(powerMultiplier(profile, now) * pad.mult)
}

// --- Power, levels, cities, rebirth --------------------------------------------------

/**
 * Banks a gain and the levels it reaches. Once you're at max level gains stop: rebirth
 * to keep going. Returns what was really added.
 */
function addHealth(profile, gain) {
  const cap = levelCap(profile.rebirths)
  if (profile.level >= cap) return { gain: 0, leveledUp: false, levels: 0, maxed: true }
  // Stops exactly on max level rather than overshooting it.
  const room = Math.max(0, healthForLevel(cap) - profile.health)
  const added = tidy(Math.min(gain, room))
  profile.health = tidy(profile.health + added)
  profile.stats.trains += 1
  profile.stats.bestHealth = Math.max(profile.stats.bestHealth, profile.health)
  const before = profile.level
  profile.level = levelFor(profile.health, profile.rebirths)
  return { gain: added, leveledUp: profile.level > before, levels: profile.level - before, maxed: profile.level >= cap }
}

/** Banks Power you've earned (`raw`, before multipliers) and opens any gate your level now reaches. */
export function gainPower(profile, raw, now) {
  const result = addHealth(profile, raw * powerMultiplier(profile, now))
  result.unlocked = result.leveledUp ? unlockStages(profile, now) : []
  return result
}

export function applyTrain(profile, index, now) {
  if (!isPadUnlocked(profile, index)) return { ok: false, error: 'Zone locked' }
  profile.lastPad = index
  return { ok: true, ...gainPower(profile, PADS[index].mult, now) }
}

/** One WALK_STEP's worth of moving around. */
export const applyWalkStep = (profile, now) => ({ ok: true, ...gainPower(profile, 1, now) })

/**
 * Opens every city gate your level reaches (one after another, never skipping one).
 * Returns the indices opened.
 */
export function unlockStages(profile) {
  const opened = []
  while (profile.unlocked + 1 < STAGES.length && profile.level >= STAGES[profile.unlocked + 1].level) {
    profile.unlocked += 1
    opened.push({ index: profile.unlocked, wins: 0 })
  }
  return opened
}

/**
 * `count` more PAY_SHARE's of city `stage` destroyed: its Wins for each, times your Wins
 * boosts and `crowd` (the friends bonus). Returns the Wins paid.
 */
export function payCity(profile, stage, count, now, crowd = 1) {
  const wins = Math.max(1, Math.round(STAGES[stage].wins * count * winsMultiplier(profile, now) * crowd))
  profile.wins += wins
  profile.stats.totalWins += wins
  return wins
}

/**
 * Something swallowed: object `o` (a cities layout object). Power for it (times `streak`'s
 * bonus), and the Index if it's a new kind. (Wins come from clearing whole cities:
 * payCity.) Returns { gain, wins: 0, newKind, ... }.
 */
export function absorbObject(profile, o, now, { streak = 0 } = {}) {
  const power = gainPower(profile, o.power * streakBonus(streak), now)
  profile.stats.absorbed += 1
  if (o.size === 'landmark') profile.stats.landmarks += 1
  else if (o.size === 'trophy') profile.stats.trophies += 1
  let newKind = null
  if (KINDS[o.kind] && !profile.index.includes(o.kind)) {
    profile.index.push(o.kind)
    newKind = o.kind
  }
  return { ...power, wins: 0, newKind }
}

/** Rebirth: +1 rebirth; Power and levels reset (Wins, tornadoes, upgrades, pets and open gates stay). */
export function applyRebirth(profile) {
  if (!isMaxLevel(profile)) return { ok: false, error: `Reach level ${levelCap(profile.rebirths)} first!` }
  profile.rebirths += 1
  profile.tutorialStep = TUTORIAL.length
  profile.health = 0
  profile.level = 1
  const gift = rebirthGift(profile.rebirths)
  if (gift) addItem(profile, gift.item, gift.amount)
  return { ok: true, rebirths: profile.rebirths, gift }
}

/** What your best open city pays (per PAY_SHARE of it destroyed): the unit rewards and prices grow by. */
export const payWorth = (profile) => STAGES[Math.min(STAGES.length - 1, Math.max(0, profile.unlocked || 0))].wins

/** `n` city pays' worth of Wins: rewards that grow with you. */
export const winsForPays = (profile, n) => Math.max(10, Math.round(payWorth(profile) * n))

/** Wins to rebirth now without reaching max level first. */
export const rebirthSkipPrice = (profile) => niceRound(Math.max(20, payWorth(profile) * REBIRTH_SKIP_PAYS))

export function skipRebirth(profile) {
  if (isMaxLevel(profile)) return applyRebirth(profile)
  const price = rebirthSkipPrice(profile)
  if (profile.wins < price) return { ok: false, error: 'Not enough Wins!' }
  profile.wins -= price
  profile.level = levelCap(profile.rebirths)
  return applyRebirth(profile)
}

/**
 * The level packs as they stand for you now: `[{ levels, amount, price }]`. `amount` is
 * the Power to go up `levels` levels from here (never past max level); `price` follows
 * what your best city pays.
 */
export function levelPacks(profile) {
  const cap = levelCap(profile.rebirths)
  return LEVEL_PACKS.map((pack) => {
    const target = Math.min(cap, profile.level + pack.levels)
    return {
      levels: pack.levels,
      amount: Math.max(0, tidy(healthForLevel(target) - profile.health)),
      price: niceRound(Math.max(3, payWorth(profile) * pack.pays)),
    }
  })
}

/** Buys level pack `index` with Wins. */
export function buyLevelPack(profile, index, now = 0) {
  if (isMaxLevel(profile)) return { ok: false, error: 'Max level - rebirth!' }
  const pack = levelPacks(profile)[index]
  if (!pack) return { ok: false, error: 'Unknown pack' }
  if (profile.wins < pack.price) return { ok: false, error: 'Not enough Wins!' }
  profile.wins -= pack.price
  const before = profile.level
  profile.health = tidy(profile.health + pack.amount)
  profile.stats.bestHealth = Math.max(profile.stats.bestHealth, profile.health)
  profile.level = levelFor(profile.health, profile.rebirths)
  return { ok: true, amount: pack.amount, levels: profile.level - before, unlocked: unlockStages(profile, now) }
}

// --- Tornadoes and upgrades ----------------------------------------------------------

export function buyTornado(profile, id) {
  const index = tornadoIndex(id)
  if (index < 0) return { ok: false, error: 'Unknown tornado' }
  if (profile.ownedTornadoes.includes(id)) return equipTornado(profile, id)
  const previous = TORNADOES[index - 1]
  if (previous && !profile.ownedTornadoes.includes(previous.id)) return { ok: false, error: `Buy the ${previous.name} first!` }
  const tornado = TORNADOES[index]
  if (profile.wins < tornado.cost) return { ok: false, error: 'Not enough Wins!' }
  profile.wins -= tornado.cost
  profile.ownedTornadoes.push(id)
  profile.equippedTornado = id
  return { ok: true, bought: true, id }
}

export function equipTornado(profile, id) {
  if (!profile.ownedTornadoes.includes(id)) return { ok: false, error: 'You don’t own that tornado' }
  profile.equippedTornado = id
  return { ok: true, equipped: true, id }
}

/** The next tornado in line you don't have yet, or null. */
export function nextTornado(profile) {
  return TORNADOES.find((t) => !profile.ownedTornadoes.includes(t.id)) || null
}

/** What the next level of upgrade `id` costs, or null at its max. */
export function upgradePrice(profile, id) {
  const u = UPGRADES[id]
  if (!u) return null
  const level = profile.upgrades[id] || 0
  return level >= u.max ? null : upgradeCost(id, level)
}

export function buyUpgrade(profile, id) {
  const price = upgradePrice(profile, id)
  if (price === null) return { ok: false, error: 'Maxed!' }
  if (profile.wins < price) return { ok: false, error: 'Not enough Wins!' }
  profile.wins -= price
  profile.upgrades[id] = (profile.upgrades[id] || 0) + 1
  return { ok: true, id, level: profile.upgrades[id] }
}

// --- Rewards that grow with you -----------------------------------------------------

/** The egg item that fits how far you've got: a reward that's always worth opening. */
export function eggItemFor(profile) {
  if (profile.unlocked >= 12) return 'eggVolcano'
  if (profile.unlocked >= 8) return 'eggUnicorn'
  if (profile.unlocked >= 4) return 'eggSunset'
  return 'eggMeadow'
}

/**
 * Pays a reward grant of { winsPays?, item?, egg? } (quests, lucky gifts). Returns
 * what was given: { wins, items: [itemId...] }.
 */
export function payReward(profile, grant) {
  const out = { wins: 0, items: [] }
  if (grant.winsPays) {
    out.wins = winsForPays(profile, grant.winsPays)
    profile.wins += out.wins
    profile.stats.totalWins += out.wins
  }
  if (grant.item) {
    addItem(profile, grant.item, 1)
    out.items.push(grant.item)
  }
  if (grant.egg) {
    const egg = eggItemFor(profile)
    addItem(profile, egg, 1)
    out.items.push(egg)
  }
  return out
}

// --- Pets --------------------------------------------------------------------------

function rollPet(eggId, rand) {
  const egg = EGGS[eggId]
  const total = egg.pets.reduce((sum, [, w]) => sum + w, 0)
  let r = rand() * total
  for (const [petId, weight] of egg.pets) {
    r -= weight
    if (r < 0) return petId
  }
  return egg.pets[egg.pets.length - 1][0]
}

export function addPet(profile, petId) {
  const pet = { uid: profile.nextPetUid++, id: petId }
  profile.pets.push(pet)
  // Auto-equip into a free slot, so a first pet does something straight away.
  if (profile.equippedPets.length < MAX_EQUIPPED_PETS) profile.equippedPets.push(pet.uid)
  return pet
}

/**
 * Hatches `count` eggs. `paid` says how: 'wins' charges the egg's Wins price, 'item'
 * consumes an egg item, 'free' is for reward grants already paid for.
 */
export function hatchEgg(profile, eggId, count = 1, { paid = 'wins', rand = Math.random } = {}) {
  const egg = EGGS[eggId]
  if (!egg) return { ok: false, error: 'Unknown egg' }
  if (profile.pets.length + count > MAX_PET_INVENTORY) return { ok: false, error: 'Pet inventory full!' }
  if (paid === 'wins') {
    if (!egg.cost.wins) return { ok: false, error: 'This egg is premium only' }
    const price = egg.cost.wins * count
    if (profile.wins < price) return { ok: false, error: 'Not enough Wins!' }
    profile.wins -= price
  } else if (paid === 'item') {
    const itemId = Object.keys(ITEMS).find((k) => ITEMS[k].kind === 'egg' && ITEMS[k].egg === eggId)
    if (!itemId || (profile.items[itemId] || 0) < count) return { ok: false, error: 'No eggs left' }
    profile.items[itemId] -= count
  }
  const pets = []
  for (let i = 0; i < count; i += 1) pets.push(addPet(profile, rollPet(eggId, rand)))
  return { ok: true, eggId, pets }
}

export function equipPet(profile, uid) {
  if (!profile.pets.some((p) => p.uid === uid)) return { ok: false, error: 'Unknown pet' }
  if (profile.equippedPets.includes(uid)) return { ok: true }
  if (profile.equippedPets.length >= MAX_EQUIPPED_PETS) return { ok: false, error: `Max ${MAX_EQUIPPED_PETS} pets equipped` }
  profile.equippedPets.push(uid)
  return { ok: true }
}

export function unequipPet(profile, uid) {
  profile.equippedPets = profile.equippedPets.filter((u) => u !== uid)
  return { ok: true }
}

const petScore = (pet) => PETS[pet.id]?.mult ?? 0

export function equipBestPets(profile) {
  const best = [...profile.pets].sort((a, b) => petScore(b) - petScore(a)).slice(0, MAX_EQUIPPED_PETS)
  profile.equippedPets = best.map((p) => p.uid)
  return { ok: true }
}

export function deletePet(profile, uid) {
  const before = profile.pets.length
  profile.pets = profile.pets.filter((p) => p.uid !== uid)
  profile.equippedPets = profile.equippedPets.filter((u) => u !== uid)
  return { ok: profile.pets.length < before }
}

/** Sort key for inventory display: equipped first, then rarity, then multiplier. */
export function petSortKey(profile, pet) {
  const info = PETS[pet.id]
  const equipped = profile.equippedPets.includes(pet.uid) ? 1 : 0
  return equipped * 1e6 + (RARITIES[info.rarity]?.order ?? 0) * 1e4 + info.mult
}

// --- Items & boosts ---------------------------------------------------------------

export function addItem(profile, itemId, amount = 1) {
  profile.items[itemId] = (profile.items[itemId] || 0) + amount
}

export function usePotion(profile, itemId, now) {
  const item = ITEMS[itemId]
  if (!item || item.kind !== 'potion') return { ok: false, error: 'Not a potion' }
  if ((profile.items[itemId] || 0) <= 0) return { ok: false, error: 'None left' }
  profile.items[itemId] -= 1
  // Stacks: a second potion extends the timer instead of wasting it.
  profile.boosts[item.boost] = Math.max(profile.boosts[item.boost] || 0, now) + item.durationMs
  return { ok: true, boost: item.boost, endsAt: profile.boosts[item.boost] }
}

/** Applies a reward grant: { wins } | { item } | { pet } | { health } | { hatch }. */
export function applyGrant(profile, grant, { rand = Math.random } = {}) {
  const result = { ok: true }
  if (grant.wins) {
    profile.wins += grant.wins
    profile.stats.totalWins += grant.wins
  }
  if (grant.health) {
    profile.health = tidy(profile.health + grant.health)
    profile.stats.bestHealth = Math.max(profile.stats.bestHealth, profile.health)
    profile.level = levelFor(profile.health, profile.rebirths)
    result.unlocked = unlockStages(profile)
  }
  if (grant.item) addItem(profile, grant.item, grant.amount || 1)
  if (grant.pet) result.pets = [addPet(profile, grant.pet)]
  if (grant.hatch) {
    const hatched = hatchEgg(profile, grant.hatch, 1, { paid: 'free', rand })
    if (!hatched.ok) return hatched
    result.pets = hatched.pets
    result.eggId = grant.hatch
  }
  return result
}

// --- Daily & playtime rewards -------------------------------------------------------

/**
 * State of each daily reward: 'claimed' | 'ready' | 'next' (with `unlocksIn` ms) |
 * 'locked'. A new 7-day cycle starts on first claim after the last one finishes.
 */
export function dailyStatus(profile, now) {
  const { start, claimed } = profile.daily
  const fresh = !start || claimed.length >= DAILY_REWARDS.length
  const cycleStart = fresh ? now : start
  let nextShown = false
  return DAILY_REWARDS.map((reward, day) => {
    if (!fresh && claimed.includes(day)) return { day, state: 'claimed' }
    const unlockAt = cycleStart + day * DAILY_INTERVAL_MS
    if (now >= unlockAt) return { day, state: 'ready' }
    if (!nextShown) {
      nextShown = true
      return { day, state: 'next', unlocksIn: unlockAt - now }
    }
    return { day, state: 'locked' }
  })
}

export function claimDaily(profile, day, now, opts) {
  const status = dailyStatus(profile, now)[day]
  if (!status || status.state !== 'ready') return { ok: false, error: 'Not ready yet' }
  if (!profile.daily.start || profile.daily.claimed.length >= DAILY_REWARDS.length) {
    profile.daily = { start: now, claimed: [] }
  }
  profile.daily.claimed.push(day)
  const result = applyGrant(profile, DAILY_REWARDS[day].grant, opts)
  return { ...result, day, label: DAILY_REWARDS[day].label }
}

export function playtimeStatus(session, now) {
  const minutes = (now - session.start) / 60000
  return PLAYTIME_REWARDS.map((reward, index) => {
    if (session.playtimeClaimed.includes(index)) return { index, state: 'claimed' }
    if (minutes >= reward.minutes) return { index, state: 'ready' }
    return { index, state: 'locked', unlocksIn: (reward.minutes - minutes) * 60000 }
  })
}

export function claimPlaytime(profile, session, index, now, opts) {
  const status = playtimeStatus(session, now)[index]
  if (!status || status.state !== 'ready') return { ok: false, error: 'Not ready yet' }
  session.playtimeClaimed.push(index)
  const result = applyGrant(profile, PLAYTIME_REWARDS[index].grant, opts)
  return { ...result, index, label: PLAYTIME_REWARDS[index].label }
}

export function claimFreeReward(profile, session, opts) {
  if (session.freeRewardTaken) return { ok: false, error: 'Already claimed this session' }
  session.freeRewardTaken = true
  const grant = profile.freeRewardClaimed ? FREE_REWARD.repeat : FREE_REWARD.firstTime
  profile.freeRewardClaimed = true
  return { ...applyGrant(profile, grant, opts), grant }
}

// --- Shop ---------------------------------------------------------------------------

/** Buys a SHOP item with Wins. */
export function buyShopItem(profile, productId, opts = {}) {
  const item = SHOP[productId]
  if (!item) return { ok: false, error: 'Unknown item' }
  if (item.kind === 'pass' && profile.passes[productId]) return { ok: false, error: 'Already owned' }
  if (profile.wins < item.price) return { ok: false, error: 'Not enough Wins!' }
  if (item.kind === 'pass') {
    profile.wins -= item.price
    profile.passes[productId] = true
    return { ok: true, productId, pass: true }
  }
  const result = applyGrant(profile, item.grant || {}, opts)
  if (result.ok) profile.wins -= item.price
  return { ...result, productId }
}

// --- Boxity Gems and rewarded ads ------------------------------------------------

/**
 * Grants Gems product `sku`, already paid for in Boxity. Passes you own already turn
 * into a Wins pack of the same worth, so nothing bought is ever wasted.
 */
export function applyGemProduct(profile, sku) {
  const product = GEM_PRODUCTS[sku]
  if (!product) return { ok: false, error: 'Unknown product' }
  const { grant } = product
  const result = { ok: true, sku, name: product.name }
  if (grant.pass) {
    if (profile.passes[grant.pass]) {
      result.wins = winsForPays(profile, 30)
    } else {
      profile.passes[grant.pass] = true
      result.pass = grant.pass
    }
  }
  if (grant.winsPays) result.wins = (result.wins || 0) + Math.max(25, winsForPays(profile, grant.winsPays))
  if (result.wins) {
    profile.wins += result.wins
    profile.stats.totalWins += result.wins
  }
  for (const [itemId, amount] of Object.entries(grant.items || {})) addItem(profile, itemId, amount)
  return result
}

/** A rewarded ad's prize for `placement`, if it's off cooldown (`session.adAt`). */
export function applyAdReward(profile, session, placement, now) {
  const reward = AD_REWARDS[placement]
  if (!reward) return { ok: false, error: 'Unknown reward' }
  session.adAt = session.adAt || {}
  if (now - (session.adAt[placement] || 0) < reward.cooldownMs) return { ok: false, error: 'Not ready yet' }
  session.adAt[placement] = now
  return { ...applyGrant(profile, reward.grant), placement, label: reward.label }
}

// --- Offline progress -------------------------------------------------------------

/** Power earned while away, if the player logged off in a Storm Zone. */
export function applyOfflineProgress(profile, now) {
  const away = Math.min(OFFLINE_MAX_MS, now - (profile.lastSeen || now))
  if (profile.lastPad < 0 || away < OFFLINE_MIN_MS) return null
  if (!isPadUnlocked(profile, profile.lastPad) || isMaxLevel(profile)) return null
  const steps = Math.floor(away / 1000 / TRAIN_INTERVAL)
  // Potions don't run while you're away.
  const gain = padGain(profile, profile.lastPad, 0)
  const result = addHealth(profile, Math.floor(steps * gain * OFFLINE_RATE))
  if (result.gain <= 0) return null
  unlockStages(profile, now)
  return { health: result.gain, ms: away }
}

// --- Tutorial & badges ------------------------------------------------------------

/** Advances the tutorial if `event` completes the current step. */
export function advanceTutorial(profile, event) {
  const step = TUTORIAL[profile.tutorialStep]
  if (!step || step.event !== event) return false
  if (step.health && profile.health < step.health) return false
  profile.tutorialStep += 1
  return true
}

/** Awards a badge once. Returns the badge if newly awarded. */
export function awardBadge(profile, id) {
  if (!BADGES[id] || profile.badges.includes(id)) return null
  profile.badges.push(id)
  return { id, ...BADGES[id] }
}

// Re-exported for the HUD: how tall your funnel is drawn, ring count.
export { ringsFor, TORNADO_HEIGHT }
