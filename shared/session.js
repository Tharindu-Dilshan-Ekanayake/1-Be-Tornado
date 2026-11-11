import { crowdBonus, dayNumber, EGGS, HP_GRACE, ITEMS, MULTI_HATCH, SHOP, STAGES, STREAK_WINDOW, SURGE_HIT, SURGE_TEAR, TRAIN_INTERVAL, TUTORIAL, WALK_STEP } from './balance.js'
import { forObjectsNear, objectById, payStep, reachFor, segmentDistance, stageLayout, stageOfId } from './cities.js'
import { applyStreak, claimQuest, claimQuestBonus, ensureQuests, progressQuests, questText, rollLuckyGift } from './engage.js'
import {
  absorbObject,
  advanceTutorial,
  applyAdReward,
  applyGemProduct,
  applyRebirth,
  applyTrain,
  applyWalkStep,
  awardBadge,
  buyLevelPack,
  buyShopItem,
  buyTornado,
  buyUpgrade,
  claimDaily,
  claimFreeReward,
  claimPlaytime,
  createSession,
  deletePet,
  equipBestPets,
  equipPet,
  equipTornado,
  hatchEgg,
  isMaxLevel,
  isPadUnlocked,
  payCity,
  skipRebirth,
  surgeCooldown,
  surgeReach,
  tearSpeed,
  tornadoRadius,
  unequipPet,
  usePotion,
} from './logic.js'
import { eggStandNear, FREE_REWARD, LOBBY, MAX_MOVE_SPEED, padAt, SPAWN, stageAt, stageEntry } from './world.js'

/** Quest progress is sent at least this often (seconds) while it's changing. */
const QUEST_SYNC = 5
/** How far off a Storm Zone still counts as in it (network jitter). */
const PAD_SLACK = 0.8
/** Reach allowed on top of the rules', for where the server thinks you are (metres). */
const SWEEP_SLACK = 0.8

/**
 * One player's authoritative session: validates intents, runs the simulation every tick
 * (Storm Zones, moving, and everything your tornado swallows on the way) and reports
 * what happened through `emit`.
 *
 * Transport-agnostic on purpose. The Colyseus room wraps one of these per client; the
 * offline mode wraps one for the local player. Either way the rules that run are
 * byte-for-byte the same.
 *
 * What the tornado absorbs is decided HERE, from where the player is (getPosition, the
 * positions the client reports), against the city layout both sides build from the same
 * seed (cities.js): the client only predicts it for show. Each player has their own copy
 * of every city - `down` holds when each thing they've wrecked comes back.
 *
 * Events emitted (type, payload):
 * - 'profile'  { profile, session }  full state, after anything structural
 * - 'train'    { source, pad, gain, health, level, leveledUp, levels, maxed }  a Power
 *                gain from a Storm Zone ('pad', pad its index) or moving ('walk')
 * - 'absorb'   { ids, gain, health, level, leveledUp, levels, maxed, balance, round,
 *                trophies, landmark, streak, newKinds, surge }  things swallowed this
 *                tick: their ids, the Power they paid, the trophies and landmark among
 *                them, any new Index kinds, and `round` { stage, done, step }: how many
 *                things towards their city's next Wins (it pays every `step`)
 * - 'stage'    { index, wins, name }  a city gate opened for good
 * - 'cityWins' { stage, wins, gift, balance }  another payStep things destroyed in city
 *              `stage`: its Wins (and maybe a lucky gift)
 * - 'surge'    { cooldown }  your Surge went off
 * - 'teleport' { x, z, stage }  you were moved (also through `setPosition`)
 * - 'pack'     { amount, levels }  a level pack landed
 * - 'tornado'  { id, bought }  a tornado bought or equipped
 * - 'hatch'    { eggId, pets: [{ uid, id }] }  pets to reveal
 * - 'badge'    { id, name }
 * - 'reward'   { label, wins? }  an ad reward, Gems purchase, quest or rebirth gift landed
 * - 'quest'    { index, text }  one of today's quests just finished
 * - 'streak'   { days, broke, multiplier }  a new day of the login streak while playing
 */
