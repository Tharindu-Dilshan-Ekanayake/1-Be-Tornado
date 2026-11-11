import { create } from 'zustand'

import { SPHINX_STOCK_DEFAULT } from '@shared/balance'
import { createProfile, createSession } from '@shared/logic'

/**
 * Everything the UI renders from. Written by the network layer (profile, events) and
 * the 10 Hz game ticker (zones) - never from a frame loop.
 *
 * Components must select narrowly (`useGame((s) => s.profile.wins)`), so a Power tick
 * re-renders the Power label and nothing else.
 */

const MAX_FEED = 4

export const useGame = create((set, get) => ({
  /** Authoritative copy of the player's save, as last sent by the server. */
  profile: createProfile('local', 'Player'),
  /** Per-connection state: session start, claimed playtime rewards. */
  session: createSession(Date.now()),
  /** True once the first real profile has arrived. */
  profileLoaded: false,
  /** True once the game is on screen; non-essential start-up work waits for it. */
  playable: false,

  net: {
    /** 'connecting' | 'online' | 'offline' | 'replaced' */
    mode: 'connecting',
    lobbyId: null,
    /** Short code friends join with, for private lobbies. */
    code: null,
    isPrivate: false,
    players: 1,
    maxPlayers: 8,
    message: null,
  },
  sphinxStock: SPHINX_STOCK_DEFAULT,
  leaderboards: null,

  /**
   * Where the player is, from the ticker: the Storm Zone, tornado stand (its BUY spot) or
   * egg they're at, by the free reward, the city they're in (`stage`, -1 off any island)
   * and the one they're nearest along the chain (`near`, -1 in the lobby).
   */
  zone: { pad: -1, stand: -1, egg: null, freeReward: false, stage: -1, near: -1 },

  /** Which modal panel is open: 'rebirth' | 'types' | 'stages' | 'upgrades' | 'store' | ... */
  panel: null,
  /** Extra data for the open panel. */
  panelData: null,

  /** A short line across the middle: { text, id } (ad rewards, purchases, quests). */
  toast: null,
  /** The big announcement showing now ({ id, title, subtitle, kind }), and those waiting. */
  banner: null,
  bannerQueue: [],
  /** Recent server news ("X destroyed the Clock Tower!"): [{ id, text }]. */
  feed: [],
  /** Your absorb streak as the server last counted it, and when (performance.now()). */
  streak: { count: 0, at: 0 },
  /** City -> how many of its things you've destroyed towards its next clear (the server's count). */
  rounds: {},
  /** When your Surge is ready again (performance.now() ms). */
  surgeReadyAt: 0,
  /** Active hatch animation: { eggId, pets }. */
  hatch: null,
  /** Keep hatching the egg you're standing at (the T button). Client-side only. */
  autoHatch: false,

  // --- Actions -----------------------------------------------------------------

  setProfile: (profile, session) => set((s) => ({ profile, session: session || s.session, profileLoaded: true })),
  patchProfile: (patch) => set((s) => ({ profile: { ...s.profile, ...patch } })),
  setNet: (patch) => set((s) => ({ net: { ...s.net, ...patch } })),
  setZone: (zone) => set({ zone }),
  setPlayable: () => set({ playable: true }),
  setSphinxStock: (sphinxStock) => set({ sphinxStock }),
  setLeaderboards: (leaderboards) => set({ leaderboards }),

  openPanel: (panel, panelData = null) => set({ panel, panelData }),
  closePanel: () => set({ panel: null, panelData: null }),
  togglePanel: (panel) => set((s) => (s.panel === panel ? { panel: null, panelData: null } : { panel, panelData: null })),

  showToast: (text) => set({ toast: { text, id: Date.now() + Math.random() } }),

  /** Queues a big announcement; `kind` picks its colours ('stage' | 'landmark' | 'ring' | 'tornado' | 'rebirth' | 'quest'). */
  pushBanner: (title, subtitle = '', kind = 'stage') => {
    const banner = { id: Date.now() + Math.random(), title, subtitle, kind }
    const { banner: showing, bannerQueue } = get()
    if (!showing) set({ banner })
    else if (bannerQueue.length < 4) set({ bannerQueue: [...bannerQueue, banner] })
  },
  nextBanner: () => {
    const [next = null, ...rest] = get().bannerQueue
    set({ banner: next, bannerQueue: rest })
  },
  pushFeed: (text) => set((s) => ({ feed: [...s.feed, { id: Date.now() + Math.random(), text }].slice(-MAX_FEED) })),
  dropFeed: (id) => set((s) => ({ feed: s.feed.filter((f) => f.id !== id) })),
  setStreak: (count) => set({ streak: { count, at: performance.now() } }),
  setRound: (stage, done) => set((s) => ({ rounds: { ...s.rounds, [stage]: done } })),
  resetRounds: () => set({ rounds: {} }),
  setSurgeReady: (surgeReadyAt) => set({ surgeReadyAt }),

  setHatch: (hatch) => set({ hatch }),
  setAutoHatch: (autoHatch) => set({ autoHatch }),
}))

/** Non-reactive snapshot for timers and non-React code. */
export const getGame = () => useGame.getState()
