/**
 * Every tunable number in the game. Rules live in logic.js; this file is data (plus the
 * few small formulas that turn a handful of parameters into tables), so balancing never
 * means touching code. `node scripts/balance-sim.mjs` plays the game with these numbers
 * and prints the pacing (time to each rebirth, city and tornado).
 *
 * Shared by client (display) and server (authority): both always agree on costs and
 * multipliers because they read the same table.
 *
 * The loop (+1 Be Tornado): you ARE a tornado. Sweep through a city and everything
 * small enough flies into your funnel for Power -> Power fills your level, and your
 * tornado grows a ring every few levels (a bigger funnel swallows more at once) ->
 * Giant Trophies and each city's Landmark pay Wins -> Wins buy stronger tornadoes,
 * upgrades, eggs and passes -> new levels open the next city's gate -> at max level,
 * rebirth for a bigger Power multiplier and a higher level cap (the rebirth system is
 * the template's, unchanged) -> on to the next city.
 *
 * Inside the code a few template names stay: `health` is Power and `pad` is a Storm
 * Zone in the lobby (stand in it and gain Power by itself).
 */

// --- Power and levels ---------------------------------------------------------------

/** Seconds between gains standing in a Storm Zone. */
export const TRAIN_INTERVAL = 0.6
/**
 * Spinning round the lobby or a city earns a little Power too: one gain for every
 * WALK_STEP metres moved. Far less than absorbing things, so cities still pay.
 */
export const WALK_STEP = 10

/**
 * Your level comes from your Power: reaching level L takes healthForLevel(L) Power.
 * Each level needs LEVEL_GROWTH_EARLY times the last at first, easing towards
 * LEVEL_GROWTH_LATE (the template's table, kept as it was).
 */
export const LEVEL_BASE = 100
export const LEVEL_GROWTH_EARLY = 1.3
export const LEVEL_GROWTH_LATE = 1.097
export const LEVEL_GROWTH_FADE = 100
/** Levels past this are not reachable: the table stops here. */
export const MAX_LEVEL = 1200

const LEVEL_TABLE = (() => {
  const table = new Float64Array(MAX_LEVEL + 1)
  let need = LEVEL_BASE
  for (let level = 2; level <= MAX_LEVEL; level += 1) {
    table[level] = table[level - 1] + need
    const growth = LEVEL_GROWTH_LATE + (LEVEL_GROWTH_EARLY - LEVEL_GROWTH_LATE) * Math.exp(-level / LEVEL_GROWTH_FADE)
    need *= growth
  }
  return table
})()

/** Two significant figures: thresholds and prices read cleanly (2,300, not 2,317). */
export const round2 = (n) => {
  if (n < 100) return Math.round(n)
  const step = 10 ** (Math.floor(Math.log10(n)) - 1)
  return Math.round(n / step) * step
}

export const healthForLevel = (level) => (level <= 1 ? 0 : round2(LEVEL_TABLE[Math.min(MAX_LEVEL, level)]))

// --- Rebirth (the template's system, unchanged) -------------------------------------

/** Max level by rebirth count: R0 = 15, R1 = 23, then +8 per rebirth. */
export const levelCap = (rebirths) => Math.min(MAX_LEVEL, 15 + 8 * Math.max(0, rebirths))

/** Power multiplier from rebirths: R0 = x1, R1 = x2, R2 = x3 ... */
export const rebirthMultiplier = (rebirths) => 1 + Math.max(0, rebirths)

/**
 * From Rebirth 15, every 5th rebirth (15, 20, 25...) comes with a gift of eggs: late in
 * the game, when each rebirth takes longest, there's always one coming up. One more egg
 * every 10 rebirths, up to 6.
 */
export const REBIRTH_GIFT_FROM = 15
export const REBIRTH_GIFT_EVERY = 5
export function rebirthGift(rebirths) {
  if (rebirths < REBIRTH_GIFT_FROM || (rebirths - REBIRTH_GIFT_FROM) % REBIRTH_GIFT_EVERY !== 0) return null
  const amount = Math.min(6, 3 + Math.floor((rebirths - REBIRTH_GIFT_FROM) / 10))
  return { rebirths, item: 'eggVolcano', amount, label: `${amount} Volcano Eggs` }
}
/** The next rebirth after `rebirths` that brings a gift, and the gift. */
export function nextRebirthGift(rebirths) {
  const from = Math.max(REBIRTH_GIFT_FROM, rebirths + 1)
  const at = from + ((REBIRTH_GIFT_EVERY - ((from - REBIRTH_GIFT_FROM) % REBIRTH_GIFT_EVERY)) % REBIRTH_GIFT_EVERY)
  return rebirthGift(at)
}