export class PlayerSession {
  /**
   * @param {object} profile normalized profile (see logic.normalizeProfile)
   * @param {{ now: number, emit: (type: string, payload?: object) => void,
   *           getPosition: () => {x: number, y: number, z: number},
   *           setPosition?: (x: number, z: number) => void,
   *           onPurchase?: (productId: string) => boolean,
   *           onLandmark?: (landmark: object) => void, getOthers?: () => number,
   *           rand?: () => number }} options
   *   `setPosition` lets a teleport move the player (the host owns positions).
   *   `onPurchase` lets the host veto or count a shop sale (stock limits). `onLandmark`
   *   lets it tell the room. `getOthers` says how many other players share your server.
   */
  constructor(profile, { now, emit, getPosition, setPosition, onPurchase, onLandmark, getOthers, rand = Math.random }) {
    this.profile = profile
    this.session = createSession(now)
    this.emit = emit
    this.getPosition = getPosition
    this.setPosition = setPosition
    this.onPurchase = onPurchase
    this.onLandmark = onLandmark
    this.getOthers = getOthers
    this.rand = rand

    // Coming back: today counts into the login streak (the client shows the news from
    // the session state), and today's quests are dealt.
    this.session.streak = applyStreak(profile, now)
    ensureQuests(profile, now)
    this.day = dayNumber(now)
    /** Seconds played towards the next "play for N minutes" quest minute. */
    this.minuteTimer = 0
    /** Quest progress not yet sent, and seconds since it last was. */
    this.questsChanged = false
    this.questSync = 0

    this.trainTimer = 0
    /** Metres moved towards the next moving gain, and where the player was last tick. */
    this.walked = 0
    this.lastX = null
    this.lastZ = 0
    /** Object id -> server time it's back (things this player has wrecked). */
    this.down = new Map()
    /** Object id -> { t: seconds of it torn so far, at: last time it was touched }. */
    this.contact = new Map()
    /** City -> how many things you've destroyed in it (every payStep of them pays its Wins). */
    this.destroyed = new Map()
    /** The absorb streak, and when the last thing went in. */
    this.streak = 0
    this.lastAbsorbAt = 0
    /** Server time the Surge is ready again. */
    this.surgeReadyAt = 0
    this.dirty = false
  }

  // --- Plumbing --------------------------------------------------------------------

  sendProfile() {
    this.dirty = false
    this.questsChanged = false
    this.questSync = 0
    this.emit('profile', { profile: this.profile, session: this.session })
  }

  badge(id) {
    const badge = awardBadge(this.profile, id)
    if (badge) {
      this.dirty = true
      this.emit('badge', badge)
    }
  }

  tutorial(event) {
    if (advanceTutorial(this.profile, event)) this.dirty = true
  }

  /**
   * Counts towards today's quests, and tells the client about any just finished. Plain
   * progress goes to the client with the next profile (at most QUEST_SYNC later).
   */
  quest(counter, amount, now) {
    const finished = progressQuests(this.profile, counter, amount, now)
    if (amount > 0) this.questsChanged = true
    if (finished.length) this.dirty = true
    for (const index of finished) this.emit('quest', { index, text: questText(this.profile.quests.list[index]) })
  }

  // --- Intents ---------------------------------------------------------------------

  /** Dispatches one client message. Unknown types are ignored. */
  handle(type, payload = {}, now) {
    const handler = this.handlers[type]
    if (!handler) return
    handler.call(this, payload || {}, now)
    if (this.dirty) this.sendProfile()
  }

