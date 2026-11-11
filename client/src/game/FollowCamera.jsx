import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { Vector3 } from 'three'

import { getBloxityState } from '../bloxity/store'
import { placeLocalBubble } from './remote/nameplates'
import { runtime } from './runtime'

/** How high above the ground the camera aims: a little way up the funnel. */
const LOOK_HEIGHT = 2

/** Zoom limits, as multiples of the view the tornado's size calls for. */
const MIN_ZOOM = 0.45
const MAX_ZOOM = 2.2

// Pitch limits, in radians. Stops the camera flipping over the top or sinking
// under the ground.
const MIN_PITCH = 0.08
const MAX_PITCH = 1.3

const DRAG_SENSITIVITY = 0.005
const TOUCH_SENSITIVITY = 0.007
const ZOOM_SENSITIVITY = 0.012

// Higher = snappier. Framerate-independent via the exp() smoothing below.
const POSITION_SMOOTHING = 10
const LOOK_SMOOTHING = 14

const _desired = new Vector3()
/** Where the camera looks, eased (one camera, so module-level). */
const _lookAt = new Vector3()
const _target = new Vector3()
/** How far back the camera sits for a tornado of `radius`: bigger tornado, wider view. */
const distanceFor = (radius) => 9 + radius * 3.1

/**
 * Third-person orbit camera around the player.
 *
 * Mouse: drag (either button) orbits, wheel zooms. Touch: one-finger drag orbits (the
 * joystick owns the left side of the screen as a separate element), pinch zooms.
 *
 * It sits further back the bigger your tornado grows (so the funnel and what's around it
 * always fit), looking down a little onto the city; zoom scales that. Orbit state lives
 * in `runtime.camera`; `runtime.camera.shake` jolts it for a moment (a landmark coming
 * down, a Surge). Drag speed is scaled by the player's Boxity
 * camera_sensitivity setting. Also places your own chat bubble each frame, once the
 * camera has moved (it needs the final camera to project).
 */
export function FollowCamera() {
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const initialised = useRef(false)

  useEffect(() => {
    const el = gl.domElement
    if (!el) return undefined

    /** pointerId -> last { x, y } */
    const pointers = new Map()
    let pinchDistance = 0

    const orbit = runtime.camera

    const onPointerDown = (e) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      el.setPointerCapture?.(e.pointerId)
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()]
        pinchDistance = Math.hypot(a.x - b.x, a.y - b.y)
      }
    }

    const onPointerMove = (e) => {
      const last = pointers.get(e.pointerId)
      if (!last) return

      if (pointers.size >= 2) {
        last.x = e.clientX
        last.y = e.clientY
        const [a, b] = [...pointers.values()]
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        orbit.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, (orbit.zoom ?? 1) - (d - pinchDistance) * 0.004))
        pinchDistance = d
        return
      }

      const dx = e.clientX - last.x
      const dy = e.clientY - last.y
      last.x = e.clientX
      last.y = e.clientY
      const sensitivity =
        (e.pointerType === 'touch' ? TOUCH_SENSITIVITY : DRAG_SENSITIVITY) * getBloxityState().cameraSensitivity
      orbit.yaw -= dx * sensitivity
      orbit.pitch = Math.min(MAX_PITCH, Math.max(MIN_PITCH, orbit.pitch + dy * sensitivity))
    }

    const endDrag = (e) => {
      pointers.delete(e.pointerId)
      el.releasePointerCapture?.(e.pointerId)
    }

    const onWheel = (e) => {
      // Without this the page scrolls behind the canvas.
      e.preventDefault()
      orbit.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, (orbit.zoom ?? 1) + e.deltaY * ZOOM_SENSITIVITY * 0.08))
    }

    // Right-dragging otherwise opens the browser context menu mid-orbit.
    const onContextMenu = (e) => e.preventDefault()

    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', endDrag)
    el.addEventListener('pointercancel', endDrag)
    el.addEventListener('contextmenu', onContextMenu)
    // passive:false is required for preventDefault() on wheel to take effect.
    el.addEventListener('wheel', onWheel, { passive: false })

    return () => {
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', endDrag)
      el.removeEventListener('pointercancel', endDrag)
      el.removeEventListener('contextmenu', onContextMenu)
      el.removeEventListener('wheel', onWheel)
    }
  }, [gl])

  useFrame((state, rawDelta) => {
    if (runtime.camera.mode !== 'follow') {
      // Whoever owns the camera now (the debug tools) is moving it.
      placeLocalBubble(camera, state.size.width, state.size.height)
      return
    }
    const delta = Math.min(rawDelta, 0.05)
    const p = runtime.player.position
    const radius = runtime.tornado.radius
    _target.set(p.x, p.y + LOOK_HEIGHT + radius * 0.35, p.z)

    // Spherical -> cartesian. yaw 0 puts the camera south of the player, looking north.
    const yaw = runtime.camera.yaw
    const pitch = runtime.camera.pitch
    const distance = distanceFor(radius) * (runtime.camera.zoom ?? 1)
    runtime.camera.distance = distance
    const horizontal = Math.cos(pitch) * distance
    _desired.set(
      _target.x + Math.sin(yaw) * horizontal,
      Math.max(_target.y + Math.sin(pitch) * distance, 1.2),
      _target.z + Math.cos(yaw) * horizontal,
    )
    // Big smashes shake the view a moment (as hard from a big tornado's far-off view).
    const shake = runtime.camera.shake
    if (shake > 0.001) {
      const t = state.clock.elapsedTime
      const amp = shake * Math.max(1, distance / 18)
      _desired.x += Math.sin(t * 61) * amp
      _desired.y += Math.sin(t * 47 + 1) * amp * 0.7
      _desired.z += Math.cos(t * 53) * amp
      runtime.camera.shake = shake * Math.exp(-6 * delta)
    }

    // After a slide the camera is far down the hill; jump back rather than swoop.
    if (runtime.camera.snap) {
      runtime.camera.snap = false
      initialised.current = false
    }

    if (!initialised.current) {
      // Avoid a long swoop in from wherever the default camera started.
      camera.position.copy(_desired)
      _lookAt.copy(_target)
      initialised.current = true
    }

    camera.position.lerp(_desired, 1 - Math.exp(-POSITION_SMOOTHING * delta))
    if (shake > 0.001) camera.position.lerp(_desired, 0.5)
    _lookAt.lerp(_target, 1 - Math.exp(-LOOK_SMOOTHING * delta))
    camera.lookAt(_lookAt)
    camera.updateMatrixWorld()
    placeLocalBubble(camera, state.size.width, state.size.height)
  })

  return null
}

export default FollowCamera
