import { schema, t } from '@colyseus/schema'

/**
 * Synced state, kept deliberately small: only what other players need to draw you.
 * Everything private (Power, Wins, inventory, items, boosts...) goes to its owner alone
 * as 'profile' / 'absorb' messages, never through the shared state: Power changes many
 * times a second while you absorb, and nobody else needs it (patches stay tiny, which
 * is what lets a pod hold many busy rooms).
 */
export const PlayerState = schema(
  {
    name: t.string(),
    /** Their verified Boxity account id ('' for guests), so chat can be matched to them. */
    uid: t.string(),
    x: t.float32(),
    y: t.float32(),
    z: t.float32(),
    rotY: t.float32(),
    /** 'idle' | 'walk' | 'run' (in a Storm Zone) | 'jump' | 'surge' (their Surge went off) | 'emote:<Boxity emote id>' */
    anim: t.string(),
    /** What their Bloxity avatar wears, as JSON `{ equipped, proportions }` ('' = base). */
    look: t.string(),
    /** Their tornado type (balance TORNADOES id) and its radius in metres: how others draw it. */
    tornado: t.string(),
    radius: t.float32(),
    /** Equipped pet species, at most 3. */
    petIds: t.array('string'),
    rebirths: t.uint16(),
    level: t.uint16(),
  },
  'PlayerState',
)

export const GameState = schema(
  {
    /** sessionId -> player */
    players: t.map(PlayerState),
    /** Short code for private lobbies ('' for public ones). */
    code: t.string(),
    isPrivate: t.boolean(),
  },
  'GameState',
)