  handlers = {
    setting({ key, value }) {
      if (key !== 'autoRebirth') return
      this.profile.settings.autoRebirth = Boolean(value)
      this.dirty = true
    },

    rebirth() {
      const result = applyRebirth(this.profile)
      if (result.ok) this.afterRebirth(result)
    },

    skipRebirth() {
      const result = skipRebirth(this.profile)
      if (result.ok) this.afterRebirth(result)
    },

    /** Buys (or equips, if owned) a tornado: from the Types menu or a lobby stand alike. */
    buyTornado({ id }) {
      const result = buyTornado(this.profile, String(id))
      if (!result.ok) return
      this.dirty = true
      this.emit('tornado', { id: result.id, bought: Boolean(result.bought) })
      if (result.bought) this.tutorial('buyTornado')
    },

    equipTornado({ id }) {
      const result = equipTornado(this.profile, String(id))
      if (!result.ok) return
      this.dirty = true
      this.emit('tornado', { id: result.id, bought: false })
    },

    buyUpgrade({ id }) {
      if (buyUpgrade(this.profile, String(id)).ok) this.dirty = true
    },

    buyPack({ index }, now) {
      const result = buyLevelPack(this.profile, Number(index), now)
      if (!result.ok) return
      this.dirty = true
      this.emit('pack', { amount: result.amount, levels: result.levels })
      this.quest('level', result.levels, now)
      this.afterUnlock(result.unlocked)
    },

    /** The Surge: everything you can swallow within a few radii, and a chunk off big things. */
    surge(_payload, now) {
      if (now < this.surgeReadyAt) return
      const cooldown = surgeCooldown(this.profile)
      this.surgeReadyAt = now + cooldown * 1000
      this.profile.stats.surges += 1
      this.emit('surge', { cooldown })
      this.quest('surge', 1, now)
      const p = this.getPosition()
      this.sweep(p.x, p.z, p.x, p.z, 0, now, true)
    },

    /** To the lobby (`stage` -1) or into an open city, by its gate. */
    teleport({ stage }) {
      const s = Number(stage)
      let target = null
      if (s === -1) target = SPAWN
      else if (Number.isInteger(s) && s >= 0 && s <= this.profile.unlocked) target = stageEntry(s)
      if (!target) return
      this.setPosition?.(target.x, target.z)
      // No sweep (or walking Power) along the jump.
      this.lastX = target.x
      this.lastZ = target.z
      this.emit('teleport', { x: target.x, z: target.z, stage: s })
    },

    hatch({ eggId, count }) {
      const egg = EGGS[eggId]
      if (!egg) return
      const p = this.getPosition()
      if (eggStandNear(p.x, p.z)?.eggId !== eggId) return
      const n = count === MULTI_HATCH ? MULTI_HATCH : 1
      this.reveal(hatchEgg(this.profile, eggId, n, { rand: this.rand }))
    },

    openEggItem({ itemId }) {
      const item = ITEMS[itemId]
      if (!item || item.kind !== 'egg') return
      this.reveal(hatchEgg(this.profile, item.egg, 1, { paid: 'item', rand: this.rand }))
    },

    equipPet({ uid }) {
      if (equipPet(this.profile, Number(uid)).ok) this.dirty = true
    },

    unequipPet({ uid }) {
      unequipPet(this.profile, Number(uid))
      this.dirty = true
    },

    equipBest() {
      equipBestPets(this.profile)
      this.dirty = true
    },

    deletePet({ uid }) {
      if (deletePet(this.profile, Number(uid)).ok) this.dirty = true
    },

    claimDaily({ day }, now) {
      this.afterReward(claimDaily(this.profile, Number(day), now, { rand: this.rand }))
    },

    claimPlaytime({ index }, now) {
      this.afterReward(claimPlaytime(this.profile, this.session, Number(index), now, { rand: this.rand }))
    },

    claimFreeReward() {
      const p = this.getPosition()
      if (Math.hypot(p.x - FREE_REWARD.x, p.z - FREE_REWARD.z) > FREE_REWARD.radius + 2) return
      this.afterReward(claimFreeReward(this.profile, this.session, { rand: this.rand }))
    },

    claimQuest({ index }, now) {
      const result = claimQuest(this.profile, Number(index), now)
      if (!result.ok) return
      this.dirty = true
      this.emit('reward', { label: result.label, wins: result.wins, items: result.items })
    },

    claimQuestBonus(_payload, now) {
      const result = claimQuestBonus(this.profile, now)
      if (!result.ok) return
      this.dirty = true
      this.emit('reward', { label: result.label, wins: result.wins, items: result.items })
    },

    usePotion({ itemId }, now) {
      if (usePotion(this.profile, itemId, now).ok) this.dirty = true
    },

    /** Buys a SHOP item with Wins. */
    purchase({ productId }) {
      const item = SHOP[productId]
      if (!item) return
      // Checked before the host takes stock, so a short wallet never uses up a Sphinx.
      if (this.profile.wins < item.price) return
      if (item.kind === 'pass' && this.profile.passes[productId]) return
      if (this.onPurchase && !this.onPurchase(productId)) return
      const result = buyShopItem(this.profile, productId, { rand: this.rand })
      if (!result.ok) return
      this.dirty = true
      this.reveal(result)
    },
  }

