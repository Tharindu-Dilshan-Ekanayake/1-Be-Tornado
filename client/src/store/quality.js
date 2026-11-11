import { create } from 'zustand'

/**
 * Graphics quality presets. Every visual feature reads its settings from here rather
 * than deciding for itself, so dropping a preset reliably sheds load everywhere.
 *
 * LOW is the mobile / weak-PC baseline: no realtime shadows, no particles, no
 * post-processing, short view distance and textures capped at 512px.
 */
export const QUALITY_LEVELS = ['LOW', 'MEDIUM', 'HIGH']

export const PRESETS = {
  LOW: {
    dpr: 1,
    antialias: false,
    /** 'blob' = fake contact shadows only; 'realtime' = shadow-mapped sun. */
    shadows: 'blob',
    shadowMapSize: 0,
    particles: false,
    /** Bricks whirling round the tornadoes (0 = off: the funnel shader's specks only). */
    debris: 0,
    /** The tornado funnel's mesh: nested shells, segments round, rings up. */
    funnelDetail: { layers: 2, segments: 20, rings: 10, skirt: true },
    /**
     * Wreckage left where things were torn up, until they come back: boxes in one
     * InstancedMesh (one draw call), reused oldest-first. Not particles: it doesn't move.
     */
    rubble: 90,
    /**
     * How many boxes a frame may fly apart on their own when things are torn up (each
     * object bursts into its boxes); past that, the rest fly in whole. Caps the CPU cost
     * of a giant tornado mowing down a whole block at once.
     */
    shatterBoxes: 450,
    /** The storm over the cities: a lightning bolt (one draw call, only while it flashes). */
    lightningBolt: true,
    /** A dark CSS vignette at the screen's edges in the storm (no post-processing). */
    stormVignette: true,
    viewDistance: 300,
    fogNear: 120,
    cloudCount: 8,
    /** Max side of any generated texture. */
    maxTexture: 512,
    /**
     * Other players' tornadoes are drawn this far away, and the nearest `remoteAvatars`
     * of them within `remoteAvatarDistance` ride as their real Boxity avatar (anyone else
     * as the blocky figure, one draw call for all). A Boxity avatar is one draw call
     * plus one per worn item, so LOW keeps it to the nearest three: the cities' chunks
     * need the draw calls.
     */
    remoteDrawDistance: 320,
    remoteAvatars: 7,
    remoteAvatarDistance: 1000,
    remoteNameDistance: 90,
    /** World labels fade out past this. */
    labelDistance: 80,
    /** How much of the lobby's scenery to spawn (0-1). */
    decorDensity: 0.45,
    /** Board and egg halo size multiplier. */
    boardGlow: 0.8,
  },
  MEDIUM: {
    dpr: 1.25,
    antialias: true,
    shadows: 'blob',
    shadowMapSize: 0,
    particles: true,
    debris: 180,
    funnelDetail: { layers: 2, segments: 28, rings: 14, skirt: true },
    rubble: 200,
    shatterBoxes: 900,
    lightningBolt: true,
    stormVignette: true,
    viewDistance: 360,
    fogNear: 150,
    cloudCount: 14,
    maxTexture: 1024,
    remoteDrawDistance: 380,
    remoteAvatars: 7,
    remoteAvatarDistance: 1000,
    remoteNameDistance: 110,
    labelDistance: 110,
    decorDensity: 0.75,
    boardGlow: 1,
  },
  HIGH: {
    dpr: 1.5,
    antialias: true,
    shadows: 'realtime',
    shadowMapSize: 1024,
    particles: true,
    debris: 320,
    funnelDetail: { layers: 3, segments: 32, rings: 16, skirt: true },
    rubble: 320,
    shatterBoxes: 1400,
    lightningBolt: true,
    stormVignette: true,
    viewDistance: 460,
    fogNear: 190,
    cloudCount: 18,
    maxTexture: 1024,
    remoteDrawDistance: 480,
    remoteAvatars: 7,
    remoteAvatarDistance: 1000,
    remoteNameDistance: 130,
    labelDistance: 150,
    decorDensity: 1,
    boardGlow: 1,
  },
}

