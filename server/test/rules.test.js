import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  healthForLevel,
  levelCap,
  nextRebirthGift,
  PADS,
  rebirthGift,
  rebirthMultiplier,
  ringsFor,
  SIZES,
  STAGES,
  TORNADOES,
  TUTORIAL,
  UPGRADES,
} from '../../shared/balance.js'
import { forObjectsNear, ID_STRIDE, KINDS, objectById, payStep, stageLayout, THEMES } from '../../shared/cities.js'
import { formatNumber } from '../../shared/format.js'
import {
  absorbObject,
  applyAdReward,
  applyGemProduct,
  applyRebirth,
  applyTrain,
  buyLevelPack,
  buyTornado,
  buyUpgrade,
  createProfile,
  createSession,
  equipTornado,
  isMaxLevel,
  levelPacks,
  normalizeProfile,
  rebirthSkipPrice,
  skipRebirth,
  tearTime,
  tornadoRadius,
  unlockStages,
  upgradePrice,
} from '../../shared/logic.js'
import { PlayerSession } from '../../shared/session.js'
import { clampToWalkable, gateZ, LOBBY, PAD_X, padCenterZ, SPAWN, stageAt, stageEntry, stageRect, walkableRects } from '../../shared/world.js'

function makeSession(position = { x: SPAWN.x, y: 0, z: SPAWN.z }, profile = createProfile('p', 'P')) {
  const pos = { y: 0, ...position }
  const events = []
  const session = new PlayerSession(profile, {
    now: 0,
    emit: (type, payload) => events.push({ type, payload }),
    getPosition: () => pos,
    setPosition: (x, z) => Object.assign(pos, { x, z }),
    rand: () => 0.99,
  })
  const count = (type) => events.filter((e) => e.type === type).length
  const last = (type) => [...events].reverse().find((e) => e.type === type)?.payload
  return { session, profile, events, count, last, pos }
}

/** Straight to max level. */
function toCap(p) {
  p.level = levelCap(p.rebirths)
  p.health = healthForLevel(p.level)
}

test('numbers format like the HUD', () => {
  assert.equal(formatNumber(950), '950')
  assert.equal(formatNumber(1234), '1.2K')
  assert.equal(formatNumber(2.5e6), '2.5M')
})

// --- Levels and rebirth (the template's system, unchanged) --------------------------

test('max level is 15 + 8 per rebirth; each rebirth adds x1 to gains', () => {
  assert.deepEqual([0, 1, 2, 10].map(levelCap), [15, 23, 31, 95])
  assert.deepEqual([0, 1, 5].map(rebirthMultiplier), [1, 2, 6])
})

test('each level needs more Power than the one before, and the steps keep growing', () => {
  for (let level = 2; level < 300; level += 1) {
    assert.ok(healthForLevel(level) > healthForLevel(level - 1), `level ${level}`)
    // Thresholds are rounded to two figures, so compare five-level stretches.
    if (level > 10) assert.ok(healthForLevel(level) - healthForLevel(level - 5) > healthForLevel(level - 5) - healthForLevel(level - 10), `stretch at ${level}`)
  }
})

test('rebirth needs max level, resets Power, keeps Wins, tornadoes, upgrades and open cities', () => {
  const p = createProfile('a', 'A')
  assert.equal(applyRebirth(p).ok, false)
  toCap(p)
  p.wins = 500
  p.unlocked = 2
  p.upgrades.size = 3
  p.ownedTornadoes.push('gust')
  assert.equal(applyRebirth(p).ok, true)
  assert.equal(p.rebirths, 1)
  assert.equal(p.health, 0)
  assert.equal(p.level, 1)
  assert.equal(p.wins, 500)
  assert.equal(p.unlocked, 2)
  assert.equal(p.upgrades.size, 3)
  assert.deepEqual(p.ownedTornadoes, ['breeze', 'gust'])
})

test('skipping to a rebirth costs Wins', () => {
  const p = createProfile('a', 'A')
  const price = rebirthSkipPrice(p)
  assert.equal(skipRebirth(p).ok, false)
  p.wins = price
  assert.equal(skipRebirth(p).ok, true)
  assert.equal(p.rebirths, 1)
  assert.equal(p.wins, 0)
})

test('every 5th rebirth from 15 gives Volcano eggs', () => {
  assert.equal(rebirthGift(14), null)
  assert.deepEqual([15, 20, 25, 35, 100].map((r) => rebirthGift(r).amount), [3, 3, 4, 5, 6])
  assert.equal(nextRebirthGift(0).rebirths, 15)
  const p = createProfile('a', 'A')
  p.rebirths = 14
  toCap(p)
  assert.equal(applyRebirth(p).gift.rebirths, 15)
  assert.equal(p.items.eggVolcano, 3)
})