  // --- Granted by the host, never by a client message --------------------------------

  /**
   * A rewarded ad the host has verified with Boxity (or, offline, that Boxity reported
   * watched). Not a handler: a client can't ask for it directly.
   */
  grantAdReward(placement, now) {
    const result = applyAdReward(this.profile, this.session, placement, now)
    if (!result.ok) return result
    this.dirty = true
    this.emit('reward', { label: result.label })
    this.sendProfile()
    return result
  }

  /** A Gems purchase Boxity has confirmed (its webhook, recorded by the host). */
  grantGemProduct(sku) {
    const result = applyGemProduct(this.profile, sku)
    if (!result.ok) return result
    this.dirty = true
    this.emit('reward', { label: result.name, wins: result.wins || 0 })
    this.sendProfile()
    return result
  }

  afterReward(result) {
    if (!result?.ok) return
    this.dirty = true
    if (result.pets?.length) this.reveal(result)
    if (result.unlocked?.length) this.afterUnlock(result.unlocked)
  }

  /** Sends newly gained pets to the client's hatch animation. */
  reveal(result) {
    if (!result?.ok || !result.pets?.length) return
    this.dirty = true
    this.emit('hatch', { eggId: result.eggId ?? null, pets: result.pets })
    this.quest('hatch', result.pets.length, Date.now())
    this.badge('firstPet')
  }

  afterRebirth({ gift } = {}) {
    this.dirty = true
    this.tutorial('rebirth')
    if (this.profile.rebirths === 1) this.badge('firstRebirth')
    // Every 5th rebirth from 15: eggs, waiting in Items.
    if (gift) this.emit('reward', { label: `REBIRTH ${gift.rebirths} GIFT: ${gift.label} in Items` })
  }

  /** City gates just opened: tell the client, and the badges for getting far. */
  afterUnlock(opened) {
    if (!opened?.length) return
    this.dirty = true
    for (const { index, wins } of opened) this.emit('stage', { index, wins, name: STAGES[index].name })
    const best = this.profile.unlocked
    if (best >= 4) this.badge('stage5')
    if (best >= 9) this.badge('stage10')
    if (best >= STAGES.length - 1) this.badge('stage20')
  }

  // --- Simulation ------------------------------------------------------------------

