import { useFrame, useThree } from '@react-three/fiber'
import { Suspense, useEffect, useRef, useState } from 'react'
import { Vector3 } from 'three'

import { remotePlayers } from '../../net/remotePlayers'
import { getQuality } from '../../store/quality'
import { emoteFromAnim } from '../../bloxity/emotes'
import { BloxityAvatar } from '../PlayerAvatar'
import { riderPosition } from './rider'

/** How often the set of fully drawn players is reconsidered. */
const PICK_MS = 500
const _up = new Vector3(0, 1, 0)

/**
 * One other player as their real Bloxity avatar, dressed as they are, riding inside their
 * tornado - whirled round and flailing, posed by the same playerPose as yours - or playing
 * a Boxity emote.
 */
function RemoteAvatar({ sessionId, look }) {
  const groupRef = useRef(null)
  const motionRef = useRef({ time: 0, speed: 0, grounded: false, maxSpeed: 11, vy: 0, stride: 0, ride: 1 })

  useFrame((state, rawDelta) => {
    const group = groupRef.current
    const r = remotePlayers.get(sessionId)
    if (!group || !r) return
    const delta = Math.min(rawDelta, 0.05)
    const m = motionRef.current
    m.time += delta
    const t = state.clock.elapsedTime
    riderPosition(r, t, group.position)
    group.quaternion.setFromAxisAngle(_up, -(r.spin + t * 2.4) * 1.2)
    m.emote = emoteFromAnim(r.anim)
    m.ride = m.emote ? 0 : 1
    m.speed = 0
  })

  return (
    <group ref={groupRef}>
      <BloxityAvatar equipped={look?.equipped} proportions={look?.proportions} motionRef={motionRef} targetHeight={1.8} />
    </group>
  )
}

/**
 * The other players nearest the camera, as their real avatars: as many as the quality
 * preset allows (`remoteAvatars`), within `remoteAvatarDistance`. Anyone beyond those
 * limits is the cheap blocky figure RemotePlayers draws (`r.fullAvatar` tells it who's
 * covered).
 * Chosen twice a second, never per frame, so React only re-renders when the set of
 * players (or an outfit) actually changes.
 */
export function RemoteAvatars() {
  const camera = useThree((s) => s.camera)
  const [shown, setShown] = useState([])

  useEffect(() => {
    const pick = () => {
      const settings = getQuality()
      const near = []
      for (const r of remotePlayers.values()) {
        r.fullAvatar = false
        const d = camera.position.distanceTo(r.position)
        if (d < settings.remoteAvatarDistance) near.push([d, r])
      }
      near.sort((a, b) => a[0] - b[0])
      const next = near
        .slice(0, settings.remoteAvatars)
        .map(([, r]) => r)
        .sort((a, b) => (a.sessionId < b.sessionId ? -1 : 1))
      for (const r of next) r.fullAvatar = true
      setShown((prev) => {
        const same = prev.length === next.length && prev.every((p, i) => p.sessionId === next[i].sessionId && p.lookKey === next[i].lookKey)
        return same ? prev : next.map((r) => ({ sessionId: r.sessionId, look: r.look, lookKey: r.lookKey }))
      })
    }
    pick()
    const id = setInterval(pick, PICK_MS)
    return () => clearInterval(id)
  }, [camera])

  return (
    <>
      {shown.map((s) => (
        <Suspense key={`${s.sessionId}:${s.lookKey}`} fallback={null}>
          <RemoteAvatar sessionId={s.sessionId} look={s.look} />
        </Suspense>
      ))}
    </>
  )
}

export default RemoteAvatars
