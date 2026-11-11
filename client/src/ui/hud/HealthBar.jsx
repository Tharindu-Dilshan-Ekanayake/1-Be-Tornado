import { healthForLevel, levelCap, MAX_RINGS, nextRingLevel, ringsFor, STAGES } from '@shared/balance'
import { formatMultiplier, formatNumber } from '@shared/format'
import { isMaxLevel, levelPacks, levelProgress, powerMultiplier, rebirthProgress } from '@shared/logic'

import { sfx } from '../../audio/sfx'
import { actions } from '../../net/actions'
import { getGame, useGame } from '../../store/game'
import Icon from '../Icon'
import StrokeText from '../StrokeText'
import useNow from '../useNow'
import { ChunkyButton, Price } from './parts'
import { GRADIENTS, u } from './style'

/** Width of the whole block, in reference pixels: every row lines up to it. */
const WIDTH = 900

const PACK_GRADIENTS = [
  'linear-gradient(180deg, #8ff0ff 0%, #2fb8ff 50%, #1677ff 100%)',
  'linear-gradient(180deg, #ff9cf4 0%, #dc52ff 50%, #9a2bff 100%)',
  'linear-gradient(180deg, #ff8a7a 0%, #ff3b3b 50%, #d4142a 100%)',
]
const BAR_FILL = 'linear-gradient(180deg, #8fd0ff 0%, #3a8cff 50%, #1f5fd8 100%)'
const NEXT = 'linear-gradient(180deg, #fff6a8 0%, #ffd52a 50%, #ff9c00 100%)'

/** "Next: +1 Ring at Level 6", "Next: Stage 4 at Level 16", or "MAX LEVEL - REBIRTH!". */
function NextGoal() {
  const level = useGame((s) => s.profile.level)
  const maxed = useGame((s) => isMaxLevel(s.profile))
  const unlocked = useGame((s) => s.profile.unlocked)
  const rebirths = useGame((s) => s.profile.rebirths)
  const ring = nextRingLevel(level)
  const stage = STAGES[unlocked + 1]
  let text
  if (maxed) text = `MAX LEVEL ${levelCap(rebirths)} - REBIRTH FOR x${rebirths + 2} POWER!`
  else if (stage && (!ring || stage.level <= ring)) text = stage.level <= levelCap(rebirths) ? `Next: Stage ${unlocked + 2} at Level ${stage.level}` : `Next: Stage ${unlocked + 2} at Level ${stage.level} (rebirth to reach it)`
  else if (ring) text = `Next: +1 Ring at Level ${ring}`
  else text = `Next: Level ${level + 1}`
  return (
    <span style={{ fontSize: u(34) }}>
      <StrokeText stroke={u(7)} gradient={NEXT}>
        {text}
      </StrokeText>
    </span>
  )
}

function Chip({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${onClick ? 'pp-btn pointer-events-auto' : 'pointer-events-none'} flex items-center`}
      style={{ height: u(46), padding: `0 ${u(18)}`, gap: u(6), borderRadius: u(12), border: `${u(4)} solid #111`, background: 'rgba(40, 44, 56, 0.85)', fontSize: u(28) }}
    >
      {children}
    </button>
  )
}

function Chips() {
  const level = useGame((s) => s.profile.level)
  const rebirthPct = useGame((s) => Math.floor(rebirthProgress(s.profile) * 100))
  const profile = useGame((s) => s.profile)
  const openPanel = useGame((s) => s.openPanel)
  // Potions run out on their own; re-read the boost every few seconds.
  const now = useNow(5000)
  const boost = powerMultiplier(profile, now)
  return (
    <div className="flex justify-center" style={{ gap: u(10) }}>
      <Chip>
        <Icon name="tornado" size={u(34)} />
        <StrokeText stroke={u(6)}>
          Rings {ringsFor(level)}/{MAX_RINGS}
        </StrokeText>
      </Chip>
      <Chip onClick={() => openPanel('rebirth')}>
        <Icon name="rebirth" size={u(34)} />
        <StrokeText stroke={u(6)}>Rebirth {rebirthPct}%</StrokeText>
      </Chip>
      <Chip>
        <Icon name="bolt" size={u(34)} />
        <StrokeText stroke={u(6)} gradient={GRADIENTS.gold}>
          {formatMultiplier(boost)} Power
        </StrokeText>
      </Chip>
    </div>
  )
}