  /** Advances everything by `dt` seconds. Call at a steady rate (the room's simulation interval). */
  tick(dt, now) {
    const p = this.getPosition()
    // Where the tornado went since last tick. A jump further than moving could cover (a
    // teleport, a snap back) earns nothing and sweeps nothing on the way.
    let fromX = p.x
    let fromZ = p.z
    let moved = 0
    if (this.lastX !== null) {
      const d = Math.hypot(p.x - this.lastX, p.z - this.lastZ)
      if (d <= MAX_MOVE_SPEED * Math.max(dt, 0.1) * 3) {
        moved = d
        fromX = this.lastX
        fromZ = this.lastZ
      }
    }
    this.lastX = p.x
    this.lastZ = p.z

    // In an open Storm Zone: Power by itself, every TRAIN_INTERVAL.
    const pad = padAt(p.x, p.z, PAD_SLACK)
    if (pad >= 0 && isPadUnlocked(this.profile, pad)) {
      this.trainTimer += dt
      while (this.trainTimer >= TRAIN_INTERVAL) {
        this.trainTimer -= TRAIN_INTERVAL
        this.trainOnce(pad, now)
      }
    } else {
      this.trainTimer = Math.min(this.trainTimer, TRAIN_INTERVAL * 0.5)
      this.walked += moved
      while (this.walked >= WALK_STEP) {
        this.walked -= WALK_STEP
        this.gain('walk', -1, applyWalkStep(this.profile, now), now)
      }
    }

    this.sweep(fromX, fromZ, p.x, p.z, dt, now, false)

    // The guide's "go into Stage 1" and "back to the lobby" steps.
    const step = TUTORIAL[this.profile.tutorialStep]
    if (step?.event === 'enter' && stageAt(p.x, p.z) >= 0) this.tutorial('enter')
    else if (step?.event === 'lobby' && p.z > LOBBY.minZ) this.tutorial('lobby')

    this.profile.stats.playtime += dt
    // A minute played towards today's quests; and past midnight, a new day: fresh
    // quests and the next day of the login streak.
    this.minuteTimer += dt
    if (this.minuteTimer >= 60) {
      this.minuteTimer -= 60
      this.quest('minute', 1, now)
    }
    this.questSync += dt
    if (this.questsChanged && this.questSync >= QUEST_SYNC) this.dirty = true
    const day = dayNumber(now)
    if (day !== this.day) {
      this.day = day
      if (ensureQuests(this.profile, now)) this.dirty = true
      const streak = applyStreak(this.profile, now)
      if (streak.changed) {
        this.session.streak = streak
        this.dirty = true
        this.emit('streak', streak)
      }
    }
    if (this.dirty) this.sendProfile()
  }

  /**
   * What the funnel takes going from (x0, z0) to (x1, z1) in the city you're on. Anything
   * can be torn up, by anyone: it tears a little more for every second the funnel is over
   * it - faster the stronger you are next to it (tearSpeed) - and is swallowed when it's
   * torn through. Whatever tears in less than this tick's touch goes along the whole path
   * (so a fast tornado doesn't skip it). `surge`: SURGE_TEAR seconds' worth off everything
   * within the Surge's reach at once (and at least SURGE_HIT of anything's hp).
   */
  sweep(x0, z0, x1, z1, dt, now, surge) {
    const stage = stageAt(x1, z1)
    if (stage >= 0 && stage <= this.profile.unlocked) {
      const layout = stageLayout(stage)
      const radius = tornadoRadius(this.profile) * (surge ? surgeReach(this.profile) : 1)
      const taken = []
      forObjectsNear(layout, x0, z0, x1, z1, radius + SWEEP_SLACK, (o) => {
        const back = this.down.get(o.id)
        if (back !== undefined) {
          if (back > now) return
          this.down.delete(o.id)
        }
        const reach = reachFor(radius, o, SWEEP_SLACK)
        const speed = tearSpeed(this.profile, o)
        const hit = surge ? Math.max(o.hp * SURGE_HIT, SURGE_TEAR * speed) : dt * speed
        const c = this.contact.get(o.id)
        if (!c && hit >= o.hp) {
          if (segmentDistance(o.x, o.z, x0, z0, x1, z1) <= reach) taken.push(o)
          return
        }
        if (Math.hypot(o.x - x1, o.z - z1) > reach) return
        if (c) {
          c.t += hit
          c.at = now
          if (c.t < o.hp) return
          this.contact.delete(o.id)
          taken.push(o)
        } else this.contact.set(o.id, { t: hit, at: now })
      })
      if (taken.length) this.absorb(taken, now, surge)
    }
    // Things left alone too long start over.
    for (const [id, c] of this.contact) if (now - c.at > HP_GRACE * 1000) this.contact.delete(id)
  }