/** Skipping straight to a rebirth costs this many city pays' Wins (your best city's). */
export const REBIRTH_SKIP_PAYS = 12

// --- Storm Zones (the template's training pads) ------------------------------------

/**
 * Glowing storm circles along the lobby's east side, south to north (world.js). Standing
 * in one gains Power every TRAIN_INTERVAL by itself: your tornado's power times `mult`.
 * `rebirths` = rebirths needed; `product` = the SHOP pass that unlocks it instead.
 */
export const PADS = [
  { id: 'breeze', name: 'Breeze Zone', mult: 1, rebirths: 0 },
  { id: 'gust', name: 'Gust Zone', mult: 2, rebirths: 1 },
  { id: 'gale', name: 'Gale Zone', mult: 4, rebirths: 2 },
  { id: 'storm', name: 'Storm Zone', mult: 10, rebirths: 4 },
  { id: 'cyclone', name: 'Cyclone Zone', mult: 20, rebirths: 7 },
  { id: 'hyper', name: 'Hyper Zone', mult: 40, product: 'padVeryOp', tag: 'VERY OP!' },
  { id: 'cosmic', name: 'Cosmic Zone', mult: 100, product: 'padBest', tag: 'BEST OVERALL!' },
]

// --- Tornado types -------------------------------------------------------------------

/**
 * The tornadoes you can be, bought in order with Wins (the "Types" menu, or walk onto
 * a display stand in the lobby). `power` multiplies every Power gain (the "+1"); `cost`
 * is in Wins. `colors` paint the funnel ([outer, inner, debris specks]) and `glow` makes
 * it self-lit (fire, neon, plasma...). About x1.55 power for x2.1-x2.4 the Wins each:
 * each one is a few minutes of trophy hunting in the city you'll be in when you can
 * afford it (scripts/balance-sim.mjs).
 */
export const TORNADOES = [
  { id: 'breeze', name: 'Little Breeze', power: 1, cost: 0, rarity: 'common', colors: ['#f2f6fa', '#91a2b4', '#556270'], glow: 0 },
  { id: 'gust', name: 'Gusty Swirl', power: 1.4, cost: 3, rarity: 'common', colors: ['#f4f1e6', '#c9b896', '#8a7356'], glow: 0 },
  { id: 'sand', name: 'Sand Twister', power: 2.1, cost: 40, rarity: 'common', colors: ['#ffe2a8', '#e0a85a', '#9a6a2a'], glow: 0 },
  { id: 'rain', name: 'Rain Funnel', power: 3, cost: 120, rarity: 'uncommon', colors: ['#cfeaff', '#5aa8ff', '#1f5fb8'], glow: 0.1 },
  { id: 'leaf', name: 'Leaf Cyclone', power: 4.4, cost: 350, rarity: 'uncommon', colors: ['#e2ffb8', '#6fd24a', '#2f8a2a'], glow: 0.05 },
  { id: 'frost', name: 'Blizzard Spin', power: 6.4, cost: 1000, rarity: 'rare', colors: ['#f2fdff', '#8fe8ff', '#3fb4e8'], glow: 0.25 },
  { id: 'fire', name: 'Inferno Twister', power: 9.3, cost: 3000, rarity: 'rare', colors: ['#ffe27a', '#ff6a1e', '#c41f0a'], glow: 0.85 },
  { id: 'thunder', name: 'Thunder Funnel', power: 13, cost: 9000, rarity: 'rare', colors: ['#fff7b0', '#7a6cff', '#2a2470'], glow: 0.5 },
  { id: 'toxic', name: 'Acid Cyclone', power: 20, cost: 25000, rarity: 'epic', colors: ['#eaff8a', '#5ce82a', '#2a7a12'], glow: 0.6 },
  { id: 'candy', name: 'Candy Whirl', power: 28, cost: 70000, rarity: 'epic', colors: ['#fff0fa', '#ff7ad2', '#9a4cff'], glow: 0.3 },
  { id: 'shadow', name: 'Shadow Vortex', power: 41, cost: 200000, rarity: 'epic', colors: ['#b8a8d8', '#4a3a78', '#120a24'], glow: 0.2 },
  { id: 'crystal', name: 'Crystal Cyclone', power: 60, cost: 600000, rarity: 'legendary', colors: ['#f6e8ff', '#c08cff', '#5ac8ff'], glow: 0.6 },
  { id: 'magma', name: 'Magma Maelstrom', power: 86, cost: 1.6e6, rarity: 'legendary', colors: ['#ffd06a', '#ff3a1e', '#3a1010'], glow: 0.9 },
  { id: 'aurora', name: 'Aurora Twister', power: 130, cost: 4.5e6, rarity: 'legendary', colors: ['#c8fff0', '#3fe8b8', '#a85cff'], glow: 0.7 },
  { id: 'galaxy', name: 'Galaxy Whirl', power: 180, cost: 1.2e7, rarity: 'mythic', colors: ['#d8c8ff', '#5a3aff', '#0a0630'], glow: 0.75 },
  { id: 'plasma', name: 'Plasma Storm', power: 260, cost: 3.2e7, rarity: 'mythic', colors: ['#e8faff', '#3ad8ff', '#ff3ad2'], glow: 1 },
  { id: 'rainbow', name: 'Rainbow Hurricane', power: 380, cost: 8.5e7, rarity: 'mythic', colors: ['#ffffff', '#ff5fd2', '#3fb8ff'], glow: 0.8, rainbow: true },
  { id: 'dragon', name: 'Dragon Vortex', power: 550, cost: 2.3e8, rarity: 'secret', colors: ['#ffe8a0', '#e8221e', '#3a0a0a'], glow: 0.9 },
  { id: 'void', name: 'Black Hole', power: 800, cost: 6e8, rarity: 'secret', colors: ['#c8a8ff', '#22103a', '#000000'], glow: 0.4 },
  { id: 'infinity', name: 'Infinity Storm', power: 1200, cost: 1.6e9, rarity: 'secret', colors: ['#fffbe0', '#ffd21f', '#ff5fd2'], glow: 1, rainbow: true },
]

