import { useState } from 'react'

import { levelCap, STAGES } from '@shared/balance'
import { KINDS, payStep, themeKinds, THEMES } from '@shared/cities'
import { formatNumber } from '@shared/format'

import { actions } from '../../net/actions'
import { useGame } from '../../store/game'
import Icon from '../Icon'
import StrokeText from '../StrokeText'
import { ChunkyButton } from '../hud/parts'
import { GRADIENTS, u } from '../hud/style'
import Panel from './Panel'

const TAB = { height: u(64), padding: `0 ${u(26)}` }

/** One city: its number, name, gate level, what its trophies pay, and a teleport. */
function StageRow({ index, unlocked, here, rebirths, close }) {
  const s = STAGES[index]
  const open = index <= unlocked
  const [top, horizon] = THEMES[s.theme].sky
  const reachable = s.level <= levelCap(rebirths)
  return (
    <div
      className="flex items-center"
      style={{ gap: u(14), padding: u(10), borderRadius: u(10), border: `${u(5)} solid ${here ? '#3fe05a' : '#111'}`, background: open ? `linear-gradient(90deg, ${top}, ${horizon})` : 'linear-gradient(90deg, #3a3f4a, #2a2e36)' }}
    >
      <span className="flex items-center justify-center" style={{ width: u(76), height: u(76), borderRadius: u(38), background: '#111', fontSize: u(40) }}>
        <StrokeText stroke={u(7)} gradient={GRADIENTS.gold}>
          {index + 1}
        </StrokeText>
      </span>
      <div className="flex flex-1 flex-col" style={{ minWidth: 0 }}>
        <span style={{ fontSize: u(36) }}>
          <StrokeText stroke={u(7)}>{s.name}</StrokeText>
        </span>
        <span style={{ fontSize: u(24) }}>
          <StrokeText stroke={u(5)} fill={open ? '#ffffff' : reachable ? '#ffd27a' : '#ff8a7a'}>
            {open ? `Destroy ${payStep(s.index)} things: +${formatNumber(s.wins)} Wins • Landmark: ${s.landmark.name}` : reachable ? `Opens at Level ${s.level}` : `Opens at Level ${s.level} - rebirth to reach it (max ${levelCap(rebirths)})`}
          </StrokeText>
        </span>
      </div>
      <ChunkyButton
        gradient={open ? GRADIENTS.greenButton : GRADIENTS.greyButton}
        disabled={!open || here}
        onClick={() => {
          actions.teleport(index)
          close()
        }}
        style={{ width: u(200), height: u(64) }}
      >
        <span style={{ fontSize: u(28) }}>
          <StrokeText stroke={u(6)}>{here ? 'You are here' : open ? 'Teleport' : 'Locked'}</StrokeText>
        </span>
      </ChunkyButton>
    </div>
  )
}

/** The Index: every kind of thing in every open city, found or not yet. */
function IndexGrid({ unlocked, index }) {
  return (
    <div className="flex flex-col" style={{ gap: u(14) }}>
      {STAGES.slice(0, unlocked + 1).map((s) => {
        const kinds = themeKinds(s.theme)
        const found = kinds.filter((k) => index.includes(k)).length
        return (
          <div key={s.id}>
            <div style={{ fontSize: u(32), marginBottom: u(6) }}>
              <StrokeText stroke={u(6)} gradient={GRADIENTS.gold}>
                {s.name} - {found}/{kinds.length}
              </StrokeText>
            </div>
            <div className="flex flex-wrap" style={{ gap: u(8) }}>
              {kinds.map((k) => {
                const has = index.includes(k)
                const kind = KINDS[k]
                return (
                  <span key={k} className="flex items-center" style={{ gap: u(6), padding: `${u(4)} ${u(12)}`, borderRadius: u(10), border: `${u(3)} solid #111`, background: has ? kind.c[0] : '#2a2e36', fontSize: u(22) }}>
                    <StrokeText stroke={u(5)}>{has ? kind.name : '???'}</StrokeText>
                  </span>
                )
              })}
            </div>
          </div>
        )
      })}
      <p className="m-0 text-center" style={{ fontSize: u(24) }}>
        <StrokeText stroke={u(5)}>Every new kind you absorb pays a Giant Trophy&apos;s worth of Wins!</StrokeText>
      </p>
    </div>
  )
}

/**
 * Stages: every city, open or not, with a teleport to each open one (and the lobby) - the
 * reference's Lobby button and more - and the Index of everything you've swallowed.
 */
export function StagesPanel() {
  const unlocked = useGame((s) => s.profile.unlocked)
  const rebirths = useGame((s) => s.profile.rebirths)
  const here = useGame((s) => s.zone.stage)
  const index = useGame((s) => s.profile.index)
  const closePanel = useGame((s) => s.closePanel)
  const [tab, setTab] = useState('stages')

  return (
    <Panel title="STAGES" icon="city" width={1040}>
      <div className="flex justify-center" style={{ gap: u(14), marginBottom: u(16) }}>
        <ChunkyButton gradient={tab === 'stages' ? GRADIENTS.blueButton : GRADIENTS.greyButton} onClick={() => setTab('stages')} style={TAB}>
          <span style={{ fontSize: u(32) }}>
            <StrokeText stroke={u(7)}>Cities</StrokeText>
          </span>
        </ChunkyButton>
        <ChunkyButton gradient={tab === 'index' ? GRADIENTS.purpleButton : GRADIENTS.greyButton} onClick={() => setTab('index')} style={TAB}>
          <span style={{ fontSize: u(32) }}>
            <StrokeText stroke={u(7)}>Index ({index.length})</StrokeText>
          </span>
        </ChunkyButton>
        <ChunkyButton
          gradient={GRADIENTS.goldButton}
          onClick={() => {
            actions.teleport(-1)
            closePanel()
          }}
          style={{ ...TAB, gap: u(8) }}
        >
          <Icon name="star" size={u(40)} />
          <span style={{ fontSize: u(32) }}>
            <StrokeText stroke={u(7)}>Lobby</StrokeText>
          </span>
        </ChunkyButton>
      </div>
      {tab === 'stages' ? (
        <div className="flex flex-col" style={{ gap: u(10) }}>
          {STAGES.map((s, i) => (
            <StageRow key={s.id} index={i} unlocked={unlocked} here={here === i} rebirths={rebirths} close={closePanel} />
          ))}
        </div>
      ) : (
        <IndexGrid unlocked={unlocked} index={index} />
      )}
    </Panel>
  )
}

export default StagesPanel
