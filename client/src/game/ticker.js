import { TORNADOES } from '@shared/balance'
import { isPadUnlocked } from '@shared/logic'
import { eggStandNear, FREE_REWARD, PAD_COUNT, padAt, padRect, stageAt, stageNear, standAt } from '@shared/world'

import { sfx } from '../audio/sfx'
import { getGame, useGame } from '../store/game'
import { padLabelSpec, standLabelSpec, standState } from './labels/lobbyLabels'
import { updateWorldLabel } from './labels/registry'
import { runtime } from './runtime'

const TICK_MS = 100

function sameZone(a, b) {
  return a.pad === b.pad && a.stand === b.stand && a.egg === b.egg && a.freeReward === b.freeReward && a.stage === b.stage && a.near === b.near
}

/** Locked Storm Zones are solid for the controller; their signs say what's open. */
function syncPads(profile) {
  const walls = []
  for (let i = 0; i < PAD_COUNT; i += 1) {
    const unlocked = isPadUnlocked(profile, i)
    if (!unlocked) walls.push(padRect(i))
    updateWorldLabel(`pad-${i}`, padLabelSpec(i, unlocked))
  }
  runtime.dynamicColliders = walls
}

/** Every showroom stand's sign: equipped, owned, can buy, locked. */
function syncStands(profile) {
  for (let i = 0; i < TORNADOES.length; i += 1) updateWorldLabel(`stand-${i}`, standLabelSpec(i, standState(profile, i)))
}

const padKey = (p) => `${p.rebirths}:${p.passes.padVeryOp ? 1 : 0}${p.passes.padBest ? 1 : 0}`
const standKey = (p) => `${p.equippedTornado}:${p.ownedTornadoes.length}`

/**
 * The 10 Hz bridge between the frame-rate world and the UI: works out where the player
 * is (which city, which Storm Zone, stand or egg), keeps locked-zone walls and the
 * showroom's signs in step with the profile. This - not the render loop - is what writes
 * zone state into the store, and only when something actually changed.
 *
 * @returns {() => void} stop
 */
export function startGameTicker() {
  let lastPad = -1
  let lastPadKey = padKey(getGame().profile)
  let lastStandKey = standKey(getGame().profile)

  syncPads(getGame().profile)
  syncStands(getGame().profile)
  const unsubscribe = useGame.subscribe((state, prev) => {
    if (state.profile === prev.profile) return
    const pk = padKey(state.profile)
    if (pk !== lastPadKey) {
      lastPadKey = pk
      syncPads(state.profile)
    }
    const sk = standKey(state.profile)
    if (sk !== lastStandKey) {
      lastStandKey = sk
      syncStands(state.profile)
    }
  })

  const tick = () => {
    const game = getGame()
    const p = runtime.player.position
    const egg = eggStandNear(p.x, p.z)
    const zone = {
      pad: padAt(p.x, p.z, -0.2),
      stand: standAt(p.x, p.z),
      egg: egg ? egg.eggId : null,
      freeReward: Math.hypot(p.x - FREE_REWARD.x, p.z - FREE_REWARD.z) < FREE_REWARD.radius + 1,
      stage: stageAt(p.x, p.z),
      near: stageNear(p.z),
    }
    if (!sameZone(zone, game.zone)) game.setZone(zone)
    const onPad = zone.pad >= 0 && isPadUnlocked(game.profile, zone.pad) ? zone.pad : -1
    if (onPad !== lastPad) {
      if (onPad >= 0) sfx.treadmillEnter()
      else sfx.treadmillStop()
      lastPad = onPad
    }
  }

  const id = setInterval(tick, TICK_MS)
  return () => {
    clearInterval(id)
    unsubscribe()
    sfx.treadmillStop()
  }
}
