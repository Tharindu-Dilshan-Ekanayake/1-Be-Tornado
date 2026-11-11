import { useEffect, useRef } from 'react'

import { registerStormOverlay } from '../game/fx/stormOverlay'

/**
 * The storm over the screen: a dark vignette closing in from the edges, and lightning's
 * flash. Two fixed elements under the HUD; game/fx/stormOverlay.js sets their opacity.
 */
export function StormOverlay() {
  const vignette = useRef(null)
  const flash = useRef(null)
  useEffect(() => {
    registerStormOverlay(vignette.current, flash.current)
    return () => registerStormOverlay(null, null)
  }, [])
  return (
    <>
      <div
        ref={vignette}
        className="pointer-events-none absolute inset-0 z-[1]"
        style={{ display: 'none', opacity: 0, background: 'radial-gradient(ellipse at 50% 45%, rgba(8,12,22,0) 45%, rgba(8,12,22,0.42) 78%, rgba(4,6,12,0.72) 100%)' }}
      />
      <div ref={flash} className="pointer-events-none absolute inset-0 z-[1]" style={{ display: 'none', opacity: 0, background: 'rgba(225,235,255,0.5)' }} />
    </>
  )
}

export default StormOverlay
