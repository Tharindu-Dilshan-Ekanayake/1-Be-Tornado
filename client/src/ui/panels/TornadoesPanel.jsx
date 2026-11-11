import { RARITIES, TORNADOES } from '@shared/balance'
import { formatMultiplier } from '@shared/format'

import { standState } from '../../game/labels/lobbyLabels'
import { sfx } from '../../audio/sfx'
import { actions } from '../../net/actions'
import { getGame, useGame } from '../../store/game'
import StrokeText from '../StrokeText'
import { ChunkyButton, Price } from '../hud/parts'
import { GRADIENTS, u } from '../hud/style'
import Panel from './Panel'

/**
 * A spinning picture of a tornado in its colours: stacked bands of a CSS funnel turning at
 * different speeds (no image, no 3D).
 */
export function TornadoPreview({ tornado, size = 120, locked = false }) {
  const [a, b, c] = tornado.colors
  const bands = 7
  return (
    <div className="relative" style={{ width: u(size), height: u(size), filter: locked ? 'grayscale(0.85) brightness(0.6)' : 'none' }}>
      {Array.from({ length: bands }, (_, i) => {
        const t = i / (bands - 1)
        const w = 18 + t * 82
        return (
          <span
            key={i}
            className="pp-swirl absolute left-1/2"
            style={{
              bottom: `${4 + t * 80}%`,
              width: `${w}%`,
              height: '16%',
              marginLeft: `${-w / 2}%`,
              borderRadius: '50%',
              background: tornado.rainbow
                ? 'conic-gradient(#ff5fa8, #ffd21f, #5cff6a, #3fb8ff, #b15cff, #ff5fa8)'
                : `conic-gradient(from ${i * 40}deg, ${a}, ${b}, ${c}, ${b}, ${a})`,
              border: `${u(3)} solid rgba(0,0,0,0.35)`,
              boxShadow: tornado.glow > 0.4 ? `0 0 ${u(12 * tornado.glow)} ${b}` : 'none',
              animationDuration: `${0.5 + (1 - t) * 0.5}s`,
              opacity: 0.92,
            }}
          />
        )
      })}
    </div>
  )
}

/**
 * Types: every tornado in a grid, in order - what each multiplies your Power by, its price
 * in Wins, and buy / equip. You buy them one after another (the next is the one lit up).
 */
export function TornadoesPanel() {
  const profile = useGame((s) => s.profile)
  const wins = useGame((s) => s.profile.wins)

  const buy = (t, state) => {
    if (state === 'owned') return actions.equipTornado(t.id)
    if (state !== 'buy') return sfx.error()
    if (getGame().profile.wins < t.cost) return sfx.error()
    actions.buyTornado(t.id)
  }

  return (
    <Panel title="TORNADO TYPES" icon="tornado" width={1180}>
      <p className="m-0 text-center" style={{ fontSize: u(30), marginBottom: u(12) }}>
        <StrokeText stroke={u(6)} gradient={GRADIENTS.gold}>
          Every tornado multiplies all the Power you absorb!
        </StrokeText>
      </p>
      <div className="grid" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${u(200)}, 1fr))`, gap: u(12) }}>
        {TORNADOES.map((t, i) => {
          const state = standState(profile, i)
          const rarity = RARITIES[t.rarity]
          return (
            <div
              key={t.id}
              className="relative flex flex-col items-center text-center"
              style={{
                padding: u(10),
                borderRadius: u(10),
                border: `${u(5)} solid ${state === 'equipped' ? '#3fe05a' : '#111'}`,
                background: state === 'locked' ? 'linear-gradient(180deg, #3a3f4a, #2a2e36)' : 'linear-gradient(180deg, #3a4a8a, #232a52)',
              }}
            >
              <span className="absolute" style={{ top: u(6), left: u(10), fontSize: u(20) }}>
                <StrokeText stroke={u(4)} fill={rarity.color}>
                  {rarity.name.toUpperCase()}
                </StrokeText>
              </span>
              <div style={{ marginTop: u(18) }}>
                <TornadoPreview tornado={t} size={110} locked={state === 'locked'} />
              </div>
              <span style={{ fontSize: u(t.name.length > 14 ? 24 : 28), lineHeight: 1.1, minHeight: u(32) }}>
                <StrokeText stroke={u(6)} style={{ whiteSpace: 'normal' }}>
                  {t.name}
                </StrokeText>
              </span>
              <span style={{ fontSize: u(30), margin: `${u(4)} 0 ${u(8)}` }}>
                <StrokeText stroke={u(6)} gradient={GRADIENTS.gold}>
                  {formatMultiplier(t.power)} Power
                </StrokeText>
              </span>
              <ChunkyButton
                gradient={state === 'equipped' ? GRADIENTS.greyButton : state === 'owned' ? GRADIENTS.blueButton : state === 'buy' ? GRADIENTS.greenButton : GRADIENTS.greyButton}
                disabled={state === 'equipped' || state === 'locked'}
                onClick={() => buy(t, state)}
                className="w-full"
                style={{ height: u(56) }}
              >
                {state === 'equipped' || state === 'owned' ? (
                  <span style={{ fontSize: u(28) }}>
                    <StrokeText stroke={u(6)}>{state === 'equipped' ? 'Equipped' : 'Equip'}</StrokeText>
                  </span>
                ) : t.cost === 0 ? (
                  <span style={{ fontSize: u(28) }}>
                    <StrokeText stroke={u(6)}>Free</StrokeText>
                  </span>
                ) : (
                  <Price amount={t.cost} size={30} afford={state === 'buy' && wins >= t.cost} />
                )}
              </ChunkyButton>
            </div>
          )
        })}
      </div>
    </Panel>
  )
}

export default TornadoesPanel
