import { useEffect } from 'react'

import { useGame } from '../../store/game'
import StrokeText from '../StrokeText'
import { GRADIENTS, u } from './style'

/** How long a big announcement stays up, and a toast. */
const BANNER_MS = 2600
const TOAST_MS = 3200

/** Each kind of announcement's ribbon. */
const RIBBONS = {
  stage: 'linear-gradient(180deg, #8fe0ff 0%, #2f9aff 55%, #1a5fd0 100%)',
  landmark: 'linear-gradient(180deg, #ffb36a 0%, #ff6a2a 55%, #c8320f 100%)',
  clear: 'linear-gradient(180deg, #fff6a8 0%, #ffc21f 55%, #e07a0a 100%)',
  ring: 'linear-gradient(180deg, #c6ff7a 0%, #4fd84a 55%, #1f9a2a 100%)',
  tornado: 'linear-gradient(135deg, #ff7ad2 0%, #9a5cff 45%, #3fb8ff 100%)',
  rebirth: 'linear-gradient(180deg, #ffd6ff 0%, #c25cff 55%, #7a2ad8 100%)',
  quest: 'linear-gradient(180deg, #b6ff9a 0%, #3fd86a 55%, #1f9a4a 100%)',
}

/**
 * The big moments across the middle of the screen - STAGE 3 UNLOCKED!, STAGE 1 DESTROYED!
 * (its Wins), a landmark coming down, +1 RING!, a new tornado, a rebirth, a quest done - one at a time on a tilted
 * chunky ribbon that slams in and sweeps out. And the smaller toast line under it.
 */
export function Banners() {
  const banner = useGame((s) => s.banner)
  const nextBanner = useGame((s) => s.nextBanner)
  const toast = useGame((s) => s.toast)

  useEffect(() => {
    if (!banner) return undefined
    const id = setTimeout(nextBanner, BANNER_MS)
    return () => clearTimeout(id)
  }, [banner, nextBanner])

  useEffect(() => {
    if (!toast) return undefined
    const id = setTimeout(() => {
      if (useGame.getState().toast === toast) useGame.setState({ toast: null })
    }, TOAST_MS)
    return () => clearTimeout(id)
  }, [toast])

  return (
    <>
      {banner && (
        <div key={banner.id} className="pp-banner pointer-events-none absolute left-0 right-0 flex flex-col items-center" style={{ top: '30%', animationDuration: `${BANNER_MS}ms` }}>
          <div
            className="relative flex flex-col items-center"
            style={{
              width: '100%',
              padding: `${u(18)} ${u(40)} ${u(22)}`,
              background: RIBBONS[banner.kind] ?? RIBBONS.stage,
              borderTop: `${u(8)} solid #ffffff`,
              borderBottom: `${u(8)} solid #ffffff`,
              boxShadow: `0 0 0 ${u(5)} #111, 0 ${u(14)} ${u(30)} rgba(0,0,0,0.35)`,
              transform: 'rotate(-3deg)',
            }}
          >
            <span className="pp-banner-shine pointer-events-none absolute inset-0" />
            <span style={{ fontSize: u(96), lineHeight: 1.05 }}>
              <StrokeText stroke={u(18)}>{banner.title}</StrokeText>
            </span>
            {banner.subtitle && (
              <span style={{ fontSize: u(46), marginTop: u(4) }}>
                <StrokeText stroke={u(10)} gradient={GRADIENTS.gold} style={{ whiteSpace: 'normal' }}>
                  {banner.subtitle}
                </StrokeText>
              </span>
            )}
          </div>
        </div>
      )}
      {toast && (
        <div
          key={toast.id}
          className="pp-result pointer-events-none absolute left-1/2 flex flex-col items-center text-center"
          style={{ top: banner ? '56%' : '24%', fontSize: u(46), animationDuration: `${TOAST_MS}ms`, width: 'max-content', maxWidth: '90vw' }}
        >
          <StrokeText stroke={u(10)} gradient={GRADIENTS.gold} style={{ whiteSpace: 'normal' }}>
            {toast.text}
          </StrokeText>
        </div>
      )}
    </>
  )
}

export default Banners