  /** Swallows `list` (layout objects): pays for them, marks them down, tells the client. */
  absorb(list, now, surge = false) {
    const profile = this.profile
    if (now - this.lastAbsorbAt > STREAK_WINDOW * 1000) this.streak = 0
    this.lastAbsorbAt = now
    const crowd = crowdBonus(Math.max(0, Math.floor(this.getOthers?.() || 0)))
    const out = {
      ids: [],
      gain: 0,
      levels: 0,
      leveledUp: false,
      maxed: false,
      trophies: [],
      landmark: null,
      newKinds: [],
      surge,
    }
    const opened = []
    let big = 0
    for (const o of list) {
      this.streak += 1
      const r = absorbObject(profile, o, now, { streak: this.streak })
      this.down.set(o.id, now + o.respawn * 1000)
      out.ids.push(o.id)
      out.gain += r.gain
      out.levels += r.levels
      out.leveledUp ||= r.leveledUp
      out.maxed = r.maxed
      if (r.newKind) out.newKinds.push(r.newKind)
      if (r.unlocked.length) opened.push(...r.unlocked)
      if (o.size === 'trophy') out.trophies.push(o.id)
      else if (o.size === 'landmark') out.landmark = o.id
      if (o.size === 'large' || o.size === 'huge') big += 1
    }
    profile.stats.bestStreak = Math.max(profile.stats.bestStreak, this.streak)
    // Every city counts what's destroyed in it: every payStep things pays its Wins.
    let round = null
    for (const o of list) {
      const stage = stageOfId(o.id)
      const before = this.destroyed.get(stage) || 0
      const count = before + 1
      this.destroyed.set(stage, count)
      const step = payStep(stage)
      if (Math.floor(count / step) > Math.floor(before / step)) this.payCity(stage, now, crowd)
      round = { stage, done: count % step, step }
    }
    out.gain = Math.round(out.gain * 10) / 10
    this.emit('absorb', { ...out, round, health: profile.health, level: profile.level, balance: profile.wins, streak: this.streak })

    const wrecked = out.trophies.length + (out.landmark !== null ? 1 : 0)
    this.quest('absorb', list.length, now)
    if (big) this.quest('big', big, now)
    if (wrecked) this.quest('trophy', wrecked, now)
    this.quest('streak', this.streak, now)
    if (out.levels > 0) this.quest('level', out.levels, now)
    this.tutorial('absorb')
    if (wrecked) this.tutorial('trophy')
    this.badge('firstAbsorb')
    if (out.trophies.length) this.badge('firstTrophy')
    if (out.landmark !== null) this.badge('firstLandmark')
    if (this.streak >= 50) this.badge('streak50')
    if (profile.stats.absorbed >= 10000) this.badge('smashed10k')
    // New kinds change things the client shows from the profile.
    if (out.newKinds.length) this.dirty = true
    if (out.landmark !== null) this.onLandmark?.(objectById(out.landmark))
    this.afterUnlock(opened)
    this.autoRebirth()
  }

  /** Another payStep things destroyed in city `stage`: its Wins (and maybe a lucky gift). */
  payCity(stage, now, crowd = 1) {
    const wins = payCity(this.profile, stage, 1, now, crowd)
    const gift = rollLuckyGift(this.profile, this.rand)
    this.dirty = true
    this.emit('cityWins', { stage, wins, gift, balance: this.profile.wins })
    this.tutorial('cityWins')
  }

  /** Tells the client about a Power gain from `source` ('pad' or 'walk'). */
  gain(source, pad, result, now) {
    // At max level gains stop; there's nothing to show.
    if (result.gain > 0) {
      this.emit('train', {
        source,
        pad,
        gain: result.gain,
        health: this.profile.health,
        level: this.profile.level,
        leveledUp: result.leveledUp,
        levels: result.levels,
        maxed: result.maxed,
      })
      if (result.levels > 0) this.quest('level', result.levels, now)
    }
    this.afterUnlock(result.unlocked)
    this.autoRebirth()
  }

  autoRebirth() {
    if (this.profile.settings.autoRebirth && isMaxLevel(this.profile)) {
      const rebirth = applyRebirth(this.profile)
      if (rebirth.ok) this.afterRebirth(rebirth)
    }
  }

  trainOnce(pad, now) {
    const result = applyTrain(this.profile, pad, now)
    if (!result.ok) return
    this.gain('pad', pad, result, now)
    this.tutorial('train')
  }
}
