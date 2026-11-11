import { useGame } from '../../store/game'
import Banners from './Banners'
import EggPanel from './EggPanel'
import Feed from './Feed'
import HealthBar from './HealthBar'
import InteractPrompt from './InteractPrompt'
import LeftMenu, { RightMenu } from './LeftMenu'
import StatsPanel from './StatsPanel'
import SurgeButton from './SurgeButton'
import TopBar from './TopBar'
import TopCenter from './TopCenter'

/**
 * The heads-up display: Wins and Rebirths top-left over the menu tiles, where you are
 * (and your streak) top-centre, the level bar with its level packs bottom-centre, the
 * Quests and the free Gift down the right, the SURGE button bottom-right, and the big
 * announcements across the middle. (The passes are in the Store.)
 *
 * The root ignores pointer events so the canvas and joystick underneath keep working;
 * only the buttons themselves opt back in. While a panel is open the HUD steps aside.
 */
export function HUD() {
  const panelOpen = useGame((s) => s.panel !== null)
  return (
    <div className="pp-font pointer-events-none absolute inset-0 z-20 select-none">
      <div className="absolute inset-0 transition-opacity duration-150" style={{ opacity: panelOpen ? 0 : 1, visibility: panelOpen ? 'hidden' : 'visible' }}>
        <TopBar />
        <StatsPanel />
        <LeftMenu />
        <RightMenu />
        <TopCenter />
        <Feed />
        <HealthBar />
        <SurgeButton />
        <InteractPrompt />
        <EggPanel />
      </div>
      <Banners />
    </div>
  )
}

export default HUD
