import { PerformanceMonitor } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { WebGLRenderer } from 'three'

import { useBloxity } from '../bloxity/BloxityContext'
import { useBloxityStore } from '../bloxity/store'
import { prepareAudio } from '../audio/sfx'
import { RENDER_SCALES, useQuality } from '../store/quality'
import ErrorBoundary from '../ui/ErrorBoundary'
import BlobShadows from './BlobShadows'
import Rubble from './city/Rubble'
import StageManager from './city/StageManager'
import FollowCamera from './FollowCamera'
import CityFX from './fx/CityFX'
import GainFX from './fx/GainFX'
import Particles from './fx/Particles'
import Storm from './fx/Storm'
import WorldLabels from './labels/WorldLabels'
import Lighting from './Lighting'
import PerfProbe from './PerfProbe'
import { queueAllPetIcons } from './pets/petIcons'
import Pets, { RewardCrab } from './pets/Pets'
import Player from './Player'
import RemoteAvatars from './remote/RemoteAvatars'
import RemotePlayers from './remote/RemotePlayers'
import { FOG, SKY } from './sceneStyle'
import ShaderWarmup from './ShaderWarmup'
import Sky from './Sky'
import { StageSky } from './stageLook'
import Debris from './tornado/Debris'
import Tornadoes from './tornado/Tornadoes'
import WindSound from './tornado/WindSound'
import EggDisplays from './world/EggDisplays'
import Leaderboards from './world/Leaderboards'
import Lobby from './world/Lobby'
import Ocean from './world/Ocean'
import TutorialArrows from './world/TutorialArrows'

// r3f-perf is a dev-only overlay (?perf in the URL). The DEV check is static, so the
// import and the package are dropped from production builds entirely.
const DevPerf = import.meta.env.DEV ? lazy(() => import('r3f-perf').then((m) => ({ default: m.Perf }))) : null
const showDevPerf = import.meta.env.DEV && new URLSearchParams(window.location.search).has('perf')

/**
 * Fires `onFirstFrame` after the renderer has actually drawn once.
 * "Ready" should mean "the player can see the game", not "React mounted".
 */
function FirstFrameSignal({ onFirstFrame }) {
  const fired = useRef(false)
  useFrame(() => {
    if (fired.current) return
    fired.current = true
    performance.mark('pp:first-frame')
    // Deferred: never update React state from inside the frame loop.
    setTimeout(onFirstFrame, 0)
  })
  return null
}

/** Keeps the camera's far plane in step with the preset's view distance. */
function ViewDistance({ far }) {
  const get = useThree((s) => s.get)
  useEffect(() => {
    const { camera } = get()
    camera.far = far
    camera.updateProjectionMatrix()
  }, [get, far])
  return null
}

/**
 * The camera's vertical field of view for a screen `aspect` wide: 60 degrees on a
 * landscape screen; wider on one held upright, so the city around your tornado still fits
 * across a phone in portrait.
 */
const fovForAspect = (aspect) => (aspect >= 1 ? 60 : Math.min(84, 60 / Math.sqrt(Math.max(0.3, aspect))))

function AspectFov() {
  const get = useThree((s) => s.get)
  const width = useThree((s) => s.size.width)
  const height = useThree((s) => s.size.height)
  useEffect(() => {
    const { camera } = get()
    camera.fov = fovForAspect(width / Math.max(1, height))
    camera.updateProjectionMatrix()
  }, [get, width, height])
  return null
}

/**
 * The 3D view. Owns the renderer lifecycle: quality-driven settings, automatic preset
 * drops when FPS falls under budget, and recovery from a lost WebGL context.
 *
 * What's in it: the sea, the lobby island, the cities near you (StageManager builds them
 * as they come close and drops them as they go) and the wreckage you leave in them
 * (Rubble), every tornado (Tornadoes: one draw call for all of them) and the bricks
 * whirling round them, the players riding inside, pets, labels, effects, and the storm
 * over the cities (Storm: dark sky, lightning, thunder).
 *
 * @param {{ onReady?: () => void }} props called once the avatar is in and a frame
 *   has been drawn
 */