// --- Tornado size, speed and the Surge -----------------------------------------------

/**
 * Your tornado's rings: one to start, another at each of these levels, up to MAX_RINGS.
 * Every ring makes the funnel wider (RING_RADIUS) and taller: more of the city fits in
 * it at once. Levels reset at rebirth, so the tornado shrinks and grows again - faster
 * every time.
 */
export const RING_LEVELS = [3, 6, 10, 15, 21, 28, 36, 46, 58]
export const MAX_RINGS = RING_LEVELS.length + 1
export const ringsFor = (level) => 1 + RING_LEVELS.filter((l) => level >= l).length
/** The level the next ring comes at, or null at MAX_RINGS. */
export const nextRingLevel = (level) => RING_LEVELS.find((l) => level < l) ?? null

/** Radius of the funnel's base at 1 ring, and what each ring adds (metres). */
export const BASE_RADIUS = 2.6
export const RING_RADIUS = 0.55
/** The Big Storm pass: this much wider, for good. */
export const BIG_STORM = 1.25
/** How tall the funnel is, for its radius. */
export const TORNADO_HEIGHT = 3.4

/** How fast your tornado moves (m/s) before upgrades. */
export const BASE_SPEED = 11

/**
 * The Surge (the big button): a blast that pulls in everything you can absorb within
 * SURGE_RADIUS times your radius at once, and tears a chunk off any Giant Trophy or
 * Landmark in reach (SURGE_HIT of what it takes). Cooldown in seconds.
 */
export const SURGE_COOLDOWN = 24
export const SURGE_RADIUS = 2.2
export const SURGE_HIT = 0.5

/**
 * Upgrades, bought with Wins and kept for good (rebirth doesn't touch them). Each level
 * costs `growth` times the last. `step` is what a level adds: radius and speed in
 * shares (+6%, +5%), the Surge's cooldown in seconds off and its reach.
 */
export const UPGRADES = {
  size: { name: 'Bigger Funnel', blurb: '+6% tornado size', max: 15, cost: 25, growth: 2.35, step: 0.06 },
  speed: { name: 'Faster Winds', blurb: '+5% move speed', max: 15, cost: 20, growth: 2.3, step: 0.05 },
  surge: { name: 'Super Surge', blurb: '-1s Surge cooldown, +8% reach', max: 15, cost: 40, growth: 2.4, step: 1 },
}
export const upgradeCost = (id, level) => {
  const u = UPGRADES[id]
  return round2(u.cost * u.growth ** level)
}

// --- What's in a city -----------------------------------------------------------------

/**
 * Everything in a city is one of these sizes. `power` is Power per absorb (times the
 * city's POWER, see STAGES); `lvl` is how tough it is, as a share of the city's level
 * range (0 as tough as its gate's level, 1 as the next city's): its `level`, which it
 * needs nobody to have, but which sets how fast they tear it up (TOUGH_STEP below);
 * `r` is how far it reaches (metres, its footprint); `hp` the seconds your funnel has to
 * be over it to tear it up, if you're as strong as it's tough. `respawn` is seconds until
 * it's back after you tear it up - long enough that the path you tore through a city
 * stays torn up a while (every player has their own copy of every city: nobody wrecks
 * yours).
 */
