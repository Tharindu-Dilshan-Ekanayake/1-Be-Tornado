import { useFrame, useThree } from '@react-three/fiber'
import { Vector3 } from 'three'

import { formatGain, formatNumber } from '@shared/format'

import { sfx } from '../../audio/sfx'
import { iconUrl } from '../../ui/icons'
import { runtime } from '../runtime'
import { drainTrainFx } from './fxQueue'
import { spawnPopup, updatePopups } from './popups'

const _at = new Vector3()
const BOLT_ICON = iconUrl('bolt')
const TROPHY_ICON = iconUrl('trophy')
const LEVEL_GRADIENT = 'linear-gradient(180deg, #e0faff 0%, #7fe2ff 45%, #2fa8ff 100%)'
const POWER_GRADIENT = 'linear-gradient(180deg, #f2ffcc 0%, #b8ff5a 45%, #4fd12a 100%)'
const WINS_GRADIENT = 'linear-gradient(180deg, #fffaa8 0%, #ffd52a 45%, #ff9c00 100%)'
/** Swallows come thick and fast: their Power is added up and shown at most this often (ms). */
const ABSORB_EVERY = 220

let pendingGain = 0
let lastAbsorbPopup = 0

/** A popup somewhere up the side of your funnel. */
function nearTornado(lift = 0) {
  const p = runtime.player.position
  const r = runtime.tornado.radius
  const a = Math.random() * Math.PI * 2
  return _at.set(p.x + Math.cos(a) * r * 0.5, 1.5 + r * 0.5 + lift + Math.random() * 1.5, p.z + Math.sin(a) * r * 0.5)
}

/**
 * One gain's feedback: Power from a Storm Zone or moving ('train') or swallowing
 * ('absorb'), or a city's Wins for another 10% of it destroyed ('cityWins').
 */
function showGain(event) {
  if (event.source === 'cityWins') {
    spawnPopup(`+${formatNumber(event.wins)} Wins`, nearTornado(3), { iconUrl: TROPHY_ICON, gradient: WINS_GRADIENT, scale: 1.8, life: 2200 })
  } else if (event.source === 'absorb') {
    pendingGain += event.gain
  } else if (event.gain > 0) {
    spawnPopup(`+${formatGain(event.gain)}`, nearTornado(), { iconUrl: BOLT_ICON, gradient: POWER_GRADIENT })
    sfx.gain(event.source !== 'pad')
  }
  if (event.leveledUp) {
    const p = runtime.player.position
    _at.set(p.x, 3 + runtime.tornado.height * 0.4, p.z)
    const text = event.maxed ? 'MAX LEVEL!' : event.levels > 1 ? `LEVEL UP! x${event.levels}` : 'LEVEL UP!'
    spawnPopup(text, _at, { gradient: LEVEL_GRADIENT, scale: 1.5, life: 1600 })
  }
}

/**
 * Power feedback: "+18 Power" rising off your funnel as you swallow things (added up over
 * a moment, so a streak reads as a steady climb rather than a blizzard of numbers), the
 * Wins for every 10% of a city destroyed, Storm Zone ticks, and LEVEL UP! when one lands. Also moves every
 * live popup each frame.
 */
export function GainFX() {
  const size = useThree((s) => s.size)

  useFrame((state) => {
    drainTrainFx(showGain)
    const now = performance.now()
    if (pendingGain > 0 && now - lastAbsorbPopup > ABSORB_EVERY) {
      lastAbsorbPopup = now
      spawnPopup(`+${formatGain(pendingGain)} Power`, nearTornado(), { iconUrl: BOLT_ICON, gradient: POWER_GRADIENT, scale: 1.05 })
      pendingGain = 0
    }
    updatePopups(state.camera, size.width, size.height)
  })

  return null
}


export default GainFX
