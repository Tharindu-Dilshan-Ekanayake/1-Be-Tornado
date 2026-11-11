import { useProgress } from '@react-three/drei'
import { useEffect, useState } from 'react'

import { iconUrl } from './icons'
import StrokeText from './StrokeText'

const TIPS = [
  'You are a tornado: sweep through the city and absorb everything small enough!',
  'Hold your tornado over a GIANT TROPHY to tear it up for Wins!',
  'Every few levels your tornado grows a new ring: bigger tornado, more at once.',
  'Reach the next level to open the next city - there are 20 to wreck!',
  'Rebirth at max level for x2, x3, x4... Power and a higher level cap.',
  'Spend Wins on stronger tornadoes: every one multiplies your Power.',
  'Press SURGE (Space) to pull in everything around you at once!',
  'Keep absorbing without stopping for a streak bonus.',
  'Pets multiply all the Power you gain.',
]

/**
 * The loading screen's backdrop in plain CSS (no image to download): a stormy sky over a
 * row of toy towers, a bright break in the clouds. Layers, top first.
 */
const STADIUM_BACKDROP = [
  'radial-gradient(ellipse 40% 22% at 50% 30%, rgba(255,250,225,0.55), transparent 70%)',
  'repeating-linear-gradient(90deg, #ff7a9a 0 7%, #ffd21f 7% 13%, #5fb8ff 13% 21%, #7ae86a 21% 26%, #b15cff 26% 33%) bottom / 100% 22% no-repeat',
  'linear-gradient(180deg, #1f2a6a 0%, #3a5ad8 35%, #8ac8ff 65%, #cfeeff 78%)',
].join(', ')

/**
 * Full-screen loading overlay. Progress is drei's asset loader progress, blended with a
 * time-based creep so a single large download never looks frozen, and it only reaches
 * 100% when the game reports ready (avatar in place, first frame drawn).
 *
 * @param {{ done: boolean }} props
 */
export function LoadingScreen({ done }) {
  const { progress } = useProgress()
  const [creep, setCreep] = useState(0)
  const [hidden, setHidden] = useState(false)
  const [tip] = useState(() => TIPS[Math.floor(Math.random() * TIPS.length)])

  useEffect(() => {
    if (done) return undefined
    const id = setInterval(() => setCreep((c) => Math.min(90, c + (90 - c) * 0.06)), 120)
    return () => clearInterval(id)
  }, [done])

  useEffect(() => {
    if (!done) return undefined
    const id = setTimeout(() => setHidden(true), 450)
    return () => clearTimeout(id)
  }, [done])

  if (hidden) return null
  const shown = done ? 100 : Math.max(creep, Math.min(95, progress * 0.95))

  return (
    <div
      className="pp-font absolute inset-0 z-[100] flex flex-col items-center justify-center gap-8 transition-opacity duration-500"
      style={{
        opacity: done ? 0 : 1,
        background: STADIUM_BACKDROP,
      }}
    >
      <div className="pp-loading-disc" aria-hidden="true">
        <img src={iconUrl('tornado')} alt="" width="150" height="150" draggable={false} />
      </div>

      {/* The game's name: +1 TORNADO over a big rainbow SIZE, tilted like a sticker. */}
      <h1 className="m-0 flex flex-col items-center text-center leading-none" style={{ transform: 'rotate(-3deg)' }}>
        <span style={{ fontSize: 'clamp(36px, 8vw, 84px)' }}>
          <StrokeText stroke="0.16em" gradient="linear-gradient(180deg, #ffffff 0%, #ffffff 55%, #ffe36b 56%, #ffb21e 100%)">
            +1 TORNADO
          </StrokeText>
        </span>
        <span style={{ fontSize: 'clamp(44px, 10vw, 118px)', marginTop: '-0.08em' }}>
          <StrokeText
            stroke="0.15em"
            gradient="linear-gradient(90deg, #ff4a4a 0%, #ff9a1e 18%, #ffe23a 36%, #4be05a 54%, #2fd0ff 72%, #b05cff 90%, #ff5fd2 100%)"
          >
            SIZE
          </StrokeText>
        </span>
        <span className="text-base md:text-xl" style={{ marginTop: '0.4em' }}>
          <StrokeText stroke={5}>ABSORB • GROW • WRECK CITIES • REBIRTH</StrokeText>
        </span>
      </h1>

      <div className="w-[min(560px,80vw)]">
        <div className="relative h-9 overflow-hidden rounded-xl border-4 border-black bg-black/40">
          <div
            // Scaled, not resized: it moves while the game is starting up, and a transform
            // never needs a layout.
            className="h-full origin-left rounded-md transition-transform duration-200"
            style={{ transform: `scaleX(${shown / 100})`, background: 'linear-gradient(180deg, #fff27a 0%, #ffc61e 50%, #ff9a12 100%)' }}
          />
          <div className="absolute inset-0 flex items-center justify-center text-lg">
            <StrokeText stroke={5}>{done ? 'READY!' : `LOADING ${Math.round(shown)}%`}</StrokeText>
          </div>
        </div>
        <p className="mt-4 text-center text-base md:text-lg">
          <StrokeText stroke={4}>{tip}</StrokeText>
        </p>
      </div>
    </div>
  )
}

export default LoadingScreen
