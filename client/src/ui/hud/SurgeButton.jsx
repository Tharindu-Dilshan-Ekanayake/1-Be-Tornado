import { useEffect, useRef } from 'react'

import { actions } from '../../net/actions'
import { getGame, useGame } from '../../store/game'
import Icon from '../Icon'
import StrokeText from '../StrokeText'
import { ChunkyButton } from './parts'
import { u } from './style'

const READY = 'linear-gradient(180deg, #ffe27a 0%, #ff9a1e 50%, #e8501e 100%)'
const COOLING = 'linear-gradient(180deg, #8a96a6 0%, #5a6676 50%, #3a4250 100%)'

/**
 * The SURGE button, bottom right: pulls in everything in reach at once. Its face fills
 * back up as the cooldown runs (moved on the DOM, never through React); Space or F fires
 * it on a keyboard. Shows its upgrade level.
 */
export function SurgeButton() {
  const readyAt = useGame((s) => s.surgeReadyAt)
  const level = useGame((s) => s.profile.upgrades.surge)
  const fillRef = useRef(null)
  const labelRef = useRef(null)

  useEffect(() => {
    const onKey = (e) => {
      if (e.repeat || getGame().panel) return
      if (e.code === 'Space' || e.code === 'KeyF') {
        e.preventDefault()
        if (performance.now() >= getGame().surgeReadyAt) actions.surge()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // The cooldown, drawn every animation frame until it's ready.
  useEffect(() => {
    let raf = 0
    const total = Math.max(1, readyAt - performance.now())
    const tick = () => {
      const left = readyAt - performance.now()
      const ready = left <= 0
      if (fillRef.current) fillRef.current.style.transform = `scaleY(${ready ? 0 : Math.min(1, left / total)})`
      if (labelRef.current) {
        const text = ready ? 'SURGE' : `${Math.ceil(left / 1000)}s`
        for (const layer of labelRef.current.querySelectorAll('.pp-text-stroke, .pp-text-fill')) if (layer.textContent !== text) layer.textContent = text
      }
      if (!ready) raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [readyAt])

  const fire = () => {
    if (performance.now() >= getGame().surgeReadyAt) actions.surge()
  }

  return (
    <div className="hud-surge pointer-events-none absolute">
      <ChunkyButton gradient={READY} onClick={fire} title="Surge (Space)" radius={24} border={5} className="flex-col overflow-hidden" style={{ width: u(170), height: u(170) }}>
        <span ref={fillRef} className="pointer-events-none absolute inset-0 origin-top" style={{ background: COOLING, opacity: 0.88, transform: 'scaleY(0)' }} />
        <Icon name="tornado" size={u(92)} style={{ marginTop: u(-8) }} />
        <span ref={labelRef} style={{ fontSize: u(42), marginTop: u(-10) }}>
          <StrokeText stroke={u(9)}>SURGE</StrokeText>
        </span>
      </ChunkyButton>
      <span className="absolute" style={{ left: u(-10), top: u(-20), fontSize: u(30) }}>
        <StrokeText stroke={u(7)}>Lv {level + 1}</StrokeText>
      </span>
    </div>
  )
}

export default SurgeButton
