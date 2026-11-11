import assert from 'node:assert/strict'
import { test } from 'node:test'

import { crowdBonus, DAY_MS, LUCKY_CHANCE, QUEST_TIERS, QUEST_TYPES, QUESTS_PER_DAY, streakBonus, STREAK_MAX, loginMultiplier } from '../../shared/balance.js'
import { stageLayout } from '../../shared/cities.js'
import { applyStreak, claimQuest, claimQuestBonus, createQuestDay, ensureQuests, progressQuests, questsReady, rollLuckyGift } from '../../shared/engage.js'
import { createProfile, normalizeProfile, winsForPays, winsMultiplier } from '../../shared/logic.js'
import { PlayerSession } from '../../shared/session.js'

const DAY = 20000 * DAY_MS

test('each day deals three quests: easy, medium, hard, all different, the same on every call', () => {
  const p = createProfile('quester', 'Q')
  const a = createQuestDay(p, 20000)
  const b = createQuestDay(p, 20000)
  assert.equal(a.list.length, QUESTS_PER_DAY)
  assert.deepEqual(a, b)
  assert.deepEqual(a.list.map((q) => q.tier), [0, 1, 2])
  assert.equal(new Set(a.list.map((q) => q.type)).size, QUESTS_PER_DAY)
  for (const q of a.list) assert.equal(q.target, QUEST_TYPES[q.type].targets[q.tier])
  assert.notDeepEqual(createQuestDay(p, 20001).list.map((q) => q.type), a.list.map((q) => q.type).concat('x'))
})

test('quests count what you do, finish once, and pay a reward that grows with you', () => {
  const p = createProfile('q2', 'Q')
  ensureQuests(p, DAY)
  const quest = p.quests.list[0]
  const counter = QUEST_TYPES[quest.type].counter
  assert.deepEqual(progressQuests(p, counter, quest.target, DAY), [0])
  assert.deepEqual(progressQuests(p, counter, 5, DAY), [], 'finished once')
  assert.equal(questsReady(p, DAY), true)
  const before = p.wins
  const claim = claimQuest(p, 0, DAY)
  assert.equal(claim.ok, true)
  assert.equal(p.wins - before, winsForPays(p, QUEST_TIERS[0].winsPays))
  assert.equal(claimQuest(p, 0, DAY).ok, false, 'claimed once')
  // A player further on gets more for the same quest.
  const far = createProfile('q3', 'Q')
  far.unlocked = 10
  assert.ok(winsForPays(far, 1) > winsForPays(p, 1))
  // The bonus chest needs all three.
  assert.equal(claimQuestBonus(p, DAY).ok, false)
  for (let i = 1; i < 3; i += 1) {
    const q = p.quests.list[i]
    progressQuests(p, QUEST_TYPES[q.type].counter, q.target, DAY)
    claimQuest(p, i, DAY)
  }
  assert.equal(claimQuestBonus(p, DAY).ok, true)
  assert.equal(Object.values(p.items).reduce((a, b) => a + b, 0) >= 1, true, 'an egg (and a potion from the hard one)')
})

test('the login streak grows day by day, survives a refresh and resets after a missed day', () => {
  const p = createProfile('s', 'S')
  assert.equal(applyStreak(p, DAY).days, 1)
  assert.equal(applyStreak(p, DAY + 1000).changed, false)
  assert.equal(applyStreak(p, DAY + DAY_MS).days, 2)
  const reloaded = normalizeProfile(JSON.parse(JSON.stringify(p)), 's', 'S')
  assert.equal(applyStreak(reloaded, DAY + 2 * DAY_MS).days, 3)
  const broken = applyStreak(reloaded, DAY + 5 * DAY_MS)
  assert.equal(broken.days, 1)
  assert.equal(broken.broke, true)
  assert.equal(loginMultiplier(11), 2)
  assert.ok(winsMultiplier(p, DAY + DAY_MS) > 1, 'day 2 pays more Wins')
})

test('the absorb streak and friends in the server add their bonuses', () => {
  assert.equal(streakBonus(0), 1)
  assert.ok(streakBonus(10) > 1)
  assert.equal(streakBonus(1000), 1 + STREAK_MAX)
  assert.equal(crowdBonus(0), 1)
  assert.equal(crowdBonus(1), 1.1)
  assert.equal(crowdBonus(10), 1.3)
})

test('lucky gifts land LUCKY_CHANCE of the time and pay out', () => {
  const p = createProfile('l', 'L')
  assert.equal(rollLuckyGift(p, () => LUCKY_CHANCE + 0.01), null)
  const rolls = [0, 0]
  const gift = rollLuckyGift(p, () => rolls.shift() ?? 0)
  assert.ok(gift)
  assert.ok(gift.wins > 0 || gift.items.length > 0)
})

test('the session feeds quests from what the tornado swallows and tells the client when one is done', () => {
  const p = createProfile('feed', 'F')
  const events = []
  const layout = stageLayout(0)
  const tinies = layout.objects.filter((o) => o.size === 'tiny' && o.level === 1)
  const session = new PlayerSession(p, { now: DAY, emit: (type, payload) => events.push({ type, payload }), getPosition: () => ({ x: 0, z: 0 }) })
  // Make today's easy quest an absorb one, whatever was dealt.
  p.quests.list[0] = { type: 'absorb', tier: 0, target: 5, progress: 0, claimed: false }
  session.absorb(tinies.slice(0, 5), DAY + 100)
  assert.equal(p.quests.list[0].progress, 5)
  assert.ok(events.some((e) => e.type === 'quest' && e.payload.index === 0))
})
