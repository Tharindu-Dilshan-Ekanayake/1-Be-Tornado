import { useEffect } from 'react'

import { PADS, SHOP, TORNADOES } from '@shared/balance'
import { formatMultiplier, formatNumber } from '@shared/format'
import { isPadUnlocked } from '@shared/logic'

import { standState } from '../../game/labels/lobbyLabels'
import { actions } from '../../net/actions'
import { buy } from '../../net/shop'
import { useGame } from '../../store/game'
import { u } from './style'

/**
 * What standing on the current spot lets you do, if anything: { title, action, run }.
 * One prompt at a time.
 */
function usePrompt() {
  const stand = useGame((s) => s.zone.stand)
  const owned = useGame((s) => s.profile.ownedTornadoes)
  const equipped = useGame((s) => s.profile.equippedTornado)
  const atFreeReward = useGame((s) => s.zone.freeReward)
  const freeTaken = useGame((s) => s.session.freeRewardTaken)
  const pad = useGame((s) => s.zone.pad)
  const padLocked = useGame((s) => s.zone.pad >= 0 && !isPadUnlocked(s.profile, s.zone.pad))

  if (padLocked) {
    const info = PADS[pad]
    const title = `${info.name} - x${formatNumber(info.mult)} Power`
    if (info.product) return { title, action: `Unlock - ${formatNumber(SHOP[info.product].price)} Wins`, run: () => buy(info.product) }
    const word = info.rebirths === 1 ? 'Rebirth' : 'Rebirths'
    return { title, action: `Locked: needs ${info.rebirths} ${word}`, run: null }
  }

  if (atFreeReward) {
    return freeTaken ? { title: 'Free Reward', action: 'Come back next time!', run: null } : { title: 'Free Reward', action: 'Claim', run: () => actions.claimFreeReward() }
  }

  if (stand >= 0) {
    const t = TORNADOES[stand]
    const title = `${t.name} - ${formatMultiplier(t.power)} Power`
    const state = standState({ ownedTornadoes: owned, equippedTornado: equipped }, stand)
    if (state === 'equipped') return { title, action: 'Equipped', run: null }
    if (state === 'owned') return { title, action: 'Equip', run: () => actions.equipTornado(t.id) }
    if (state === 'locked') return { title, action: `Buy the ${TORNADOES[stand - 1].name} first`, run: null }
    return { title, action: `Buy - ${formatNumber(t.cost)} Wins`, run: () => actions.buyTornado(t.id) }
  }
  return null
}

/**
 * Proximity prompt, styled like the platform's own: a dark box with the key to press.
 * E on keyboard; tap the box on touch screens.
 */
export function InteractPrompt() {
  const prompt = usePrompt()
  const busy = useGame((s) => Boolean(s.panel))
  const run = !busy ? prompt?.run : null

  useEffect(() => {
    if (!run) return undefined
    const onKey = (e) => {
      if (e.code === 'KeyE' && !e.repeat) run()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [run])

  if (!prompt || busy) return null
  return (
    <button
      type="button"
      onClick={() => prompt.run?.()}
      className="pp-btn pointer-events-auto absolute flex items-center text-left text-white"
      style={{
        left: '53%',
        top: '50%',
        gap: u(14),
        padding: `${u(12)} ${u(20)} ${u(12)} ${u(12)}`,
        borderRadius: u(10),
        background: 'rgba(24, 26, 30, 0.78)',
        fontFamily: 'system-ui, sans-serif',
        fontWeight: 600,
      }}
    >
      {prompt.run && (
        <span
          className="flex items-center justify-center rounded-full"
          style={{ width: u(54), height: u(54), border: `${u(3)} solid #fff`, fontSize: u(26) }}
        >
          E
        </span>
      )}
      <span className="flex flex-col leading-tight">
        <span style={{ fontSize: u(20), opacity: 0.75 }}>{prompt.title}</span>
        <span style={{ fontSize: u(28) }}>{prompt.action}</span>
      </span>
    </button>
  )
}

export default InteractPrompt