export const SIZES = {
  tiny: { power: 1, lvl: 0, r: 0.6, respawn: 30, hp: 0.08 },
  small: { power: 3, lvl: 0.2, r: 1.1, respawn: 38, hp: 0.2 },
  medium: { power: 8, lvl: 0.4, r: 1.9, respawn: 52, hp: 0.4 },
  large: { power: 22, lvl: 0.6, r: 3, respawn: 66, hp: 0.75 },
  huge: { power: 60, lvl: 0.8, r: 4.6, respawn: 86, hp: 1.5 },
  trophy: { power: 120, lvl: 0.5, r: 3.2, respawn: 60, hp: 3.5 },
  landmark: { power: 700, lvl: 1, r: 7, respawn: 170, hp: 7 },
}
/**
 * Nothing in a city needs a level: any tornado can tear anything up, just slower or
 * faster. `hp` (above) is the seconds your funnel has to be over a thing to tear it up when
 * you're exactly as strong as it is tough (its `level`). Every TOUGH_STEP levels you're
 * stronger halves that, every TOUGH_STEP weaker doubles it - never slower than
 * TEAR_SLOWEST or faster than TEAR_FASTEST times. Your strength is your level plus your
 * tornado type's (log2 of its Power multiplier: a x8 tornado tears like 3 levels more).
 */
export const TOUGH_STEP = 3
export const TEAR_SLOWEST = 1 / 16
export const TEAR_FASTEST = 6
/** A Surge tears this many seconds' worth off everything in its reach at once (and at least SURGE_HIT of anything's hp). */
export const SURGE_TEAR = 1
/** Anything in reach this long ago or less still counts as being torn at (its progress is kept). */
export const HP_GRACE = 2.5
/** Each ring past the first tears things up this much faster (1 + RING_TEAR x rings). */
export const RING_TEAR = 0.15

/**
 * The cities, one after another along the chain of islands north of the lobby. Each:
 * `level` opens its gate (for good, the first time you reach it); `wins` is what it pays
 * for every PAY_SHARE of it you destroy (its Giant Trophies and Landmark are just the
 * biggest things in it: lots of Power, no Wins of their own); `power` multiplies what
 * everything in it is worth. `theme` (cities.js) is what it looks like and what's in it.
 *
 * Wins follow the reference's pace: the first city pays 3, the second 7, then about double
 * each city. Each city needs a little more levels than the last; the level
 * cap (15 + 8 per rebirth) is what makes later ones need rebirths: cities 1-3 at R0,
 * city 4 at R1, ... the last at R19.
 */
const STAGE_DEFS = [
  // id, name, theme, level, landmark
  ['farm', 'Haybale Farms', 'farm', 1, 'Grain Tower'],
  ['suburb', 'Willow Creek', 'suburb', 5, 'Town Hall Clock'],
  ['metro', 'Metro City', 'downtown', 10, 'Sky Needle'],
  ['gulch', 'Dusty Gulch', 'desert', 16, 'Oil Derrick'],
  ['frost', 'Frostbite Village', 'snow', 22, 'Ice Palace'],
  ['funland', 'Funland Park', 'park', 28, 'Mega Ferris Wheel'],
  ['coast', 'Coconut Coast', 'beach', 35, 'Lighthouse'],
  ['gears', 'Gearworks', 'industrial', 42, 'Power Plant'],
  ['sugar', 'Sugar Rush Town', 'candy', 50, 'Cake Tower'],
  ['kings', 'Kingsbridge', 'medieval', 58, 'Royal Castle'],
  ['anchor', 'Anchor Bay', 'harbor', 66, 'Cargo Crane'],
  ['neon', 'Neon Heights', 'neon', 75, 'Neon Spire'],
  ['magma', 'Magma Falls', 'volcano', 84, 'Fire Temple'],
  ['crystal', 'Crystal Hollow', 'crystal', 94, 'Giant Geode'],
  ['cloud', 'Cloud Kingdom', 'sky', 104, 'Sky Castle'],
  ['moon', 'Moonbase Alpha', 'moon', 115, 'Launch Rocket'],
  ['jungle', 'Jungle Ruins', 'jungle', 126, 'Sun Pyramid'],
  ['cyber', 'Cyber City', 'cyber', 138, 'Mega Mainframe'],
  ['zorg', 'Planet Zorg', 'alien', 150, 'Mothership'],
  ['galaxy', 'Galaxy Core', 'cosmic', 165, 'Star Forge'],
]

