import { questsReady } from '@shared/engage'
import { rebirthProgress } from '@shared/logic'

import { actions } from '../../net/actions'
import { useGame } from '../../store/game'
import Icon from '../Icon'
import GiftTile from './GiftTile'
import StrokeText from '../StrokeText'
import { AlertBadge, ChunkyButton } from './parts'
import { u } from './style'
import { useStoreAlert } from './useStoreAlert'

/** Each tile's face colour. */
const TILE_GRADIENTS = {
  upgrade: 'linear-gradient(180deg, #b4efff 0%, #4cb8ff 50%, #2477e8 100%)',
  rebirth: 'linear-gradient(180deg, #ffd6ff 0%, #e27bff 50%, #a93cf0 100%)',
  store: 'linear-gradient(180deg, #c9ff96 0%, #6fe04a 50%, #26ad3c 100%)',
  tornado: 'linear-gradient(180deg, #fff2a8 0%, #ffc21f 50%, #f08a0a 100%)',
  pets: 'linear-gradient(180deg, #ffd99a 0%, #ffa53a 50%, #f07a12 100%)',
  city: 'linear-gradient(180deg, #a8f0ff 0%, #2fd0d8 50%, #1a8aa8 100%)',
  quest: 'linear-gradient(180deg, #e2c4ff 0%, #a46bff 50%, #6a2fd6 100%)',
  items: 'linear-gradient(180deg, #ffb8c6 0%, #ff5f86 50%, #d92b5a 100%)',
  lobby: 'linear-gradient(180deg, #a8f0ff 0%, #2fd0d8 50%, #1a8aa8 100%)',
}

function MenuTile({ icon, label, onClick, alert, top, tint }) {
  return (
    <ChunkyButton gradient={TILE_GRADIENTS[tint ?? icon]} onClick={onClick} title={label} radius={20} className="flex-col" style={{ width: u(112), height: u(112) }}>
      <Icon name={icon} size={u(84)} style={{ marginTop: u(-10) }} />
      <span className="absolute" style={{ bottom: u(-14), fontSize: u(32) }}>
        <StrokeText stroke={u(7)}>{label}</StrokeText>
      </span>
      {top && (
        <span className="absolute" style={{ top: u(-22), fontSize: u(30) }}>
          <StrokeText stroke={u(7)} className="italic">
            {top}
          </StrokeText>
        </span>
      )}
      {alert && <AlertBadge size={40} style={{ top: u(-12), right: u(-14) }} />}
    </ChunkyButton>
  )
}

/**
 * The menu down the left, under the stats, one above the other: the Store (tornadoes,
 * upgrades and pets are in it), Rebirth (with % to the next) and Items. Each wears a badge while there's
 * something for you in it.
 */
export function LeftMenu() {
  const togglePanel = useGame((s) => s.togglePanel)
  const rebirthPct = useGame((s) => Math.floor(rebirthProgress(s.profile) * 100))
  const itemAlert = useGame((s) => Object.values(s.profile.items).some((n) => n > 0))
  const store = useStoreAlert()

  return (
    <div className="hud-menu pointer-events-none absolute flex flex-col items-center" style={{ gap: u(34) }}>
      <MenuTile icon="store" label="Store" alert={store.any} onClick={() => togglePanel('store')} />
      <MenuTile icon="rebirth" label="Rebirth" top={`${rebirthPct}%`} alert={rebirthPct >= 100} onClick={() => togglePanel('rebirth')} />
      <MenuTile icon="items" label="Items" alert={itemAlert} onClick={() => togglePanel('items')} />
    </div>
  )
}

/**
 * Down the right side: today's Quests, the free Gift and - when you're out in the cities -
 * a Lobby button that takes you straight back (to buy tornadoes, train...).
 */
export function RightMenu() {
  const togglePanel = useGame((s) => s.togglePanel)
  const questAlert = useGame((s) => questsReady(s.profile, Date.now()))
  const away = useGame((s) => s.zone.near >= 0)
  return (
    <div className="hud-right pointer-events-none absolute flex flex-col items-center" style={{ gap: u(34) }}>
      <MenuTile icon="quest" label="Quests" alert={questAlert} onClick={() => togglePanel('quests')} />
      <GiftTile />
      {away && <MenuTile icon="portal" tint="lobby" label="Lobby" onClick={() => actions.teleport(-1)} />}
    </div>
  )
}

export default LeftMenu
