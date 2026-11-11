import { useEffect, useState } from 'react'

import { STAGES, STREAK_WINDOW, TUTORIAL } from '@shared/balance'
import { payStep } from '@shared/cities'
import { formatNumber } from '@shared/format'

import { useGame } from '../../store/game'
import Icon from '../Icon'
import StrokeText from '../StrokeText'
import { u } from './style'

const BANNER_GRADIENT = 'linear-gradient(180deg, #fff6a8 0%, #ffd52a 45%, #ffa000 100%)'
const PANEL_GRADIENT = 'linear-gradient(180deg, #ffe45c 0%, #ffc21f 55%, #ff9a12 100%)'
const TITLE = 'linear-gradient(180deg, #ffffff 0%, #ffffff 55%, #dfe7f0 100%)'

/**
 * In a city: how close you are to its next Wins - "STAGE 1 [DESTROY 12 MORE] +3" - a slim
 * bar filling up as you destroy things (every payStep of them pays its Wins). Nothing in
 * the lobby: the guide and the arrows say what to do there.
 */
function CityMeter() {
  const stage = useGame((s) => s.zone.stage)
  const unlocked = useGame((s) => s.profile.unlocked)
  const done = useGame((s) => (s.zone.stage >= 0 ? (s.rounds[s.zone.stage] ?? 0) : 0))
  if (stage < 0 || stage > unlocked) return null
  const step = payStep(stage)
  const left = Math.max(0, step - done)
  return (
    <div
      className="flex items-center"
      style={{ gap: u(12), padding: `${u(4)} ${u(16)} ${u(4)} ${u(14)}`, borderRadius: u(26), border: `${u(4)} solid #111`, background: 'rgba(16,20,36,0.8)' }}
    >
      <span style={{ fontSize: u(26) }}>
        <StrokeText stroke={u(6)} gradient={TITLE}>
          STAGE {stage + 1}
        </StrokeText>
      </span>
      <div className="relative overflow-hidden" style={{ width: u(270), height: u(28), borderRadius: u(14), border: `${u(3)} solid #111`, background: '#2a2f3a' }}>
        <div
          className="absolute inset-0 origin-left"
          style={{ transform: `scaleX(${Math.min(1, done / step)})`, transition: 'transform 200ms ease-out', background: 'linear-gradient(180deg, #ffb08a 0%, #ff5a2a 55%, #c81f0a 100%)' }}
        />
        <div className="absolute inset-0 flex items-center justify-center" style={{ fontSize: u(19) }}>
          <StrokeText stroke={u(4)}>{`DESTROY ${left} MORE`}</StrokeText>
        </div>
      </div>
      <span className="flex items-center" style={{ gap: u(4), fontSize: u(28) }}>
        <Icon name="trophy" size={u(32)} />
        <StrokeText stroke={u(6)} gradient={BANNER_GRADIENT}>
          +{formatNumber(STAGES[stage].wins)}
        </StrokeText>
      </span>
    </div>
  )
}

/** The tutorial for brand-new players, as a small strip: "2/3 Hold your tornado over..." */
function TutorialBanner({ step }) {
  const current = TUTORIAL[step]
  const health = useGame((s) => s.profile.health)
  let text = current.text
  if (current.health) text += ` (${formatNumber(Math.min(health, current.health))}/${formatNumber(current.health)})`
  return (
    <div
      className="flex items-center"
      style={{
        gap: u(14),
        marginTop: u(6),
        padding: `${u(6)} ${u(22)} ${u(6)} ${u(8)}`,
        borderRadius: u(30),
        border: `${u(4)} solid #111`,
        background: PANEL_GRADIENT,
        boxShadow: `0 ${u(4)} 0 rgba(0,0,0,0.3), inset 0 ${u(4)} 0 rgba(255,255,255,0.45)`,
      }}
    >
      <span className="flex items-center justify-center" style={{ minWidth: u(64), height: u(44), borderRadius: u(22), background: '#111', fontSize: u(26) }}>
        <StrokeText stroke={u(5)} gradient={BANNER_GRADIENT}>
          {step + 1}/{TUTORIAL.length}
        </StrokeText>
      </span>
      <span style={{ fontSize: u(32) }}>
        <StrokeText stroke={u(7)} style={{ whiteSpace: 'normal' }}>
          {text}
        </StrokeText>
      </span>
    </div>
  )
}

/** "x20 STREAK" with a bar draining until the streak ends, and a word for how well it's going. */
function StreakMeter() {
  const streak = useGame((s) => s.streak)
  const [now, setNow] = useState(0)
  useEffect(() => {
    if (streak.count < 3) return undefined
    const update = () => setNow(performance.now())
    update()
    const id = setInterval(update, 120)
    return () => clearInterval(id)
  }, [streak])
  const left = now ? 1 - (now - streak.at) / (STREAK_WINDOW * 1000) : 1
  if (streak.count < 3 || left <= 0) return null
  const word = streak.count >= 50 ? 'UNSTOPPABLE!' : streak.count >= 30 ? 'AMAZING!' : streak.count >= 15 ? 'GREAT!' : 'NICE!'
  return (
    <div key={Math.floor(streak.count / 5)} className="pp-bump flex flex-col items-center" style={{ marginTop: u(6) }}>
      <span style={{ fontSize: u(64), lineHeight: 1 }}>
        <StrokeText stroke={u(12)} gradient={BANNER_GRADIENT}>
          x{streak.count}
        </StrokeText>
      </span>
      <div className="relative overflow-hidden" style={{ width: u(220), height: u(26), borderRadius: u(13), border: `${u(4)} solid #111`, background: '#2a1f4a' }}>
        <div className="absolute inset-0 origin-left" style={{ transform: `scaleX(${left})`, background: 'linear-gradient(90deg, #ffd21f, #ff7a1e)' }} />
        <div className="absolute inset-0 flex items-center justify-center" style={{ fontSize: u(18) }}>
          <StrokeText stroke={u(4)}>STREAK</StrokeText>
        </div>
      </div>
      <span style={{ fontSize: u(34) }}>
        <StrokeText stroke={u(7)} gradient={BANNER_GRADIENT}>
          {word}
        </StrokeText>
      </span>
    </div>
  )
}

/**
 * Top centre: during the tutorial, the city's next-Wins bar and the current step; after
 * it, only your streak (the screen stays clear).
 */
export function TopCenter() {
  const step = useGame((s) => s.profile.tutorialStep)
  const guiding = Boolean(TUTORIAL[step])
  return (
    <div className="hud-topcenter pointer-events-none absolute left-1/2 flex -translate-x-1/2 flex-col items-center" style={{ width: 'max-content', maxWidth: '92vw' }}>
      {guiding && <CityMeter />}
      {guiding && <TutorialBanner step={step} />}
      <StreakMeter />
    </div>
  )
}

export default TopCenter