/** "Level 16 ... 912/1.5K", or "MAX LEVEL 15 ... Rebirth!" (opens the rebirth panel). */
function LevelBar() {
  const level = useGame((s) => s.profile.level)
  const health = useGame((s) => s.profile.health)
  const maxed = useGame((s) => isMaxLevel(s.profile))
  const fill = useGame((s) => levelProgress(s.profile))
  const cap = useGame((s) => levelCap(s.profile.rebirths))
  const openPanel = useGame((s) => s.openPanel)
  const from = healthForLevel(level)
  const to = healthForLevel(level + 1)
  return (
    <button
      type="button"
      onClick={maxed ? () => openPanel('rebirth') : undefined}
      className={`relative w-full overflow-hidden text-left ${maxed ? 'pp-btn pointer-events-auto' : 'pointer-events-none'}`}
      style={{ height: u(70), borderRadius: u(12), border: `${u(6)} solid #111`, background: 'rgba(24, 28, 40, 0.88)', boxShadow: `0 ${u(5)} 0 #111` }}
    >
      {/* Grows by a transform, not its width: it fills many times a second. */}
      <div className="absolute inset-0 origin-left transition-transform duration-300 ease-out" style={{ transform: `scaleX(${fill})`, background: maxed ? GRADIENTS.goldButton : BAR_FILL }} />
      <div className="absolute" style={{ left: u(10), right: u(10), top: u(5), height: u(12), borderRadius: u(6), background: 'rgba(255,255,255,0.25)' }} />
      <div className="absolute inset-0 flex items-center justify-between" style={{ padding: `0 ${u(18)}`, fontSize: u(50) }}>
        <StrokeText stroke={u(10)}>{maxed ? `MAX LEVEL ${cap}` : `Level ${level}`}</StrokeText>
        <StrokeText stroke={u(10)}>{maxed ? 'Rebirth!' : `${formatNumber(Math.max(0, health - from))}/${formatNumber(to - from)}`}</StrokeText>
      </div>
    </button>
  )
}

/** A level pack: "+5 Levels", its price in Wins on top. */
function PackButton({ index, levels, price, afford, maxed }) {
  const buyPack = () => {
    if (maxed || getGame().profile.wins < price) {
      sfx.error()
      return
    }
    actions.buyPack(index)
  }
  return (
    <div className="relative" style={{ width: u(290) }}>
      <span className="absolute z-10" style={{ right: u(14), top: u(-26) }}>
        <Price amount={price} size={28} afford={afford} />
      </span>
      <ChunkyButton gradient={PACK_GRADIENTS[index]} onClick={buyPack} disabled={maxed} title={`+${levels} Levels`} radius={8} border={5} style={{ width: u(290), height: u(72) }}>
        <span style={{ fontSize: u(46) }}>
          <StrokeText stroke={u(10)}>
            +{levels} Level{levels > 1 ? 's' : ''}
          </StrokeText>
        </span>
      </ChunkyButton>
    </div>
  )
}

/**
 * Bottom centre: what's next, your rings / rebirth progress / Power boost, the level bar,
 * and the three level packs (+1, +5, +20 levels, bought with Wins).
 */
export function HealthBar() {
  const level = useGame((s) => s.profile.level)
  const rebirths = useGame((s) => s.profile.rebirths)
  const health = useGame((s) => s.profile.health)
  const unlocked = useGame((s) => s.profile.unlocked)
  const wins = useGame((s) => s.profile.wins)
  const maxed = useGame((s) => isMaxLevel(s.profile))
  const packs = levelPacks({ level, rebirths, health, unlocked })

  return (
    <div className="hud-bottom pointer-events-none absolute left-1/2 flex -translate-x-1/2 flex-col items-center" style={{ bottom: u(14), width: u(WIDTH), gap: u(8), contain: 'layout style' }}>
      <NextGoal />
      <Chips />
      <LevelBar />
      <div className="flex w-full justify-between" style={{ marginTop: u(22) }}>
        {packs.map((pack, i) => (
          <PackButton key={i} index={i} levels={pack.levels} price={pack.price} afford={wins >= pack.price} maxed={maxed} />
        ))}
      </div>
    </div>
  )
}

export default HealthBar
