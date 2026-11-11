import { EGGS, PADS, RARITIES, SHOP, STAGES, TORNADOES } from '@shared/balance'
import { formatMultiplier, formatNumber } from '@shared/format'
import { isPadUnlocked } from '@shared/logic'
import { EGG_STANDS, FREE_REWARD, LOBBY, PAD_X, padCenterZ, TORNADO_STANDS } from '@shared/world'

import { eggHeight } from '../world/eggs'

/** Text styles, as gradients top-to-bottom. */
export const TEXT = {
  gold: ['#fffaa8', '#ffd52a', '#ff9c00'],
  green: ['#e6ffb0', '#8dff4f', '#2fd12f'],
  price: ['#d9ff9a', '#7dff4a', '#2fd12f'],
  white: ['#ffffff', '#ffffff', '#dfe7f0'],
  red: ['#ffb0a8', '#ff4a3b', '#d4142a'],
  blue: ['#e0faff', '#7fe2ff', '#2fa8ff'],
}

const tint = (hex) => ['#ffffff', hex, hex]

/** Each Storm Zone's colour (its ring and its sign). */
export const PAD_COLORS = ['#7fe2ff', '#5cff6a', '#ffd21f', '#ff8a3a', '#ff4a8a', '#b15cff', '#ffffff']

/** "x4 POWER / Gale Zone / LOCKED: 2 Rebirths", "x1 POWER / Breeze Zone / FREE"... */
export function padLabelSpec(index, unlocked) {
  const pad = PADS[index]
  const lines = [
    { text: `x${formatNumber(pad.mult)} POWER`, size: 54, icon: 'bolt', gradient: tint(PAD_COLORS[index]) },
    { text: pad.name, size: 34, fill: '#ffffff' },
  ]
  if (unlocked) {
    lines.push({ text: pad.rebirths === 0 && !pad.product ? 'FREE - STAND HERE!' : 'UNLOCKED', size: 40, gradient: TEXT.green })
  } else if (pad.product) {
    lines.push({ text: pad.tag, size: 44, rainbow: true })
    lines.push({ text: `${formatNumber(SHOP[pad.product].price)} Wins`, size: 40, icon: 'trophy', gradient: TEXT.gold })
  } else {
    const word = pad.rebirths === 1 ? 'Rebirth' : 'Rebirths'
    lines.push({ text: `LOCKED: ${pad.rebirths} ${word}`, size: 42, icon: 'rebirth', gradient: TEXT.red })
  }
  return { lines, pxPerUnit: 60 }
}

const padReserve = (index) => {
  const pad = PADS[index]
  const lines = [
    { text: `x${formatNumber(pad.mult)} POWER`, size: 54, icon: 'bolt' },
    { text: pad.name, size: 34 },
    { text: 'FREE - STAND HERE!', size: 42, icon: 'rebirth' },
  ]
  if (pad.product) lines.push({ text: `${formatNumber(SHOP[pad.product].price)} Wins`, size: 40, icon: 'trophy' })
  return { lines }
}

export function padLabels(profile) {
  return PADS.map((_, i) => ({
    id: `pad-${i}`,
    position: [PAD_X + 1, 5.2, padCenterZ(i)],
    spec: padLabelSpec(i, isPadUnlocked(profile, i)),
    reserve: padReserve(i),
    fade: 110,
  }))
}

/** A tornado stand's state: 'equipped' | 'owned' | 'buy' | 'locked'. */
export function standState(profile, index) {
  const t = TORNADOES[index]
  if (profile.equippedTornado === t.id) return 'equipped'
  if (profile.ownedTornadoes.includes(t.id)) return 'owned'
  const previous = TORNADOES[index - 1]
  return !previous || profile.ownedTornadoes.includes(previous.id) ? 'buy' : 'locked'
}

const rarityLine = (t) => {
  const rarity = RARITIES[t.rarity]
  return t.rarity === 'secret'
    ? { text: rarity.name.toUpperCase(), size: 34, rainbow: true }
    : { text: rarity.name.toUpperCase(), size: 32, gradient: tint(rarity.color) }
}