/** What each city pays for every PAY_SHARE of it destroyed (3, 7, 15, 32 ...). */
const CITY_WINS = [3, 7, 15, 32, 65, 130, 260, 520, 1000, 2000, 4000, 8000, 15000, 30000, 60000, 120000, 240000, 480000, 950000, 1.9e6]
/**
 * Destroy as many things in a city as PAY_SHARE of everything in it (36 in the first city)
 * and it pays its Wins; every thing counts, again when it's come back. A little
 * destruction, a little Wins. Wins come from nowhere else in the cities.
 */
export const PAY_SHARE = 0.1

/**
 * What everything in city `i` is worth, as a multiplier on SIZES' power: about as much as
 * that city's levels need, for the tornado, rebirths and pets you'll have by then. Tuned
 * with scripts/balance-sim.mjs.
 */
export const POWER_START = 1
export const POWER_GROWTH = 1.8
const stagePower = (i) => round2(POWER_START * POWER_GROWTH ** i)

export const STAGES = STAGE_DEFS.map(([id, name, theme, level, landmark], i) => {
  const next = STAGE_DEFS[i + 1]?.[3] ?? level + 15
  return {
    index: i,
    id,
    name,
    theme,
    level,
    /** The next city's level (or 15 past the last): this city's things reach up to it. */
    levelTop: next,
    /** What every PAY_SHARE of it destroyed pays. */
    wins: CITY_WINS[i],
    landmark: { name: landmark },
    power: stagePower(i),
  }
})

/** The level something of `size` needs in city `stage`. */
export function objectLevel(stage, size) {
  const s = STAGES[stage]
  return Math.max(1, Math.round(s.level + (s.levelTop - s.level) * SIZES[size].lvl - (size === 'landmark' ? 1 : 0)))
}

/** Power one `size` thing in city `stage` is worth, before your multipliers. */
export const objectPower = (stage, size) => SIZES[size].power * STAGES[stage].power

/**
 * Absorb streak: swallow things within STREAK_WINDOW seconds of each other and the streak
 * climbs; each one adds STREAK_STEP to the Power you gain, up to STREAK_MAX more (x2 at
 * 50 in a row). Stop and it starts again.
 */
export const STREAK_WINDOW = 2.5
export const STREAK_STEP = 0.02
export const STREAK_MAX = 0.5
export const streakBonus = (streak) => 1 + Math.min(STREAK_MAX, STREAK_STEP * Math.max(0, streak))

// --- Pets & eggs ------------------------------------------------------------------

export const RARITIES = {
  common: { name: 'Common', color: '#b9c3cf', order: 0 },
  uncommon: { name: 'Uncommon', color: '#4ade80', order: 1 },
  rare: { name: 'Rare', color: '#38bdf8', order: 2 },
  epic: { name: 'Epic', color: '#b15cff', order: 3 },
  legendary: { name: 'Legendary', color: '#ffc41f', order: 4 },
  mythic: { name: 'Mythic', color: '#ff3b6b', order: 5 },
  secret: { name: 'Secret', color: '#ff5bd8', order: 6 },
}

/** `mult` multiplies Power gains. Equipped pets stack additively (see logic.js). */
export const PETS = {
  cat: { name: 'Cat', rarity: 'common', mult: 1.1 },
  dog: { name: 'Dog', rarity: 'common', mult: 1.15 },
  bunny: { name: 'Bunny', rarity: 'uncommon', mult: 1.25 },
  bear: { name: 'Bear', rarity: 'rare', mult: 1.5 },
  cow: { name: 'Cow', rarity: 'uncommon', mult: 1.4 },
  parrot: { name: 'Parrot', rarity: 'rare', mult: 1.7 },
  fox: { name: 'Fox', rarity: 'epic', mult: 2.2 },
  tiger: { name: 'Tiger', rarity: 'legendary', mult: 3 },
  flamingo: { name: 'Flamingo', rarity: 'uncommon', mult: 2.5 },
  turtle: { name: 'Turtle', rarity: 'rare', mult: 3.2 },
  owl: { name: 'Owl', rarity: 'epic', mult: 4.5 },
  phoenix: { name: 'Phoenix', rarity: 'legendary', mult: 7 },
  pony: { name: 'Pony', rarity: 'rare', mult: 5 },
  unicorn: { name: 'Unicorn', rarity: 'epic', mult: 8 },
  pegasus: { name: 'Pegasus', rarity: 'legendary', mult: 13 },
  salamander: { name: 'Salamander', rarity: 'rare', mult: 10 },
  firebird: { name: 'Fire Bird', rarity: 'epic', mult: 16 },
  golem: { name: 'Magma Golem', rarity: 'legendary', mult: 26 },
  inferno: { name: 'Inferno Wolf', rarity: 'mythic', mult: 45 },
  dragon: { name: 'Dragon', rarity: 'epic', mult: 2.5 },
  crab: { name: 'Lucky Crab', rarity: 'uncommon', mult: 1.2 },
  sphinx: { name: 'Sphinx', rarity: 'secret', mult: 80 },
}