export function GameScene({ onReady }) {
  const { game } = useBloxity()
  const settings = useQuality((s) => s.settings)
  const antialias = useQuality((s) => s.antialias)
  // A level picked in Settings rebuilds the whole 3D view with it.
  const rebuild = useQuality((s) => s.rebuild)
  const degrade = useQuality((s) => s.degrade)
  const recover = useQuality((s) => s.recover)
  const renderScale = useQuality((s) => RENDER_SCALES[s.renderStep])
  // Boxity ad break: nothing renders until it's over.
  const adBreak = useBloxityStore((s) => s.adBreak)

  const [warmedUp, setWarmedUp] = useState(false)
  const [firstFrame, setFirstFrame] = useState(false)
  const [contextKey, setContextKey] = useState(0)
  const [contextLost, setContextLost] = useState(false)
  /** The last rebuild (see quality.js) whose shaders have warmed up. */
  const [warmedRebuild, setWarmedRebuild] = useState(0)
  const rebuilding = rebuild !== warmedRebuild
  const readySent = useRef(false)

  const handleWarmedUp = useCallback(() => {
    setWarmedUp(true)
    setWarmedRebuild(useQuality.getState().rebuild)
  }, [])
  const handleFirstFrame = useCallback(() => setFirstFrame(true), [])

  useEffect(() => {
    game.loadingStep('Preparing scene…')
  }, [game])

  // Playable once every shader is compiled and the first real frame is drawn. The
  // player's own avatar streams in afterwards (a blocky stand-in shows meanwhile).
  useEffect(() => {
    if (!warmedUp || !firstFrame || readySent.current) return
    readySent.current = true
    performance.mark('pp:ready')
    game.loadingEnd()
    onReady?.()
    queueAllPetIcons()
    if ('requestIdleCallback' in window) requestIdleCallback(prepareAudio, { timeout: 1500 })
    else setTimeout(prepareAudio, 200)
  }, [warmedUp, firstFrame, game, onReady])

  // A lost context (GPU reset, too many tabs, backgrounded on mobile) is recovered by
  // remounting the canvas, which builds a fresh context and re-uploads everything.
  // Game state lives in stores, so nothing is lost but a moment of rendering.
  const handleCreated = useCallback(({ gl }) => {
    performance.mark('pp:gl-created')
    gl.setClearColor(SKY.horizon)
    gl.debug.checkShaderErrors = import.meta.env.DEV
    const canvas = gl.domElement
    let remountTimer = null
    const remount = () => {
      clearTimeout(remountTimer)
      setContextLost(false)
      setContextKey((k) => k + 1)
    }
    canvas.addEventListener('webglcontextlost', (e) => {
      // A canvas already taken off the page was replaced on purpose (a new graphics
      // level), and losing its context is how it's cleaned up: nothing to recover.
      if (!canvas.isConnected) return
      e.preventDefault()
      setContextLost(true)
      // Don't wait forever for a 'restored' that may never come.
      remountTimer = setTimeout(remount, 1500)
    })
    canvas.addEventListener('webglcontextrestored', remount)
  }, [])

  // Never set state from the monitor's frame callback directly.
  const handleDecline = useCallback(() => setTimeout(degrade, 0), [degrade])
  const handleIncline = useCallback(() => setTimeout(recover, 0), [recover])

  const dpr = Math.min(settings.dpr, window.devicePixelRatio || 1) * renderScale

  const createRenderer = useMemo(
    () => (defaults) => {
      performance.mark('pp:gl-start')
      const renderer = new WebGLRenderer({
        ...defaults,
        alpha: false,
        antialias,
        stencil: false,
        powerPreference: 'high-performance',
      })
      performance.mark('pp:gl-end')
      return renderer
    },
    [antialias],
  )

  return (
    <>
      <Canvas
        key={`${contextKey}:${rebuild}`}
        frameloop={adBreak ? 'never' : 'always'}
        dpr={dpr}
        gl={createRenderer}
        shadows={settings.shadows === 'realtime' ? 'percentage' : false}
        flat
        camera={{ position: [0, 14, 52], fov: 60, near: 0.5, far: settings.viewDistance }}
        onCreated={handleCreated}
      >
        <fog attach="fog" args={[FOG.color, settings.fogNear, settings.viewDistance * 0.95]} />
        <ViewDistance far={settings.viewDistance} />
        <AspectFov />
        {/* Under 45 FPS: shed load (quality.degrade). Back over 58 with room to spare:
            resolution comes back (quality.recover). */}
        <PerformanceMonitor bounds={() => [45, 58]} flipflops={4} onDecline={handleDecline} onIncline={handleIncline} />

        <Sky />
        <StageSky />
        <Lighting />
        <Ocean />
        <Lobby />
        <WorldLabels />
        <EggDisplays />
        <Leaderboards />
        <TutorialArrows />
        <Particles />
        <RewardCrab />
        <Pets />
        {warmedUp && firstFrame && <StageManager />}
        <Rubble />
        <Player />
        <RemotePlayers />
        <RemoteAvatars />
        <Tornadoes />
        <Debris />
        <BlobShadows />
        <CityFX />
        <Storm />
        <GainFX />
        <WindSound />

        <FollowCamera />
        <ShaderWarmup onDone={handleWarmedUp} />
        {warmedUp && <FirstFrameSignal onFirstFrame={handleFirstFrame} />}
        <PerfProbe />
        {showDevPerf && DevPerf && (
          <ErrorBoundary>
            <Suspense fallback={null}>
              <DevPerf position="top-left" />
            </Suspense>
          </ErrorBoundary>
        )}
      </Canvas>

      {(contextLost || rebuilding) && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-sky-400/80 text-2xl text-white">
          <span className="pp-stroke">Reloading graphics…</span>
        </div>
      )}
    </>
  )
}

export default GameScene