// --- Cities -------------------------------------------------------------------------

test('twenty cities pay 3 then 7 Wins, levels climb, every theme exists', () => {
  assert.equal(STAGES.length, 20)
  assert.equal(STAGES[0].wins, 3)
  assert.equal(STAGES[1].wins, 7)
  assert.equal(TORNADOES[1].cost, 3, 'the first tornado costs one pay of the first city')
  for (let i = 1; i < STAGES.length; i += 1) {
    assert.ok(STAGES[i].level > STAGES[i - 1].level)
    assert.ok(STAGES[i].wins > STAGES[i - 1].wins)
    assert.ok(STAGES[i].power > STAGES[i - 1].power)
    assert.ok(THEMES[STAGES[i].theme], STAGES[i].theme)
  }
  // Cities past the R0 cap need rebirths.
  assert.ok(STAGES[3].level > levelCap(0))
})

test('city layouts are the same every time, with ids that find their objects', () => {
  for (let i = 0; i < STAGES.length; i += 1) {
    const layout = stageLayout(i)
    assert.equal(stageLayout(i), layout, 'cached')
    assert.equal(layout.trophies.length, 4)
    assert.ok(layout.objects.length > 150 && layout.objects.length < ID_STRIDE, `${layout.objects.length}`)
    for (const o of layout.objects) {
      assert.equal(objectById(o.id), o)
      assert.equal(stageAt(o.x, o.z), i, `object ${o.id} on its island`)
      if (o.size !== 'landmark') assert.ok(KINDS[o.kind], o.kind)
    }
    assert.equal(layout.objects[layout.landmark].size, 'landmark')
    assert.ok(layout.objects.every((o) => !o.wins), 'nothing in a city pays Wins by itself')
  }
})

test('the spatial grid finds everything near a point', () => {
  const layout = stageLayout(2)
  for (const o of layout.objects.slice(0, 60)) {
    let found = false
    forObjectsNear(layout, o.x, o.z, o.x, o.z, 1, (x) => {
      if (x === o) found = true
    })
    assert.ok(found, `object ${o.id}`)
  }
})

test('gates open at their level, for good', () => {
  const p = createProfile('a', 'A')
  assert.equal(p.unlocked, 0)
  p.level = STAGES[2].level
  const opened = unlockStages(p)
  assert.deepEqual(opened.map((o) => o.index), [1, 2])
  assert.equal(p.wins, 0, 'Wins come from clearing cities, not opening them')
  p.level = 1
  assert.deepEqual(unlockStages(p), [])
  assert.equal(p.unlocked, 2, 'still open after a rebirth')
})

test('you can walk up to a closed gate, never through it', () => {
  const out = clampToWalkable(0, stageRect(1).minZ + 20, 0)
  assert.ok(out.z > gateZ(1), 'stopped short of city 2')
  const inside = clampToWalkable(10, stageRect(0).minZ + 30, 0)
  assert.equal(stageAt(inside.x, inside.z), 0, 'city 1 is open')
  const lobby = clampToWalkable(5, 10, 0)
  assert.deepEqual(lobby, { x: 5, z: 10 })
  const far = clampToWalkable(500, 0, 0)
  assert.ok(walkableRects(0).some((r) => far.x >= r.minX && far.x <= r.maxX && far.z >= r.minZ && far.z <= r.maxZ), 'somewhere walkable')
  assert.ok(far.x <= LOBBY.maxX || stageAt(far.x, far.z) === 0)
})

// --- Absorbing ----------------------------------------------------------------------

test('swallowing something pays its Power times your multipliers, and no Wins', () => {
  const p = createProfile('a', 'A')
  const layout = stageLayout(0)
  const tiny = layout.objects.find((o) => o.size === 'tiny')
  const r = absorbObject(p, tiny, 0)
  assert.ok(r.gain > 0)
  assert.equal(p.stats.absorbed, 1)
  assert.deepEqual(p.index, [tiny.kind], 'into the Index')
  const trophy = layout.objects[layout.trophies[0]]
  const t = absorbObject(p, trophy, 0)
  assert.equal(t.wins, 0)
  assert.equal(p.wins, 0)
  assert.equal(p.stats.trophies, 1)
})