/**
 * Eggs, bought with Wins at their stands in the lobby. `pets` are [petId, weight] -
 * weights are percentages and sum to 100. Each is priced at a few minutes of trophies in
 * the city whose pets it beats.
 */
export const EGGS = {
  basic: { name: 'Basic', cost: { wins: 25 }, pets: [['cat', 45], ['dog', 30], ['bunny', 20], ['bear', 5]] },
  meadow: { name: 'Grass', cost: { wins: 400 }, pets: [['cow', 45], ['parrot', 30], ['fox', 20], ['tiger', 5]] },
  sunset: { name: 'Sunset', cost: { wins: 6000 }, pets: [['flamingo', 45], ['turtle', 30], ['owl', 20], ['phoenix', 5]] },
  unicorn: { name: 'Unicorn', cost: { wins: 90000 }, pets: [['pony', 50], ['unicorn', 35], ['pegasus', 15]] },
  volcano: { name: 'Volcano', cost: { wins: 1.5e6 }, pets: [['salamander', 50], ['firebird', 30], ['golem', 15], ['inferno', 5]] },
}

export const MAX_EQUIPPED_PETS = 3
export const MAX_PET_INVENTORY = 60
/** Multi-hatch opens this many at once, for that many times the cost. */
export const MULTI_HATCH = 3

// --- Items, boosts, rewards -------------------------------------------------------

export const POTION_DURATION_MS = 5 * 60 * 1000

export const ITEMS = {
  potionHealth: { name: 'x2 Power Potion', kind: 'potion', boost: 'health', durationMs: POTION_DURATION_MS },
  potionWins: { name: 'x2 Wins Potion', kind: 'potion', boost: 'wins', durationMs: POTION_DURATION_MS },
  eggMeadow: { name: 'Grass Egg', kind: 'egg', egg: 'meadow' },
  eggSunset: { name: 'Sunset Egg', kind: 'egg', egg: 'sunset' },
  eggUnicorn: { name: 'Unicorn Egg', kind: 'egg', egg: 'unicorn' },
  eggVolcano: { name: 'Volcano Egg', kind: 'egg', egg: 'volcano' },
}

/** 7-day cycle; day N unlocks N x 24h after the cycle started. */
export const DAILY_INTERVAL_MS = 24 * 60 * 60 * 1000
export const DAILY_REWARDS = [
  { label: 'x2 Wins', icon: 'potionWins', sub: '5m', grant: { item: 'potionWins' } },
  { label: 'Dragon', icon: 'pet:dragon', sub: 'x1', grant: { pet: 'dragon' } },
  { label: 'x2 Power', icon: 'potionHealth', sub: '5m', grant: { item: 'potionHealth' } },
  { label: 'Unicorn Egg', icon: 'egg:unicorn', sub: 'x1', grant: { item: 'eggUnicorn' } },
  { label: 'x2 Power', icon: 'potionHealth', sub: '5m', grant: { item: 'potionHealth' } },
  { label: 'x2 Wins', icon: 'potionWins', sub: '5m', grant: { item: 'potionWins' } },
  { label: 'Volcano Egg', icon: 'egg:volcano', sub: 'x1', grant: { item: 'eggVolcano' } },
]

/**
 * Claimable once each per session, after this many minutes played: something to look
 * forward to every few minutes for the first hour.
 */
export const PLAYTIME_REWARDS = [
  { minutes: 3, label: '+10 Wins', icon: 'trophy', grant: { wins: 10 } },
  { minutes: 8, label: 'x2 Power', icon: 'potionHealth', grant: { item: 'potionHealth' } },
  { minutes: 15, label: 'Grass Egg', icon: 'egg:meadow', grant: { item: 'eggMeadow' } },
  { minutes: 25, label: 'x2 Wins', icon: 'potionWins', grant: { item: 'potionWins' } },
  { minutes: 35, label: '+250 Wins', icon: 'trophy', grant: { wins: 250 } },
  { minutes: 45, label: 'Sunset Egg', icon: 'egg:sunset', grant: { item: 'eggSunset' } },
  { minutes: 60, label: 'x2 Power', icon: 'potionHealth', grant: { item: 'potionHealth' } },
  { minutes: 90, label: 'Unicorn Egg', icon: 'egg:unicorn', grant: { item: 'eggUnicorn' } },
]

