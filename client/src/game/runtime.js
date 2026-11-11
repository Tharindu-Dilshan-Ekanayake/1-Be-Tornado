import { Vector3 } from 'three'

import { BASE_RADIUS, TORNADO_HEIGHT } from '@shared/balance'
import { SPAWN } from '@shared/world'

/**
 * Per-frame mutable state shared between systems.
 *
 * Deliberately outside React and zustand: it changes every frame, nothing should
 * re-render because of it, and every reader lives in a `useFrame` or a timer. UI that
 * needs a slow-changing derivative of it (which city you're in, say) gets it from the
 * 10 Hz game ticker, which is the only thing that copies from here into the store.
 */
export const runtime = {
  player: {
    position: new Vector3(SPAWN.x, 0, SPAWN.z),
    /** Where the tornado is heading (m/s), for its lean and the debris trail. */
    velocity: new Vector3(),
    /** Facing, radians about +Y. PI faces north (-Z), towards the cities. */
    yaw: Math.PI,
    speed: 0,
    grounded: true,
    /** 'idle' | 'walk' | 'run' (in a Storm Zone) | 'surge' - what other players see. */
    anim: 'idle',
    /** Set when the controller should ignore input. */
    frozen: false,
  },

  /** Your tornado as drawn: its radius eases towards the real one as it grows or shrinks. */
  tornado: {
    radius: BASE_RADIUS,
    height: BASE_RADIUS * TORNADO_HEIGHT,
    /** performance.now() of your last Surge (its shockwave), or -Infinity. */
    surgeAt: -Infinity,
    /** How hard it's spinning: a burst after every swallow, settling back to 1. */
    spin: 1,
  },

  /**
   * The storm over the cities (Storm.jsx): `level` 0 (the lobby's clear day) .. 1, how dark
   * and wild it is; `flash` 0..1, a lightning flash right now.
   */
  storm: {
    level: 0,
    flash: 0,
    /** Set to strike lightning straight away (the debug tools). */
    strikeNow: false,
  },

  /** Touch input, written by the on-screen joystick. -1..1, +y = forward. */
  input: {
    joyX: 0,
    joyY: 0,
  },

  camera: {
    mode: 'follow',
    yaw: 0,
    pitch: 0.55,
    distance: 18,
    /** Set to jump the follow camera straight to its target next frame. */
    snap: false,
    /** A shake to add this frame (decays by itself): landmark smashes, Surges. */
    shake: 0,
  },

  /**
   * Other players' pets, written by the multiplayer layer: `{ id, position, yaw, hop }`
   * per pet. Drawn by the same instanced pet meshes as yours.
   */
  remotePets: [],

  /** Walls that come and go at runtime, e.g. locked Storm Zones. */
  dynamicColliders: [],

  /**
   * Things that get a blob shadow on low presets. Each entry is
   * `{ position: Vector3, size: number, visible?: boolean }`.
   */
  shadowCasters: new Set(),
}

/** Puts the player back at spawn, e.g. after a reconnect into a fresh lobby. */
export function respawn() {
  runtime.player.position.set(SPAWN.x, 0, SPAWN.z)
  runtime.player.yaw = Math.PI
  runtime.camera.snap = true
}
