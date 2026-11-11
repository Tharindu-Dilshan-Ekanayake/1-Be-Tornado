import { UPGRADES } from '@shared/balance'
import { surgeCooldown, surgeReach, tornadoRadius, tornadoSpeed, upgradePrice } from '@shared/logic'

import { sfx } from '../../audio/sfx'
import { actions } from '../../net/actions'
import { getGame, useGame } from '../../store/game'
import Icon from '../Icon'
import StrokeText from '../StrokeText'
import { ChunkyButton, Price } from '../hud/parts'
import { GRADIENTS, u } from '../hud/style'
import Panel from './Panel'

const ICONS = { size: 'tornado', speed: 'fastForward', surge: 'bolt' }
const GRADIENT = {
  size: 'linear-gradient(180deg, #b4efff 0%, #4cb8ff 50%, #2477e8 100%)',
  speed: 'linear-gradient(180deg, #c9ff96 0%, #6fe04a 50%, #26ad3c 100%)',
  surge: 'linear-gradient(180deg, #ffe27a 0%, #ff9a1e 50%, #e8501e 100%)',
}

/** What each upgrade does for you right now: "Radius 4.2 m", "Speed 12.6 m/s", "Every 22 s". */
function nowText(id, profile) {
  if (id === 'size') return `Radius ${tornadoRadius(profile).toFixed(1)} m`
  if (id === 'speed') return `Speed ${tornadoSpeed(profile).toFixed(1)} m/s`
  return `Every ${surgeCooldown(profile)}s • ${surgeReach(profile).toFixed(1)}x reach`
}

/**
 * Upgrades, kept for good (rebirth doesn't touch them): a bigger funnel, faster winds and
 * a stronger, more frequent Surge. Each level costs more Wins than the last.
 */
export function UpgradesPanel() {
  const profile = useGame((s) => s.profile)
  const buy = (id) => {
    const price = upgradePrice(getGame().profile, id)
    if (price === null || getGame().profile.wins < price) return sfx.error()
    sfx.buy()
    actions.buyUpgrade(id)
  }
  return (
    <Panel title="UPGRADES" icon="upgrade" width={940}>
      <div className="flex flex-col" style={{ gap: u(14) }}>
        {Object.entries(UPGRADES).map(([id, upgrade]) => {
          const level = profile.upgrades[id] || 0
          const price = upgradePrice(profile, id)
          return (
            <div key={id} className="flex items-center" style={{ gap: u(16), padding: u(14), borderRadius: u(10), border: `${u(5)} solid #111`, background: 'linear-gradient(180deg, #3a3f4a, #2a2e36)' }}>
              <span className="flex items-center justify-center" style={{ width: u(110), height: u(110), borderRadius: u(16), border: `${u(4)} solid #111`, background: GRADIENT[id] }}>
                <Icon name={ICONS[id]} size={u(84)} />
              </span>
              <div className="flex flex-1 flex-col" style={{ gap: u(6), minWidth: 0 }}>
                <span style={{ fontSize: u(38) }}>
                  <StrokeText stroke={u(7)}>{upgrade.name}</StrokeText>
                </span>
                <span style={{ fontSize: u(24) }}>
                  <StrokeText stroke={u(5)} fill="#cfe6ff" style={{ whiteSpace: 'normal' }}>
                    {upgrade.blurb} • {nowText(id, profile)}
                  </StrokeText>
                </span>
                <div className="flex" style={{ gap: u(4) }}>
                  {Array.from({ length: upgrade.max }, (_, i) => (
                    <span key={i} style={{ flex: 1, height: u(16), borderRadius: u(4), border: `${u(2)} solid #111`, background: i < level ? '#3fe05a' : '#1a1d24' }} />
                  ))}
                </div>
              </div>
              <ChunkyButton gradient={price === null ? GRADIENTS.greyButton : GRADIENTS.greenButton} disabled={price === null} onClick={() => buy(id)} style={{ width: u(220), height: u(80) }}>
                {price === null ? (
                  <span style={{ fontSize: u(32) }}>
                    <StrokeText stroke={u(7)}>MAX</StrokeText>
                  </span>
                ) : (
                  <Price amount={price} size={34} afford={profile.wins >= price} />
                )}
              </ChunkyButton>
            </div>
          )
        })}
      </div>
    </Panel>
  )
}

export default UpgradesPanel