/** EQUIPPED / OWNED / CAN BUY! / LOCKED, the name, "x2.1 Power", and the price (or rarity once yours). */
export function standLabelSpec(index, state) {
  const t = TORNADOES[index]
  const tag =
    state === 'equipped'
      ? { text: 'EQUIPPED', size: 34, gradient: TEXT.green }
      : state === 'owned'
        ? { text: 'OWNED', size: 34, gradient: TEXT.blue }
        : state === 'buy'
          ? { text: 'CAN BUY!', size: 34, gradient: TEXT.green }
          : { text: 'LOCKED', size: 34, gradient: TEXT.red }
  const last =
    state === 'equipped' || state === 'owned'
      ? rarityLine(t)
      : { text: t.cost === 0 ? 'FREE' : `${formatNumber(t.cost)} Wins`, size: 38, icon: 'trophy', gradient: state === 'locked' ? TEXT.red : TEXT.price }
  return {
    lines: [tag, { text: t.name, size: 42, fill: '#ffffff' }, { text: `${formatMultiplier(t.power)} Power`, size: 38, icon: 'bolt', gradient: TEXT.gold }, last],
    pxPerUnit: 66,
  }
}

const standReserve = (index) => ({
  lines: [
    { text: 'CAN BUY!', size: 34 },
    { text: TORNADOES[index].name, size: 42 },
    { text: `${formatMultiplier(TORNADOES[index].power)} Power`, size: 38, icon: 'bolt' },
    { text: `${formatNumber(TORNADOES[index].cost)} Wins`, size: 38, icon: 'trophy' },
  ],
})

export function standLabels(profile) {
  return TORNADO_STANDS.map((stand) => ({
    id: `stand-${stand.index}`,
    position: [stand.x, 7.6 + stand.row * 1.4, stand.z],
    spec: standLabelSpec(stand.index, standState(profile, stand.index)),
    reserve: standReserve(stand.index),
    fade: 42,
  }))
}

export function eggLabels() {
  return EGG_STANDS.map((stand) => {
    const egg = EGGS[stand.eggId]
    const lines = [
      { text: `${egg.name} Egg`, size: stand.big ? 54 : 48, gradient: stand.big ? TEXT.red : TEXT.white },
      { text: `${formatNumber(egg.cost.wins)} Wins`, size: 44, icon: 'trophy', gradient: TEXT.gold },
    ]
    return {
      id: `egg-${stand.eggId}`,
      position: [stand.x, eggHeight(stand) + (stand.big ? 4 : 2.5), stand.z],
      spec: { lines, pxPerUnit: 62 },
      fade: 100,
    }
  })
}

const freeRewardLabel = () => ({
  id: 'free-reward',
  position: [FREE_REWARD.x, 4.6, FREE_REWARD.z],
  spec: { lines: [{ text: 'FREE REWARD', size: 50, gradient: ['#fff2b0', '#ffb347', '#ff6a1e'] }], pxPerUnit: 60 },
  fade: 90,
})

/** Over the lobby's gate: where the bridge goes. */
const gateLabel = () => ({
  id: 'lobby-gate',
  position: [0, 17.5, LOBBY.minZ + 1],
  spec: {
    lines: [
      { text: 'TO THE CITIES', size: 72, gradient: TEXT.gold },
      { text: `Stage 1: ${STAGES[0].name}`, size: 44, gradient: TEXT.white },
    ],
    pxPerUnit: 30,
  },
  fade: 200,
})

/** The showroom's and the Storm Zones' headings. */
const headings = () => [
  {
    id: 'shop-sign',
    position: [-35, 13.5, 40],
    spec: { lines: [{ text: 'TORNADO SHOP', size: 80, gradient: TEXT.blue }, { text: 'Stronger tornado = more Power!', size: 38, gradient: TEXT.white }], pxPerUnit: 34 },
    fade: 160,
  },
  {
    id: 'zones-sign',
    position: [PAD_X + 3, 12, 40],
    spec: { lines: [{ text: 'STORM ZONES', size: 76, gradient: TEXT.green }, { text: 'Stand inside to gain Power', size: 38, gradient: TEXT.white }], pxPerUnit: 34 },
    fade: 160,
  },
]

/** Every label in the lobby. */
export function lobbyLabels(profile) {
  return [...padLabels(profile), ...standLabels(profile), ...eggLabels(), freeRewardLabel(), gateLabel(), ...headings()]
}
