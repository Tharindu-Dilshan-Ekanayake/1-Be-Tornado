/**
 * The scene's look in one place: a bright day over a blue sea, the islands floating on it.
 * Each city has its own sky (cities.js THEMES `sky`), blended in as you get there
 * (stageLook.js); this is the lobby's.
 *
 * Colours are sRGB hex. Light intensities are three.js physical units: a light of
 * intensity PI (~3.14) lights a surface facing it to its full colour; the sky fill plus
 * the sun add up to just over that, which keeps the toy colours vivid.
 */

export const SKY = {
  /** Straight up. */
  top: '#3f8cff',
  /** At eye level. Fog uses the same colour so distant ground melts into the sky. */
  horizon: '#cfeeff',
  /** Lower = the deep colour reaches further down towards the horizon. */
  exponent: 0.55,
  /** The sun's glow round its direction, and how strong it is. */
  sun: '#fff4d8',
  glow: 0.55,
  /** High clouds (0 none, 1 plenty), and stars (night cities only). */
  clouds: 0.85,
  stars: 0,
}

export const FOG = {
  color: SKY.horizon,
}

export const LIGHTS = {
  /** A cool fill from the sky, a warm bounce off the ground. */
  hemiSky: '#dcecff',
  hemiGround: '#d8c8a8',
  hemiIntensity: 2.1,

  /** A bright, high sun. */
  sunColor: '#fff2dc',
  sunIntensity: 1.9,
  /** Direction *towards* the sun: high in the north-west, over the cities. */
  sunDirection: [-0.4, 0.8, -0.45],
  /** 1 = shadows get no sunlight at all; lower = lighter shadows. */
  shadowIntensity: 0.55,
  /** Blur radius of shadow edges, in shadow-map texels. */
  shadowSoftness: 3,
}