test('the server decides what the tornado swallows along its path, and each thing comes back later', () => {
  const layout = stageLayout(0)
  const target = layout.objects.find((o) => o.size === 'tiny' && o.level === 1)
  const { session, profile, events, last, pos } = makeSession({ x: target.x - 12, z: target.z })
  const takes = () => events.filter((e) => e.type === 'absorb' && e.payload.ids.includes(target.id)).length
  session.tick(0.1, 0)
  assert.equal(takes(), 0, 'too far')
  // A move across it in one tick: swallowed on the way, even though it ends past it.
  pos.x = target.x + 1
  session.tick(0.1, 100)
  assert.equal(takes(), 1, 'swallowed on the way past')
  assert.ok(profile.health > 0)
  assert.equal(last('absorb').round.stage, 0)
  assert.equal(last('absorb').round.step, payStep(0))
  // Standing on its spot: it stays gone until its respawn time.
  pos.x = target.x
  for (let t = 200; t < 2000; t += 100) session.tick(0.1, t)
  assert.equal(takes(), 1)
  assert.ok(session.down.get(target.id) > 2000)
  pos.x = target.x + 40
  session.tick(0.1, 2100)
  pos.x = target.x
  session.tick(0.1, SIZES.tiny.respawn * 1000 + 500)
  assert.equal(takes(), 2, 'back after its respawn')
})

test('every few things destroyed in a city pay its Wins, and things that came back count again', () => {
  const layout = stageLayout(0)
  const { session, profile, events, last } = makeSession({ x: layout.objects[0].x, z: layout.objects[0].z })
  const step = payStep(0)
  assert.equal(step, Math.ceil(layout.objects.length * 0.1))
  const pays = () => events.filter((e) => e.type === 'cityWins')
  session.absorb(layout.objects.slice(0, step - 1), 0)
  assert.equal(pays().length, 0, 'not yet')
  assert.equal(profile.wins, 0, 'nothing in the city pays Wins by itself')
  assert.equal(last('absorb').round.done, step - 1)
  session.absorb([layout.objects[step - 1]], 100)
  assert.equal(pays().length, 1, 'the first pay')
  assert.equal(last('cityWins').wins, STAGES[0].wins)
  assert.equal(profile.wins, STAGES[0].wins, 'enough for the first tornado')
  assert.equal(last('absorb').round.done, 0, 'the count to the next pay starts again')
  // The same things again (back after their respawn) count too.
  session.absorb(layout.objects.slice(0, step), 600000)
  assert.equal(pays().length, 2)
  assert.equal(profile.wins, STAGES[0].wins * 2)
})

test('nothing needs a level: a weak tornado tears big things up too, just slower', () => {
  const layout = stageLayout(0)
  const big = layout.objects.find((o) => o.size === 'large')
  const { session, profile } = makeSession({ x: big.x, z: big.z })
  assert.ok(big.level > profile.level)
  const time = tearTime(profile, big)
  assert.ok(time > 0.5, `takes a while (${time}s)`)
  let t = 0
  for (; t < (time * 1000) / 2; t += 100) session.tick(0.1, t)
  assert.equal(session.down.has(big.id), false, 'not yet')
  for (; t < time * 1000 + 600; t += 100) session.tick(0.1, t)
  assert.equal(session.down.has(big.id), true, 'torn up')
  // Stronger (a higher level, a stronger tornado type) tears it up faster.
  const strong = createProfile('s', 'S')
  strong.level = big.level + 6
  assert.ok(tearTime(strong, big) < time / 3)
  strong.equippedTornado = 'thunder'
  assert.ok(tearTime(strong, big) < tearTime({ ...strong, equippedTornado: 'breeze' }, big))
})

test('a Giant Trophy breaks only after you hold the funnel over it long enough', () => {
  const layout = stageLayout(0)
  const trophy = layout.objects[layout.trophies[0]]
  const profile = createProfile('p', 'P')
  profile.health = healthForLevel(trophy.level)
  profile.level = trophy.level
  const { session } = makeSession({ x: trophy.x, z: trophy.z }, profile)
  let t = 0
  for (; t < 1000; t += 100) session.tick(0.1, t)
  assert.ok(!session.down.has(trophy.id), 'one second is not enough')
  for (; t < 6000 && !session.down.has(trophy.id); t += 100) session.tick(0.1, t)
  assert.ok(session.down.has(trophy.id), 'broken')
  assert.equal(profile.stats.trophies, 1)
})

test('cities past your open gate pay nothing even if you somehow stand in them', () => {
  const layout = stageLayout(1)
  const o = layout.objects.find((x) => x.size === 'tiny')
  const profile = createProfile('p', 'P')
  profile.level = 99
  profile.health = healthForLevel(99)
  profile.rebirths = 20
  const { session } = makeSession({ x: o.x, z: o.z }, profile)
  profile.unlocked = 0
  session.tick(0.1, 0)
  session.tick(0.1, 100)
  assert.equal(profile.stats.absorbed, 0)
})

