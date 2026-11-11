import { useEffect, useRef } from 'react'

import { PROGRESS_POOL_SIZE, registerProgressElements } from '../game/fx/progressBars'
import { u } from './hud/style'

const SLOTS = Array.from({ length: PROGRESS_POOL_SIZE }, (_, i) => i)

/**
 * The DOM side of the bars over big things being torn up ("GIANT TROPHY 44%"): renders a
 * fixed set of elements once and hands them to progressBars.js, which moves them without
 * React.
 */
export function ProgressLayer() {
  const refs = useRef([])
  useEffect(() => {
    registerProgressElements(refs.current)
  }, [])
  return (
    <div className="pp-font pointer-events-none absolute inset-0 z-[22] overflow-hidden">
      {SLOTS.map((i) => (
        <div
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          className="absolute left-0 top-0 flex-col items-center"
          style={{ display: 'none', gap: u(4), willChange: 'transform', contain: 'layout style' }}
        >
          <span className="pp-text" style={{ fontSize: u(30) }}>
            <span data-text aria-hidden="true" className="pp-text-stroke" style={{ WebkitTextStrokeWidth: u(7) }} />
            <span data-text className="pp-text-fill" style={{ color: '#fff6a8' }} />
          </span>
          <div className="relative overflow-hidden" style={{ width: u(240), height: u(24), borderRadius: u(12), border: `${u(4)} solid #111`, background: '#2a2f3a' }}>
            <div data-fill className="absolute inset-0 origin-left" style={{ transform: 'scaleX(0)', background: 'linear-gradient(180deg, #fff27a 0%, #ffc61e 50%, #ff9a12 100%)' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export default ProgressLayer
