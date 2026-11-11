import { useFrame } from '@react-three/fiber'
import { useEffect } from 'react'

import { sfx } from '../../audio/sfx'
import { runtime } from '../runtime'

/**
 * Your tornado's roar: started once audio is allowed (the first tap), swelling with how
 * fast you're going and how big you've grown. sfx.windSet throttles itself.
 */
export function WindSound() {
  useEffect(() => () => sfx.windStop(), [])
  useFrame(() => {
    sfx.windStart()
    const level = Math.min(1, runtime.player.speed / 18 + runtime.tornado.radius / 30)
    sfx.windSet(0.25 + level * 0.75, true)
  })
  return null
}

export default WindSound