test('the streak climbs while you keep swallowing and adds to your Power', () => {
  const layout = stageLayout(0)
  const tinies = layout.objects.filter((o) => o.size === 'tiny' && o.level === 1).slice(0, 20)
  const { session, profile, last } = makeSession({ x: tinies[0].x, z: tinies[0].z })
  let t = 0
  for (const o of tinies) {
    session.absorb([o], t)
    t += 500
  }
  assert.equal(last('absorb').streak, 20)
  assert.ok(profile.stats.bestStreak >= 20)
  session.absorb([layout.objects.find((o) => o.size === 'tiny' && !tinies.includes(o))], t + 10000)
  assert.equal(last('absorb').streak, 1, 'starts again after a pause')
})

test('the Surge takes everything in reach at once, then needs its cooldown', () => {
  const layout = stageLayout(0)
  const centre = layout.objects.find((o) => o.size === 'tiny' && o.level === 1)
  const { session, count, last } = makeSession({ x: centre.x, z: centre.z })
  session.handle('surge', {}, 0)
  assert.equal(count('surge'), 1)
  assert.ok(last('absorb').ids.length > 1, `took ${last('absorb')?.ids.length}`)
  assert.equal(last('absorb').surge, true)
  session.handle('surge', {}, 1000)
  assert.equal(count('surge'), 1, 'cooling down')
})

test('your funnel grows a ring every few levels, and with the size upgrade', () => {
  const p = createProfile('a', 'A')
  const r1 = tornadoRadius(p)
  p.level = 10
  assert.equal(ringsFor(10), 4)
  assert.ok(tornadoRadius(p) > r1)
  const r10 = tornadoRadius(p)
  p.upgrades.size = 5
  assert.ok(tornadoRadius(p) > r10)
  p.passes.bigStorm = true
  assert.ok(tornadoRadius(p) > tornadoRadius({ ...p, passes: {} }))
})

// --- Spending -----------------------------------------------------------------------

test('tornadoes are bought in order with Wins, and the first is cheap', () => {
  const p = createProfile('a', 'A')
  assert.equal(TORNADOES[1].cost, 3)
  assert.equal(buyTornado(p, 'sand').ok, false, 'not before the Gusty Swirl')
  p.wins = 2
  assert.equal(buyTornado(p, 'gust').ok, false)
  p.wins = 3
  assert.equal(buyTornado(p, 'gust').ok, true)
  assert.equal(p.equippedTornado, 'gust')
  assert.equal(p.wins, 0)
  assert.equal(equipTornado(p, 'breeze').ok, true)
  assert.equal(equipTornado(p, 'sand').ok, false)
  for (let i = 1; i < TORNADOES.length; i += 1) {
    assert.ok(TORNADOES[i].cost > TORNADOES[i - 1].cost)
    assert.ok(TORNADOES[i].power > TORNADOES[i - 1].power)
  }
})

test('upgrades cost more each level and stop at their max', () => {
  const p = createProfile('a', 'A')
  p.wins = 1e15
  let last = 0
  for (let i = 0; i < UPGRADES.size.max; i += 1) {
    const price = upgradePrice(p, 'size')
    assert.ok(price > last)
    last = price
    assert.equal(buyUpgrade(p, 'size').ok, true)
  }
  assert.equal(upgradePrice(p, 'size'), null)
  assert.equal(buyUpgrade(p, 'size').ok, false)
})

test('level packs add exactly their levels, never past max', () => {
  const p = createProfile('a', 'A')
  p.wins = 1e9
  const packs = levelPacks(p)
  assert.deepEqual(packs.map((x) => x.levels), [1, 5, 20])
  assert.equal(buyLevelPack(p, 1).ok, true)
  assert.equal(p.level, 6)
  assert.equal(buyLevelPack(p, 2).ok, true)
  assert.equal(p.level, levelCap(0), 'stopped at max level')
  assert.ok(isMaxLevel(p))
  assert.equal(buyLevelPack(p, 0).ok, false)
})

test('Storm Zones give Power by themselves, only when open', () => {
  const p = createProfile('a', 'A')
  assert.equal(applyTrain(p, 1, 0).ok, false, 'needs a rebirth')
  assert.equal(applyTrain(p, 0, 0).ok, true)
  assert.ok(p.health > 0)
  const { session, profile } = makeSession({ x: PAD_X, z: padCenterZ(0) })
  for (let t = 0; t < 3000; t += 100) session.tick(0.1, t)
  assert.ok(profile.health >= PADS[0].mult * 4)
})

