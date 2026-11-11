import { nextRingLevel, ringsFor, STAGES, TORNADOES } from '@shared/balance'
import { KINDS, objectById } from '@shared/cities'
import { formatMultiplier, formatNumber } from '@shared/format'

import { sfx } from '../audio/sfx'
import { confirmAbsorbed, resetCityState } from '../game/city/cityState'
import { burst, queueTrainFx } from '../game/fx/fxQueue'
import { runtime } from '../game/runtime'
import { getGame } from '../store/game'
import { fadeThrough } from '../ui/fade'

/** A point above your tornado. */
const atPlayer = (dy = 2) => {
  const p = runtime.player.position
  return { x: p.x, y: p.y + dy + runtime.tornado.radius * 0.6, z: p.z }
}

const SIZE_INDEX = { tiny: 0, small: 1, medium: 2, large: 3, huge: 4, trophy: 4, landmark: 4 }

/** A new ring: the tornado grows. */
function announceRings(before, after) {
  if (ringsFor(after) <= ringsFor(before)) return
  const next = nextRingLevel(after)
  getGame().pushBanner('+1 RING!', next ? `Your tornado grows! Next ring at Level ${next}` : 'Your tornado is at full size!', 'ring')
  sfx.levelUp()
}

/**
 * Applies one authority event to the client: updates the store and kicks off any
 * visual effect. The same handler serves the Colyseus connection and offline mode.
 */
export function handleServerEvent(type, payload) {
  const game = getGame()
  switch (type) {
    case 'profile': {
      const before = game.profile
      const firstLoad = !game.profileLoaded
      game.setProfile(payload.profile, payload.session)
      if (firstLoad) {
        // A fresh server session: every city is whole again, and every clear starts over.
        resetCityState()
        game.resetRounds()
        break
      }
      if (payload.profile.rebirths > before.rebirths) {
        sfx.rebirth()
        burst({ ...atPlayer(), count: 60, speed: 9 })
        game.pushBanner(`REBIRTH ${payload.profile.rebirths}!`, `Power x${payload.profile.rebirths + 1} - your tornado starts small again!`, 'rebirth')
      }
      break
    }

    case 'absorb': {
      const before = game.profile.level
      confirmAbsorbed(payload.ids)
      game.patchProfile({ health: payload.health, level: payload.level, wins: payload.balance })
      game.setStreak(payload.streak)
      runtime.tornado.spin = Math.min(2.4, runtime.tornado.spin + 0.06 * payload.ids.length)
      if (payload.round) game.setRound(payload.round.stage, payload.round.done)
      queueTrainFx({ source: 'absorb', gain: payload.gain, wins: 0, leveledUp: payload.leveledUp, levels: payload.levels, maxed: payload.maxed })
      // A pop per swallow (the biggest one this time), climbing with the streak.
      let biggest = 0
      for (const id of payload.ids) biggest = Math.max(biggest, SIZE_INDEX[objectById(id)?.size] ?? 0)
      sfx.absorb(biggest, payload.streak)
      if (payload.landmark !== null) {
        const stage = STAGES[Math.floor(payload.landmark / 1000)]
        game.pushBanner(`${stage.landmark.name.toUpperCase()} DESTROYED!`, `+${formatNumber(payload.gain)} Power`, 'landmark')
      }
      if (payload.leveledUp) {
        sfx.levelUp()
        burst({ ...atPlayer(), count: 24, palette: 'power', speed: 6 })
        announceRings(before, payload.level)
      }
      for (const kind of payload.newKinds) {
        if (!KINDS[kind]) continue
        sfx.discover()
        game.showToast(`New in the Index: ${KINDS[kind].name}!`)
      }
      break
    }

    case 'cityWins': {
      // Another payStep things destroyed in a city: its Wins.
      game.patchProfile({ wins: payload.balance })
      sfx.wins()
      burst({ ...atPlayer(3), count: 26, palette: 'gold', speed: 8 })
      queueTrainFx({ source: 'cityWins', gain: 0, wins: payload.wins })
      if (payload.gift) game.showToast(`LUCKY GIFT: ${payload.gift.label}${payload.gift.wins ? ` +${formatNumber(payload.gift.wins)} Wins` : ''}!`)
      break
    }

    case 'train': {
      const before = game.profile.level
      game.patchProfile({ health: payload.health, level: payload.level, ...(payload.source === 'pad' ? { lastPad: payload.pad } : {}) })
      queueTrainFx(payload)
      if (payload.leveledUp) {
        sfx.levelUp()
        burst({ ...atPlayer(), count: 24, palette: 'power', speed: 6 })
        announceRings(before, payload.level)
      }
      break
    }

    case 'stage': {
      // A city gate opened for good.
      sfx.stageUp()
      sfx.wins()
      burst({ ...atPlayer(3), count: 70, palette: 'confetti', speed: 10 })
      game.pushBanner(`STAGE ${payload.index + 1} UNLOCKED!`, `${payload.name.toUpperCase()} - the gate is open!`, 'stage')
      break
    }

    case 'surge':
      runtime.tornado.surgeAt = performance.now()
      runtime.tornado.spin = 2.6
      runtime.camera.shake = Math.max(runtime.camera.shake, 0.5)
      game.setSurgeReady(performance.now() + payload.cooldown * 1000)
      sfx.surge()
      break

    case 'teleport':
      // Moved by the server (a teleport): a flash while the city there is built.
      fadeThrough(() => {
        runtime.player.position.set(payload.x, 0, payload.z)
        runtime.player.velocity.set(0, 0, 0)
        runtime.player.yaw = Math.PI
        runtime.camera.yaw = 0
        runtime.camera.snap = true
      }, { holdMs: 500 })
      if (payload.stage >= 0) game.pushBanner(`STAGE ${payload.stage + 1}`, STAGES[payload.stage].name.toUpperCase(), 'stage')
      break

    case 'tornado': {
      const t = TORNADOES.find((x) => x.id === payload.id)
      if (payload.bought) {
        sfx.buy()
        sfx.wins()
        burst({ ...atPlayer(3), count: 60, palette: 'confetti', speed: 9 })
        if (t) game.pushBanner('NEW TORNADO!', `${t.name}: ${formatMultiplier(t.power)} Power`, 'tornado')
      } else {
        sfx.click()
      }
      break
    }

    case 'pack':
      sfx.buy()
      burst({ ...atPlayer(), count: 30, palette: 'power', speed: 7 })
      break

    case 'quest':
      sfx.levelUp()
      game.pushBanner('QUEST COMPLETE!', payload.text, 'quest')
      break

    case 'streak':
      sfx.wins()
      game.showToast(`DAY ${payload.days} STREAK! x${payload.multiplier.toFixed(1)} Wins today`)
      break

    case 'hatch':
      game.setHatch({ eggId: payload.eggId, pets: payload.pets, id: Date.now() })
      if (payload.eggId) {
        setTimeout(sfx.crack, 1100)
        setTimeout(sfx.reveal, 1250)
      } else {
        sfx.reveal()
      }
      break

    case 'offline':
      game.openPanel('offline', payload)
      break

    case 'badge':
      setTimeout(() => sfx.wins(), 600)
      game.showToast(`BADGE: ${payload.name}!`)
      break

    case 'reward':
      sfx.buy()
      burst({ ...atPlayer(), count: 40, palette: 'gold', speed: 8 })
      game.showToast(`${payload.label}${payload.wins ? ` +${formatNumber(payload.wins)} Wins` : ''}!`)
      break

    case 'feed':
      game.pushFeed(payload.text)
      break

    default:
      break
  }
}