/** The stand by spawn: a pet the first time, a potion on later sessions. */
export const FREE_REWARD = { firstTime: { pet: 'crab' }, repeat: { item: 'potionHealth' } }

/** Offline: a quarter of your Storm Zone's rate, for up to 8 hours away. */
export const OFFLINE_RATE = 0.25
export const OFFLINE_MAX_MS = 8 * 60 * 60 * 1000
export const OFFLINE_MIN_MS = 60 * 1000

// --- Shop -------------------------------------------------------------------------

/**
 * The shop. Wins are the game's only currency: everything here, like tornadoes and
 * eggs, is bought with them. `pass` = permanent unlock; `consumable` = grants every time.
 */
export const SHOP = {
  healthX2: { name: 'x2 Power', price: 600, kind: 'pass' },
  winsX2: { name: 'x2 Wins', price: 3000, kind: 'pass' },
  bigStorm: { name: 'Big Storm', price: 1500, kind: 'pass' },
  padVeryOp: { name: 'Hyper Zone', price: 250000, kind: 'pass' },
  padBest: { name: 'Cosmic Zone', price: 4e6, kind: 'pass' },
  sphinx: { name: 'Sphinx', price: 5e6, kind: 'consumable', grant: { pet: 'sphinx' }, stock: 1000 },
}

/**
 * Boxity Gems products, by sku. Prices live in Boxity's catalog, never here: the game
 * only names the sku and, once Boxity confirms the sale, grants what it says. Wins packs
 * grow with you: `winsPays` city pays' worth in your best city.
 */
export const GEM_PRODUCTS = {
  wins_small: { name: 'Pile of Wins', blurb: '15 city pays of Wins', icon: 'trophy', grant: { winsPays: 15 } },
  wins_big: { name: 'Mountain of Wins', blurb: '90 city pays of Wins', icon: 'trophy', grant: { winsPays: 90 } },
  potion_bundle: { name: 'Potion Bundle', blurb: '3 x2 Power + 3 x2 Wins potions', icon: 'potionHealth', grant: { items: { potionHealth: 3, potionWins: 3 } } },
  volcano_eggs: { name: '3 Volcano Eggs', blurb: 'The best pets in the game', icon: 'egg:volcano', grant: { items: { eggVolcano: 3 } } },
  big_storm: { name: 'Big Storm', blurb: '+25% tornado size, forever', icon: 'tornado', grant: { pass: 'bigStorm' } },
  health_x2: { name: 'x2 Power', blurb: 'Double every Power gain, forever', icon: 'bolt', grant: { pass: 'healthX2' } },
  wins_x2: { name: 'x2 Wins', blurb: 'Double every Win, forever', icon: 'trophy', grant: { pass: 'winsX2' } },
  pad_best: { name: 'Cosmic Zone', blurb: 'Unlocks the x100 Cosmic Zone', icon: 'portal', grant: { pass: 'padBest' } },
}

/**
 * Rewarded ads (Boxity): watch one to earn this. Placement names are lowercase, digits
 * and hyphens. `cooldownMs` keeps a player from chaining them.
 */
export const AD_REWARDS = {
  'health-potion': { label: 'x2 Power Potion', icon: 'potionHealth', grant: { item: 'potionHealth' }, cooldownMs: 3 * 60 * 1000 },
  'wins-potion': { label: 'x2 Wins Potion', icon: 'potionWins', grant: { item: 'potionWins' }, cooldownMs: 3 * 60 * 1000 },
}

/** Sphinx stock shown before the server reports the live count. */
export const SPHINX_STOCK_DEFAULT = 954

/**
 * The three level packs under the level bar: +1, +5 and +20 levels' worth of Power (never
 * past your max level), each for `pays` city pays' Wins in your best city.
 */
export const LEVEL_PACKS = [
  { levels: 1, pays: 3 },
  { levels: 5, pays: 12 },
  { levels: 20, pays: 40 },
]

// --- Coming back for more: streaks, quests, lucky gifts, friends ---------------------

/**
 * A game day, in UTC: quests reset and login streaks count by it, the same for everyone
 * everywhere (`dayNumber(now)` is the day since 1970).
 */
export const DAY_MS = 24 * 60 * 60 * 1000
export const dayNumber = (now) => Math.floor(now / DAY_MS)

/**
 * Login streak: play on consecutive days and every Win pays LOGIN_STEP more per day in a
 * row (day 1 x1, day 2 x1.1 ... day 11 and on x2). Miss a day and it starts again.
 */