test('teleport only to open cities or the lobby', () => {
  const { session, pos, last } = makeSession()
  session.handle('teleport', { stage: 3 }, 0)
  assert.equal(last('teleport'), undefined)
  session.handle('teleport', { stage: 0 }, 0)
  assert.deepEqual({ x: pos.x, z: pos.z }, stageEntry(0))
  session.handle('teleport', { stage: -1 }, 0)
  assert.deepEqual({ x: pos.x, z: pos.z }, SPAWN)
})

test('Gems products grant passes, and an owned pass turns into Wins', () => {
  const p = createProfile('a', 'A')
  assert.equal(applyGemProduct(p, 'health_x2').pass, 'healthX2')
  assert.equal(p.passes.healthX2, true)
  const again = applyGemProduct(p, 'health_x2')
  assert.ok(again.wins > 0)
  assert.equal(applyGemProduct(p, 'nope').ok, false)
})

test('ad rewards have a cooldown per placement', () => {
  const p = createProfile('a', 'A')
  const s = createSession(0)
  assert.equal(applyAdReward(p, s, 'health-potion', 1e6).ok, true)
  assert.equal(applyAdReward(p, s, 'health-potion', 1e6 + 1000).ok, false)
  assert.equal(applyAdReward(p, s, 'wins-potion', 1e6 + 1000).ok, true)
})

test('old or corrupt saves load with defaults filled in', () => {
  const p = normalizeProfile({ wins: -5, ownedTornadoes: ['nope'], equippedTornado: 'nope', unlocked: 99, upgrades: { size: 99 }, index: ['hay', 'bogus'] }, 'x', 'X')
  assert.equal(p.wins, 0)
  assert.deepEqual(p.ownedTornadoes, ['breeze'])
  assert.equal(p.equippedTornado, 'breeze')
  assert.equal(p.unlocked, STAGES.length - 1)
  assert.equal(p.upgrades.size, UPGRADES.size.max)
  assert.deepEqual(p.index, ['hay'])
  assert.deepEqual(normalizeProfile(null, 'y', 'Y'), createProfile('y', 'Y'))
  assert.equal(normalizeProfile({ health: healthForLevel(5) }, 'z', 'Z').level, 5, 'level recomputed from Power')
})

test('only brand-new players get the tutorial', () => {
  assert.equal(normalizeProfile({ rebirths: 0, tutorialStep: 1 }, 'a', 'A').tutorialStep, 1)
  assert.equal(normalizeProfile({ rebirths: 1, tutorialStep: 1 }, 'b', 'B').tutorialStep, TUTORIAL.length)
})

test('ads and Gems are granted by the host only, never by a client message', () => {
  const { session, profile, count } = makeSession()
  session.handle('grantAdReward', { placement: 'health-potion' }, 0)
  session.handle('grantGemProduct', { sku: 'wins_big' }, 0)
  session.handle('adReward', { placement: 'health-potion' }, 0)
  assert.equal(profile.wins, 0)
  assert.deepEqual(profile.items, {})
  assert.equal(session.grantAdReward('health-potion', 1e6).ok, true)
  assert.equal(session.grantGemProduct('wins_big').ok, true)
  assert.ok(profile.wins > 0)
  assert.equal(count('reward'), 2)
})

test('a rebirth gift is announced to the player', () => {
  const { session, profile, events } = makeSession()
  profile.rebirths = 19
  toCap(profile)
  session.handle('rebirth', {}, 0)
  assert.match(events.find((e) => e.type === 'reward').payload.label, /REBIRTH 20 GIFT: 3 Volcano Eggs/)
})

test('a server tick is cheap: a full room of tornadoes in a busy city', () => {
  const layout = stageLayout(5)
  const profile = createProfile('p', 'P')
  profile.rebirths = 5
  profile.unlocked = 5
  toCap(profile)
  const { session, pos } = makeSession({ x: 0, z: layout.cz + 40 }, profile)
  const started = performance.now()
  let t = 0
  for (let i = 0; i < 3000; i += 1) {
    pos.x = Math.sin(i * 0.05) * 60
    pos.z = layout.cz + Math.cos(i * 0.031) * 60
    session.tick(0.1, (t += 100))
  }
  const perTick = (performance.now() - started) / 3000
  assert.ok(perTick < 0.5, `${perTick.toFixed(3)} ms per tick`)
})
