import { useFrame } from '@react-three/fiber'
import { Color } from 'three'

import { STAGES } from '@shared/balance'
import { THEMES } from '@shared/cities'
import { stageNear } from '@shared/world'

import { getQuality } from '../store/quality'
import { SKY } from './sceneStyle'
import { skyUniforms } from './skyState'
import { runtime } from './runtime'

/**
 * Each place's sky: the lobby's bright day, and every city's own (a dusky one over the
 * neon city, a starry one on the moon...). The sky (and the fog, which matches its
 * horizon) eases from one to the next as you cross the bridges.
 */

/** A sky's look, parsed once: `{ top, horizon, sun, glow, clouds, stars }`. */
export function skyLook({ top, horizon, sun = '#ffffff', glow = 0.5, clouds = 0.4, stars = 0 }) {
  return { top: new Color(top), horizon: new Color(horizon), sun: new Color(sun), glow, clouds, stars }
}

const LOBBY_SKY = skyLook(SKY)
const STAGE_SKIES = STAGES.map((s) => {
  const t = THEMES[s.theme]
  const [top, horizon] = t.sky
  return skyLook({ top, horizon, sun: t.night ? '#ffe8f8' : '#fff2d8', glow: t.night ? 0.3 : 0.55, clouds: t.night ? 0.25 : 0.8, stars: t.night ? 0.9 : 0 })
})

/** The sky for wherever (x, z) is. */
export const skyFor = (z) => {
  const near = stageNear(z)
  return near < 0 ? LOBBY_SKY : STAGE_SKIES[near]
}

/** The storm's own sky: slate-grey, the sun all but gone. */
const STORM_SKY = skyLook({ top: '#2a313c', horizon: '#76808c', sun: '#c8d2e0', glow: 0.12, clouds: 1 })
const _stormy = { top: new Color(), horizon: new Color(), sun: new Color(), glow: 0, clouds: 0, stars: 0 }

/** `look` darkened by the storm, `k` (0-1) of the way to STORM_SKY. Allocation-free. */
function stormy(look, k) {
  _stormy.top.copy(look.top).lerp(STORM_SKY.top, k)
  _stormy.horizon.copy(look.horizon).lerp(STORM_SKY.horizon, k)
  _stormy.sun.copy(look.sun).lerp(STORM_SKY.sun, k)
  _stormy.glow = look.glow + (STORM_SKY.glow - look.glow) * k
  _stormy.clouds = look.clouds + (STORM_SKY.clouds - look.clouds) * k
  _stormy.stars = look.stars * (1 - k * 0.6)
  return _stormy
}

/**
 * Moves the sky (and the fog) towards `look` by `k` (0-1; 1 jumps straight there).
 * Allocation-free: safe in a frame loop.
 */
export function blendSky(look, k, fog) {
  const u = skyUniforms
  u.topColor.value.lerp(look.top, k)
  u.horizonColor.value.lerp(look.horizon, k)
  u.sunColor.value.lerp(look.sun, k)
  u.glow.value += (look.glow - u.glow.value) * k
  u.clouds.value += (look.clouds - u.clouds.value) * k
  u.stars.value += (look.stars - u.stars.value) * k
  if (fog) fog.color.copy(u.horizonColor.value)
}

/**
 * Keeps the sky in step with where you are - darkened, and the fog closing in, as the
 * storm over the cities gathers (runtime.storm, Storm.jsx). Mount once inside the Canvas.
 */
export function StageSky() {
  useFrame((state, delta) => {
    const storm = runtime.storm.level
    const fog = state.scene.fog
    blendSky(stormy(skyFor(runtime.player.position.z), storm * 0.8), 1 - Math.exp(-1.5 * Math.min(delta, 0.1)), fog)
    skyUniforms.storm.value = storm
    skyUniforms.flash.value = runtime.storm.flash
    if (fog) {
      const q = getQuality()
      fog.near = q.fogNear * (1 - 0.45 * storm)
      fog.far = q.viewDistance * 0.95 * (1 - 0.15 * storm)
    }
  })
  return null
}