export const LOGIN_STEP = 0.1
export const LOGIN_MAX_DAYS = 11
export const loginMultiplier = (days) => 1 + LOGIN_STEP * (Math.min(LOGIN_MAX_DAYS, Math.max(1, days)) - 1)

/**
 * Playing together: every other player in your server adds CROWD_STEP to the Wins your
 * trophies and landmarks pay, up to CROWD_MAX - bring your friends.
 */
export const CROWD_STEP = 0.1
export const CROWD_MAX = 0.3
export const crowdBonus = (others) => 1 + Math.min(CROWD_MAX, CROWD_STEP * Math.max(0, others))

/**
 * Lucky gifts: each time a city pays its Wins it has LUCKY_CHANCE of dropping a surprise
 * on top. `weight`s are relative. Wins gifts grow with you (`winsPays`); an egg gift is an
 * egg that fits how far you've got (logic.eggItemFor).
 */
export const LUCKY_CHANCE = 0.08
export const LUCKY_GIFTS = [
  { weight: 45, label: 'Bag of Wins', icon: 'trophy', grant: { winsPays: 4 } },
  { weight: 20, label: 'x2 Wins Potion', icon: 'potionWins', grant: { item: 'potionWins' } },
  { weight: 20, label: 'x2 Power Potion', icon: 'potionHealth', grant: { item: 'potionHealth' } },
  { weight: 15, label: 'Mystery Egg', icon: 'egg', grant: { egg: true } },
]

/**
 * Daily quests: QUESTS_PER_DAY a day - an EASY, a MEDIUM and a HARD one of different
 * kinds, picked fresh each day for each player - and a bonus chest for finishing all
 * three. Rewards grow with you: `winsPays` city pays' worth in your best city
 * (HARD adds a potion; the chest adds an egg that fits your progress). Each kind counts
 * one thing (`counter`, fed by the session as you play) up to its target; `mode: 'best'`
 * keeps the best single value instead of adding up. `{n}` in `text` is the target.
 */
export const QUESTS_PER_DAY = 3
export const QUEST_TIERS = [
  { id: 'easy', label: 'EASY', winsPays: 4 },
  { id: 'medium', label: 'MEDIUM', winsPays: 8 },
  { id: 'hard', label: 'HARD', winsPays: 16, item: 'potionWins' },
]
export const QUEST_BONUS = { winsPays: 20 }
export const QUEST_TYPES = {
  absorb: { counter: 'absorb', text: 'Absorb {n} things', targets: [60, 200, 500] },
  trophy: { counter: 'trophy', text: 'Destroy {n} Giant Trophies', targets: [2, 6, 15] },
  big: { counter: 'big', text: 'Absorb {n} houses or towers', targets: [8, 25, 60] },
  streak: { counter: 'streak', mode: 'best', text: 'Reach a x{n} streak', targets: [15, 30, 50] },
  levels: { counter: 'level', text: 'Gain {n} levels', targets: [3, 8, 16] },
  surge: { counter: 'surge', text: 'Use Surge {n} times', targets: [3, 8, 20] },
  hatch: { counter: 'hatch', text: 'Hatch {n} pets', targets: [1, 3, 6] },
  minutes: { counter: 'minute', text: 'Play for {n} minutes', targets: [5, 15, 30] },
}

// --- Tutorial & badges ------------------------------------------------------------

/**
 * The guide for new players: train in a Storm Zone, go into the first city and destroy
 * things in it for Wins, come back to the lobby and spend them on a new tornado. Each
 * step completes when its event fires (and, with `health`, once you have that much
 * Power); `target` is what the arrows point at. After the last the guide is done.
 */
export const TUTORIAL = [
  { text: 'Stand in a STORM ZONE to train your tornado!', event: 'train', target: 'pad', health: 20 },
  { text: 'Go through the gate into STAGE 1!', event: 'enter', target: 'gate' },
  { text: 'Destroy things in Stage 1 to win Wins!', event: 'cityWins', target: 'stuff' },
  { text: 'Go back to the LOBBY!', event: 'lobby', target: 'lobby' },
  { text: 'Buy the Gusty Swirl for 3 Wins!', event: 'buyTornado', target: 'types' },
]

export const BADGES = {
  firstAbsorb: { name: 'First Gust' },
  firstTrophy: { name: 'Trophy Hunter' },
  firstLandmark: { name: 'Landmark Wrecker' },
  firstRebirth: { name: 'First Rebirth' },
  firstPet: { name: 'Pet Owner' },
  stage5: { name: 'City Hopper' },
  stage10: { name: 'World Wrecker' },
  stage20: { name: 'Galaxy Storm' },
  streak50: { name: 'Unstoppable' },
  smashed10k: { name: 'Ten Thousand Smashed' },
}
