/**
 * Player intents. The UI never changes game state itself: it calls one of these, the
 * authority (the Colyseus room, or the offline stand-in) validates it, and the result
 * comes back as an updated profile or an event. (What your tornado swallows is never an
 * intent: the authority works that out from where you are.)
 */

let transport = null

/** Installs the active connection: `{ send(type, payload) }`. */
export function setTransport(next) {
  transport = next
}

export function send(type, payload) {
  if (!transport) return
  transport.send(type, payload)
}

export const actions = {
  /** Your Surge: everything in reach at once (the authority checks the cooldown). */
  surge: () => send('surge'),
  /** To the lobby (-1) or into an open city by its gate. */
  teleport: (stage) => send('teleport', { stage }),
  rebirth: () => send('rebirth'),
  skipRebirth: () => send('skipRebirth'),
  /** Buys (or, if owned, equips) a tornado: from the Types menu or a lobby stand. */
  buyTornado: (id) => send('buyTornado', { id }),
  equipTornado: (id) => send('equipTornado', { id }),
  buyUpgrade: (id) => send('buyUpgrade', { id }),
  /** Buys level pack `index` (0-2: +1, +5, +20 levels) from under the level bar. */
  buyPack: (index) => send('buyPack', { index }),
  hatch: (eggId, count = 1) => send('hatch', { eggId, count }),
  openEggItem: (itemId) => send('openEggItem', { itemId }),
  equipPet: (uid) => send('equipPet', { uid }),
  unequipPet: (uid) => send('unequipPet', { uid }),
  equipBestPets: () => send('equipBest'),
  deletePet: (uid) => send('deletePet', { uid }),
  usePotion: (itemId) => send('usePotion', { itemId }),
  claimDaily: (day) => send('claimDaily', { day }),
  claimPlaytime: (index) => send('claimPlaytime', { index }),
  claimFreeReward: () => send('claimFreeReward'),
  /** Claims today's finished quest `index` (0-2), or the bonus chest once all three are. */
  claimQuest: (index) => send('claimQuest', { index }),
  claimQuestBonus: () => send('claimQuestBonus'),
  setSetting: (key, value) => send('setting', { key, value }),
  /** Buys a shop item with Wins; see shop.js. */
  purchase: (productId) => send('purchase', { productId }),
  /** A rewarded ad Boxity says was watched; the server verifies the token. */
  adReward: (placement, rewardToken) => send('adReward', { placement, rewardToken }),
  /** Asks the server to apply any Gems purchases Boxity has confirmed. */
  gemsCheck: () => send('gemsCheck'),
}