const STORAGE_KEY = 'pp.quality'

/**
 * Resolution steps, as a fraction of the preset's pixel ratio. Below LOW, a weak PC or
 * phone still under 45 FPS renders fewer pixels: the scene is the same, only softer.
 * Shading every pixel is what an integrated GPU runs out of first, so this is the
 * biggest single saving there is.
 */
export const RENDER_SCALES = [1, 0.85, 0.7, 0.6]

function isMobileDevice() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  if (/Android|iPhone|iPad|iPod|Mobile|Silk|Kindle/i.test(ua)) return true
  // iPadOS reports itself as a Mac; touch points give it away.
  return navigator.maxTouchPoints > 1 && /Macintosh/.test(ua)
}

function readSaved() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return QUALITY_LEVELS.includes(saved) ? saved : null
  } catch {
    return null
  }
}

/**
 * Everyone starts on LOW, the safe choice (phones, small CPUs, and a first load that has
 * to be playable in seconds); a player can pick MEDIUM or HIGH in Settings, and that is
 * remembered on this device. The performance monitor still drops a preset (and then the
 * resolution) by itself if FPS stays under 45.
 */
export const DEFAULT_LEVEL = 'LOW'

const initialLevel = readSaved() || DEFAULT_LEVEL

export const useQuality = create((set, get) => ({
  level: initialLevel,
  /** True when the player picked the level by hand; auto-drop then stays out of it. */
  manual: readSaved() !== null,
  isMobile: isMobileDevice(),
  /** Antialiasing can't change without recreating the WebGL context (see `rebuild`). */
  antialias: PRESETS[initialLevel].antialias,
  settings: PRESETS[initialLevel],
  /**
   * Bumped when the player picks a new level by hand: the 3D view is rebuilt from
   * scratch, so things set when it's made (antialiasing, scenery density, tire detail)
   * take the new level at once.
   */
  rebuild: 0,
  /** Index into RENDER_SCALES: how far resolution has been dropped to keep FPS up. */
  renderStep: 0,

  setLevel: (level, manual = true) => {
    if (!QUALITY_LEVELS.includes(level)) return
    if (manual) {
      try {
        localStorage.setItem(STORAGE_KEY, level)
      } catch {
        // Private mode: the choice just won't persist.
      }
    }
    const changed = level !== get().level
    set((s) => ({
      level,
      manual,
      settings: PRESETS[level],
      ...(manual && changed ? { antialias: PRESETS[level].antialias, rebuild: s.rebuild + 1 } : {}),
    }))
  },

  /**
   * Called by the performance monitor when FPS stays under budget: drops a preset if it
   * can (not one the player picked by hand), and once on LOW (or a hand-picked level),
   * renders at a lower resolution instead, a step at a time.
   */
  degrade: () => {
    const { level, manual, renderStep } = get()
    const index = QUALITY_LEVELS.indexOf(level)
    if (!manual && index > 0) {
      const next = QUALITY_LEVELS[index - 1]
      console.info(`[quality] FPS under budget, dropping ${level} -> ${next}`)
      set({ level: next, settings: PRESETS[next] })
      return
    }
    if (renderStep + 1 < RENDER_SCALES.length) {
      console.info(`[quality] FPS under budget, rendering at ${RENDER_SCALES[renderStep + 1] * 100}%`)
      set({ renderStep: renderStep + 1 })
    }
  },

  /** Called when FPS has plenty of headroom again: resolution comes back a step. */
  recover: () => {
    const { renderStep } = get()
    if (renderStep > 0) set({ renderStep: renderStep - 1 })
  },
}))

/** Non-reactive read, safe inside useFrame. */
export const getQuality = () => useQuality.getState().settings
