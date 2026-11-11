import { STYLE } from '../materials'

/**
 * What every kind of thing in the cities looks like, built from boxes in the toy-brick
 * style (materials.js draws the studs, windows and glow in the shader).
 *
 * A builder gets `put(x, base, z, w, h, d, color, style?, ry?, rz?, rx?)` - a box resting
 * on `base`, in the object's own frame (its pivot at the origin on the ground, facing
 * +Z) - and the kind (cities.js KINDS: `v` the variant, `c` its colours). The caller turns,
 * scales and moves every box into place, and keeps each object's boxes together so it
 * can be swallowed (hidden) on its own.
 *
 * Sizes follow balance SIZES' footprints: tiny ~1 m, small ~2-3 m, medium ~4-5 m, large
 * ~6 m, huge ~9 m across and 14-30 m tall; landmarks ~14 m across.
 */

const S = STYLE
const DARK = '#22252e'
const GLASS = '#9fd8ff'
const WHITE = '#f4f6fa'
const WOOD = '#8a5a32'

/** An octagonal column: a square box and the same box turned 45 degrees. */
function cyl(put, x, base, z, r, h, color, style = S.STUDS) {
  const w = r * 1.65
  put(x, base, z, w, h, w, color, style)
  put(x, base, z, w, h, w, color, style, Math.PI / 4)
}

/** A stepped cone or dome: `steps` boxes, each narrower. */
function cone(put, x, base, z, r, h, steps, color, style = S.STUDS, turn = 0) {
  const sh = h / steps
  for (let i = 0; i < steps; i += 1) {
    const w = r * 2 * (1 - i / steps)
    put(x, base + i * sh, z, w, sh, w, color, style, turn * i)
  }
}

/** A pitched roof over walls `w` x `d` topped at `wallH`: two tilted slabs and a stepped gable. */
function gable(put, w, d, wallH, rise, roof, fill, overhang = 0.35) {
  const half = w / 2
  const len = Math.hypot(half, rise) + overhang
  const angle = Math.atan2(rise, half)
  for (const side of [-1, 1]) {
    put((side * half) / 2, wallH + rise / 2 - 0.12, 0, len, 0.22, d + overhang * 2, roof, S.STUDS, 0, -side * angle)
  }
  for (let i = 0; i < 3; i += 1) put(0, wallH + (rise * i) / 3, 0, w * (1 - i / 3) - 0.1, rise / 3, d - 0.1, fill, S.SMOOTH)
}

/** A row of windows across the front (+Z) face. */
function frontWindows(put, w, d, y, count, h = 0.9, color = GLASS, style = S.SMOOTH) {
  const gap = w / count
  for (let i = 0; i < count; i += 1) put(-w / 2 + gap * (i + 0.5), y, d / 2, gap * 0.55, h, 0.12, color, style)
}

/** Four wheels for a vehicle `len` long and `wid` wide. */
function wheels(put, len, wid, r = 0.32, color = DARK) {
  for (const x of [-len * 0.32, len * 0.32]) for (const z of [-wid / 2, wid / 2]) put(z, 0, x, 0.3, r * 2, r * 2, color, S.SMOOTH)
}

// --- Tiny ------------------------------------------------------------------------------

const tiny = {
  bale(put, { v, c }) {
    if (v === 'round') {
      cyl(put, 0, 0, 0, 0.75, 1.1, c[0])
      put(0, 1.1, 0, 0.9, 0.08, 0.9, c[1], S.SMOOTH, Math.PI / 4)
      return
    }
    put(0, 0, 0, 1.5, 1, 1, c[0])
    for (const x of [-0.4, 0.4]) put(x, 0, 0, 0.08, 1.02, 1.04, c[1], S.SMOOTH)
  },
  pumpkin(put, { c }) {
    put(0, 0, 0, 1, 0.8, 1, c[0])
    put(0, 0, 0, 0.85, 0.82, 0.85, c[0], S.STUDS, Math.PI / 4)
    put(0, 0.8, 0, 0.16, 0.32, 0.16, c[1], S.SMOOTH)
  },
  fence(put, { c }) {
    for (const x of [-1.7, 1.7]) put(x, 0, 0, 0.18, 1.1, 0.18, c[1])
    for (const y of [0.35, 0.75]) put(0, y, 0, 3.6, 0.14, 0.1, c[0], S.SMOOTH)
  },
  mailbox(put, { c }) {
    put(0, 0, 0, 0.14, 1, 0.14, WOOD, S.SMOOTH)
    put(0, 1, 0, 0.42, 0.42, 0.7, c[0], S.SMOOTH)
    put(0.24, 1.15, 0.1, 0.05, 0.36, 0.1, c[1], S.SMOOTH)
  },
  hydrant(put, { c }) {
    cyl(put, 0, 0, 0, 0.25, 0.8, c[0], S.SMOOTH)
    put(0, 0.45, 0, 0.7, 0.16, 0.16, c[0], S.SMOOTH)
    cone(put, 0, 0.8, 0, 0.26, 0.25, 2, c[1], S.SMOOTH)
  },
  bush(put, { v, c }) {
    if (v === 'tumble') {
      put(0, 0, 0, 1, 1, 1, c[0], S.SMOOTH, 0.3)
      put(0, 0.1, 0, 0.8, 0.8, 0.8, c[1], S.SMOOTH, 1.1)
      return
    }
    if (v === 'fern') {
      for (let i = 0; i < 5; i += 1) put(Math.cos(i * 1.26) * 0.3, 0, Math.sin(i * 1.26) * 0.3, 0.25, 0.9 + (i % 2) * 0.3, 0.9, i % 2 ? c[1] : c[0], S.SMOOTH, i * 1.26)
      return
    }
    put(0, 0, 0, 1.3, 0.9, 1.1, c[0], v === 'cloud' ? S.SMOOTH : S.STUDS)
    put(0.15, 0.55, 0.1, 0.8, 0.6, 0.7, c[0], v === 'cloud' ? S.SMOOTH : S.STUDS)
    if (v === 'snow') put(0, 0.9, 0, 1.1, 0.15, 0.9, c[1], S.SMOOTH)
    if (v === 'ash') put(0.2, 0.9, 0, 0.25, 0.25, 0.25, c[1], S.GLOW)
    if (v === 'cloud') put(-0.4, 0.3, -0.2, 0.7, 0.6, 0.7, c[1], S.SMOOTH)
  },
  rock(put, { v, c }) {
    if (v === 'castle') {
      put(0, 0, 0, 1.4, 0.5, 1.4, c[0])
      put(0, 0.5, 0, 0.8, 0.6, 0.8, c[1])
      for (const [x, z] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) put(x, 0.5, z, 0.3, 0.55, 0.3, c[0])
      return
    }
    if (v === 'donut') {
      for (let i = 0; i < 4; i += 1) put(Math.cos(i * 1.57) * 0.5, 0, Math.sin(i * 1.57) * 0.5, 0.55, 0.45, 0.55, c[0], S.SMOOTH, i * 1.57)
      for (let i = 0; i < 4; i += 1) put(Math.cos(i * 1.57 + 0.78) * 0.5, 0.3, Math.sin(i * 1.57 + 0.78) * 0.5, 0.5, 0.2, 0.5, c[1], S.SMOOTH, i * 1.57)
      return
    }
    if (v === 'pipes') {
      for (let i = 0; i < 3; i += 1) put(0, i < 2 ? 0 : 0.42, -0.45 + i * 0.45 - (i === 2 ? 0.67 : 0), 1.8, 0.42, 0.42, i % 2 ? c[1] : c[0], S.SMOOTH)
      return
    }
    if (v === 'well') {
      cyl(put, 0, 0, 0, 0.7, 0.8, c[0])
      for (const x of [-0.6, 0.6]) put(x, 0.8, 0, 0.12, 1, 0.12, c[1], S.SMOOTH)
      put(0, 1.8, 0, 1.6, 0.16, 1.1, c[1], S.SMOOTH)
      return
    }
    const style = v === 'lava' || v === 'meteor' ? S.LAVA : S.STUDS
    put(0, 0, 0, 1.2, 0.8, 1, v === 'lava' || v === 'meteor' ? c[1] : c[0], style, 0.4)
    put(0.2, 0.45, -0.1, 0.7, 0.6, 0.6, c[0], S.STUDS, 1.1)
    if (v === 'geode') put(0, 0.55, 0.3, 0.45, 0.4, 0.2, c[1], S.GLOW)
    if (v === 'moon') put(-0.35, 0, 0.35, 0.5, 0.3, 0.5, c[1])
  },
  barrel(put, { v, c }) {
    cyl(put, 0, 0, 0, 0.42, 1.1, c[0], v === 'steel' ? S.PLATE : S.STUDS)
    if (v === 'buoy') {
      put(0, 1.1, 0, 0.5, 0.4, 0.5, c[1], S.SMOOTH)
      put(0, 1.5, 0, 0.12, 0.5, 0.12, c[0], S.SMOOTH)
      return
    }
    for (const y of [0.2, 0.85]) put(0, y, 0, 0.74, 0.08, 0.74, c[1], S.SMOOTH)
    if (v === 'trash') put(0, 1.1, 0, 0.8, 0.12, 0.8, c[1], S.SMOOTH)
  },
  crate(put, { v, c }) {
    if (v === 'container') {
      put(0, 0, 0, 2.4, 2.4, 5.6, c[0], S.PLATE)
      put(0, 0, 2.82, 2.3, 2.3, 0.06, c[1], S.PLATE)
      return
    }
    if (v === 'vending') {
      put(0, 0, 0, 1, 1.9, 0.8, c[0], S.SMOOTH)
      put(-0.12, 0.5, 0.41, 0.55, 1.2, 0.04, c[1], S.GLOW)
      return
    }
    if (v === 'generator') {
      put(0, 0, 0, 2, 1.3, 1.3, c[0], S.PLATE)
      put(0.5, 1.3, 0, 0.3, 0.6, 0.3, DARK, S.SMOOTH)
      put(-0.4, 0.4, 0.66, 0.7, 0.5, 0.04, c[1], S.GLOW)
      return
    }
    if (v === 'drone') {
      put(0, 1.2, 0, 0.6, 0.25, 0.6, c[0], S.SMOOTH)
      for (const [x, z] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]]) put(x, 1.38, z, 0.5, 0.05, 0.12, c[1], S.GLOW)
      put(0, 0, 0, 0.08, 1.2, 0.08, DARK, S.SMOOTH)
      return
    }
    if (v === 'ice') {
      put(0, 0, 0, 1.1, 1.1, 1.1, c[0], S.GLOW)
      return
    }
    put(0, 0, 0, 1.1, 1.1, 1.1, c[0], S.PLATE)
    put(0, 0, 0, 1.14, 0.12, 1.14, c[1], S.SMOOTH)
    put(0, 0.98, 0, 1.14, 0.12, 1.14, c[1], S.SMOOTH)
  },
  cone(put, { c }) {
    put(0, 0, 0, 0.7, 0.1, 0.7, c[0], S.SMOOTH)
    cone(put, 0, 0.1, 0, 0.3, 0.8, 3, c[0], S.SMOOTH)
    put(0, 0.42, 0, 0.42, 0.12, 0.42, c[1], S.SMOOTH)
  },
  lamp(put, { v, c }) {
    if (v === 'balloon') {
      put(0, 0, 0, 0.06, 1.8, 0.06, WHITE, S.SMOOTH)
      for (let i = 0; i < 3; i += 1) put(Math.cos(i * 2.1) * 0.3, 1.8 + i * 0.15, Math.sin(i * 2.1) * 0.3, 0.55, 0.65, 0.55, c[i % c.length], S.SMOOTH)
      return
    }
    if (v === 'torch') {
      put(0, 0, 0, 0.18, 1.5, 0.18, c[0])
      put(0, 1.5, 0, 0.35, 0.35, 0.35, c[1], S.GLOW)
      return
    }
    if (v === 'antenna') {
      put(0, 0, 0, 0.5, 0.2, 0.5, c[0], S.SMOOTH)
      put(0, 0.2, 0, 0.08, 2.4, 0.08, c[0], S.SMOOTH)
      put(0, 2.6, 0, 0.22, 0.22, 0.22, c[1], S.GLOW)
      return
    }
    if (v === 'traffic') {
      put(0, 0, 0, 0.16, 2.6, 0.16, c[0], S.SMOOTH)
      put(0, 2.4, 0.15, 0.4, 1, 0.3, c[0], S.SMOOTH)
      for (const [y, col] of [[3.1, '#ff3a3a'], [2.8, '#ffc21f'], [2.5, c[1]]]) put(0, y, 0.31, 0.2, 0.2, 0.04, col, S.GLOW)
      return
    }
    put(0, 0, 0, 0.16, 3, 0.16, c[0], S.SMOOTH)
    put(0, 3, 0.35, 0.16, 0.12, 0.8, c[0], S.SMOOTH)
    put(0, 2.85, 0.7, 0.4, 0.18, 0.4, c[1], S.GLOW)
  },
  bench(put, { c }) {
    put(0, 0.4, 0, 1.8, 0.12, 0.5, c[0], S.SMOOTH)
    put(0, 0.65, -0.24, 1.8, 0.4, 0.1, c[0], S.SMOOTH)
    for (const x of [-0.75, 0.75]) put(x, 0, 0, 0.12, 0.42, 0.5, c[1], S.SMOOTH)
  },
  sign(put, { v, c }) {
    if (v === 'surf') {
      put(0, 0, 0, 0.6, 2.2, 0.12, c[0], S.SMOOTH, 0, 0.12)
      put(0, 0.9, 0.07, 0.12, 1.2, 0.04, c[1], S.SMOOTH, 0, 0.12)
      return
    }
    if (v === 'kite') {
      put(0, 0, 0, 0.05, 2.6, 0.05, c[0], S.SMOOTH)
      put(0, 2.6, 0, 1, 1, 0.08, c[1], S.SMOOTH, 0, Math.PI / 4)
      return
    }
    if (v === 'flag') {
      put(0, 0, 0, 0.08, 2.4, 0.08, c[0], S.SMOOTH)
      put(0.55, 1.8, 0, 1, 0.6, 0.05, c[1], S.SMOOTH)
      return
    }
    if (v === 'solar') {
      put(0, 0, 0, 0.14, 0.9, 0.14, c[0], S.SMOOTH)
      put(0, 0.9, 0, 2.2, 0.08, 1.3, c[1], S.PLATE, 0, 0, -0.4)
      return
    }
    const glow = v === 'neon'
    put(0, 0, 0, 0.14, 1.6, 0.14, glow ? c[0] : WOOD, S.SMOOTH)
    put(0, 1.4, 0, 1.4, 0.7, 0.12, glow ? c[0] : c[0], S.SMOOTH)
    put(0, 1.5, 0.07, 1.1, 0.4, 0.04, c[1], glow ? S.GLOW : S.SMOOTH)
  },
  snowman(put, { c }) {
    put(0, 0, 0, 1.2, 1, 1.2, c[0], S.SMOOTH)
    put(0, 1, 0, 0.85, 0.75, 0.85, c[0], S.SMOOTH)
    put(0, 1.75, 0, 0.6, 0.55, 0.6, c[0], S.SMOOTH)
    put(0, 1.95, 0.42, 0.12, 0.12, 0.35, c[1], S.SMOOTH)
    put(0, 2.3, 0, 0.5, 0.45, 0.5, c[2], S.SMOOTH)
  },
  umbrella(put, { c }) {
    put(0, 0, 0, 0.08, 2.2, 0.08, WHITE, S.SMOOTH)
    put(0, 2.1, 0, 2.2, 0.14, 2.2, c[0], S.SMOOTH)
    put(0, 2.24, 0, 1.4, 0.14, 1.4, c[1], S.SMOOTH, Math.PI / 4)
  },
  chair(put, { c }) {
    put(0, 0.2, 0, 0.7, 0.1, 1.5, c[0], S.SMOOTH, 0, 0, 0.1)
    put(0, 0.3, -0.7, 0.7, 0.8, 0.1, c[0], S.SMOOTH, 0, 0, -0.4)
    for (const x of [-0.3, 0.3]) put(x, 0, 0, 0.08, 0.25, 1.2, c[1], S.SMOOTH)
  },
  gumdrop(put, { c }) {
    cone(put, 0, 0, 0, 0.6, 1, 3, c[0], S.SMOOTH)
    put(0, 0.95, 0, 0.3, 0.12, 0.3, c[1], S.SMOOTH)
  },
  candycane(put, { c }) {
    for (let i = 0; i < 6; i += 1) put(0, i * 0.3, 0, 0.25, 0.3, 0.25, i % 2 ? c[1] : c[0], S.SMOOTH)
    put(0.25, 1.8, 0, 0.75, 0.25, 0.25, c[1], S.SMOOTH)
    put(0.52, 1.5, 0, 0.25, 0.3, 0.25, c[0], S.SMOOTH)
  },
  crystal(put, { v, c }) {
    if (v === 'egg') {
      put(0, 0, 0, 0.8, 1.1, 0.8, c[0], S.GLOW)
      put(0, 0.3, 0, 0.95, 0.5, 0.95, c[1], S.SMOOTH)
      return
    }
    if (v === 'star') {
      put(0, 0.2, 0, 1, 1, 0.3, c[0], S.GLOW, 0, Math.PI / 4)
      put(0, 0.2, 0, 1, 1, 0.3, c[1], S.GLOW)
      return
    }
    put(0, 0, 0, 0.55, 1.5, 0.55, c[0], S.GLOW, 0.4, 0.15)
    put(0.35, 0, 0.15, 0.35, 0.9, 0.35, c[1], S.GLOW, 1, -0.25)
  },
  mushroom(put, { c }) {
    put(0, 0, 0, 0.25, 0.7, 0.25, c[0], S.SMOOTH)
    put(0, 0.7, 0, 0.9, 0.3, 0.9, c[1], S.GLOW)
    put(0.45, 0, 0.2, 0.15, 0.4, 0.15, c[0], S.SMOOTH)
    put(0.45, 0.4, 0.2, 0.45, 0.18, 0.45, c[1], S.GLOW)
  },
  orb(put, { c }) {
    put(0, 0, 0, 0.6, 0.4, 0.6, DARK, S.SMOOTH)
    put(0, 0.5, 0, 0.75, 0.75, 0.75, c[0], S.GLOW, 0.5)
    put(0, 0.5, 0, 0.6, 0.6, 0.6, c[1], S.GLOW, 1.2, 0.6)
  },
}

// --- Small -----------------------------------------------------------------------------

function tree(put, { v, c }) {
  switch (v) {
    case 'pine':
      put(0, 0, 0, 0.35, 0.9, 0.35, c[0])
      for (let i = 0; i < 4; i += 1) {
        const w = 2.2 - i * 0.5
        put(0, 0.8 + i * 0.8, 0, w, 0.85, w, c[1])
        if (c[2] === '#ffffff') put(0, 1.6 + i * 0.8, 0, w * 0.75, 0.1, w * 0.75, c[2], S.SMOOTH)
      }
      return
    case 'palm':
      for (let i = 0; i < 4; i += 1) put(i * 0.12, i * 1, 0, 0.32, 1.05, 0.32, i % 2 ? c[2] : c[0])
      for (let i = 0; i < 5; i += 1) {
        const a = (i / 5) * Math.PI * 2
        put(Math.cos(a) * 1.05 + 0.4, 3.9, Math.sin(a) * 1.05, 2.2, 0.14, 0.55, c[1], S.SMOOTH, -a)
        put(Math.cos(a) * 2.05 + 0.4, 3.55, Math.sin(a) * 2.05, 0.7, 0.14, 0.5, c[1], S.SMOOTH, -a)
      }
      return
    case 'cactus':
      put(0, 0, 0, 0.6, 2.4, 0.6, c[0])
      put(0.55, 0.9, 0, 0.55, 0.4, 0.4, c[0])
      put(0.75, 0.9, 0, 0.38, 1.1, 0.38, c[1])
      put(-0.55, 1.3, 0, 0.55, 0.4, 0.4, c[0])
      put(-0.75, 1.3, 0, 0.38, 0.8, 0.38, c[1])
      put(0, 2.4, 0, 0.3, 0.2, 0.3, c[2], S.SMOOTH)
      return
    case 'lolli':
      put(0, 0, 0, 0.16, 2, 0.16, c[0], S.SMOOTH)
      put(0, 1.9, 0, 1.6, 1.6, 0.35, c[1], S.SMOOTH)
      put(0, 2.15, 0, 1.1, 1.1, 0.4, c[2], S.SMOOTH, 0, Math.PI / 4)
      put(0, 2.45, 0, 0.5, 0.5, 0.45, c[0], S.SMOOTH)
      return
    case 'crystal':
      put(0, 0, 0, 0.3, 1.2, 0.3, c[0])
      put(0, 1, 0, 0.8, 2.2, 0.8, c[1], S.GLOW, 0.4, 0.12)
      put(0.55, 0.9, 0.2, 0.5, 1.4, 0.5, c[2], S.GLOW, 1, -0.3)
      put(-0.5, 0.9, -0.2, 0.45, 1.2, 0.45, c[1], S.GLOW, 0.2, 0.35)
      return
    case 'mushroom':
      put(0, 0, 0, 0.55, 1.8, 0.55, c[0], S.SMOOTH)
      put(0, 1.8, 0, 2.4, 0.6, 2.4, c[1], S.GLOW)
      put(0, 2.4, 0, 1.6, 0.4, 1.6, c[1], S.GLOW)
      for (const [x, z] of [[0.7, 0.4], [-0.6, -0.5], [0.1, 0.9]]) put(x, 2.42, z, 0.35, 0.12, 0.35, c[2], S.GLOW)
      return
    case 'dead':
      put(0, 0, 0, 0.35, 2.4, 0.35, c[0])
      put(0.4, 1.4, 0, 0.9, 0.18, 0.18, c[0], S.STUDS, 0, 0.5)
      put(-0.35, 1.9, 0.1, 0.8, 0.16, 0.16, c[0], S.STUDS, 0.4, -0.6)
      put(0, 0, 0, 0.5, 0.25, 0.5, c[1], S.LAVA)
      return
    case 'cloud':
      put(0, 0, 0, 0.28, 1.6, 0.28, c[0], S.SMOOTH)
      put(0, 1.4, 0, 1.8, 1, 1.4, c[1], S.SMOOTH)
      put(0.5, 1.9, 0.2, 1.2, 0.9, 1.1, c[1], S.SMOOTH)
      put(-0.6, 1.7, -0.3, 1, 0.8, 1, c[2], S.SMOOTH)
      return
    default:
      put(0, 0, 0, 0.4, 1.6, 0.4, c[0])
      put(0, 1.3, 0, 2.1, 1.5, 2.1, c[1])
      put(0.1, 2.6, -0.1, 1.4, 1, 1.4, c[1])
      if (c[2]) for (const [x, y, z] of [[0.9, 1.8, 0.6], [-0.7, 2.2, 0.9], [0.4, 2.9, -0.7]]) put(x, y, z, 0.28, 0.28, 0.28, c[2], S.SMOOTH)
  }
}

function car(put, { v, c }) {
  const body = c[0]
  const trim = c[1]
  const glass = c[2] ?? GLASS
  switch (v) {
    case 'van':
      put(0, 0.3, 0, 1.8, 1.6, 3.6, body, S.SMOOTH)
      put(0, 1.2, 1.25, 1.84, 0.55, 0.9, glass, S.SMOOTH)
      wheels(put, 3.6, 1.8)
      return
    case 'pickup':
      put(0, 0.3, 0, 1.8, 0.75, 4, body, S.SMOOTH)
      put(0, 1.05, 0.55, 1.7, 0.7, 1.5, body, S.SMOOTH)
      put(0, 1.15, 0.6, 1.74, 0.45, 1.4, glass, S.SMOOTH)
      for (const x of [-0.85, 0.85]) put(x, 1.05, -1.1, 0.1, 0.4, 1.7, body, S.SMOOTH)
      wheels(put, 4, 1.8)
      return
    case 'jeep':
    case 'buggy':
      put(0, 0.35, 0, 1.8, 0.7, 3.2, body, S.SMOOTH)
      for (const x of [-0.8, 0.8]) put(x, 1.05, -0.2, 0.12, 0.9, 0.12, trim, S.SMOOTH)
      put(0, 1.9, -0.2, 1.72, 0.12, 0.12, trim, S.SMOOTH)
      put(0, 1.05, 0.9, 1.6, 0.5, 0.08, glass, S.SMOOTH)
      wheels(put, 3.2, 1.9, v === 'buggy' ? 0.45 : 0.36, trim)
      return
    case 'sports':
      put(0, 0.25, 0, 1.8, 0.55, 3.8, body, S.SMOOTH)
      put(0, 0.8, -0.2, 1.4, 0.45, 1.5, glass, S.SMOOTH)
      put(0, 1.05, -1.75, 1.7, 0.1, 0.4, trim, S.SMOOTH)
      put(0, 0.3, 1.9, 1.5, 0.12, 0.05, glass, S.GLOW)
      wheels(put, 3.8, 1.85, 0.3, trim)
      return
    case 'cart':
      put(0, 0.6, 0, 1.6, 0.6, 2.2, body, S.STUDS)
      put(0, 1.2, 0, 1.4, 0.35, 2, c[2], S.STUDS)
      for (const x of [-0.85, 0.85]) put(x, 0, -0.2, 0.15, 1.1, 1.1, trim, S.SMOOTH)
      for (const x of [-0.45, 0.45]) put(x, 0.7, 1.6, 0.1, 0.1, 1.4, trim, S.SMOOTH)
      return
    case 'mine':
      put(0, 0.3, 0, 1.4, 0.9, 2, body, S.PLATE)
      put(0, 1.05, 0, 1.2, 0.35, 1.8, c[1], S.GLOW)
      wheels(put, 2, 1.4, 0.25, DARK)
      return
    case 'rover':
      put(0, 0.6, 0, 1.8, 0.4, 2.8, body, S.PLATE)
      put(0, 1, 0.5, 1.2, 0.6, 1, glass, S.SMOOTH)
      put(0.6, 1, -0.9, 0.08, 1.2, 0.08, trim, S.SMOOTH)
      put(-0.3, 1, -0.8, 1, 0.08, 0.8, c[2], S.GLOW)
      for (const z of [-1, 0, 1]) for (const x of [-1, 1]) put(x, 0, z, 0.3, 0.6, 0.6, DARK, S.SMOOTH)
      return
    case 'hover':
      put(0, 0.7, 0, 1.8, 0.55, 3.4, body, S.SMOOTH)
      put(0, 1.25, -0.1, 1.4, 0.5, 1.6, trim, S.SMOOTH)
      put(0, 0.5, 0, 1.6, 0.18, 3, glass, S.GLOW)
      put(0, 0.85, 1.71, 1.4, 0.15, 0.05, glass, S.GLOW)
      return
    case 'sled':
      put(0, 0.4, 0, 1.2, 0.6, 2.6, body, S.SMOOTH)
      put(0, 1, -0.4, 0.8, 0.4, 0.8, DARK, S.SMOOTH)
      put(0, 1, 0.8, 0.8, 0.4, 0.1, glass, S.SMOOTH)
      for (const x of [-0.6, 0.6]) put(x, 0, 0, 0.12, 0.12, 3, trim, S.SMOOTH)
      return
    case 'forklift':
      put(0, 0.3, -0.3, 1.4, 1, 1.8, body, S.SMOOTH)
      put(0, 1.3, -0.5, 1.2, 1, 0.1, DARK, S.SMOOTH)
      for (const x of [-0.5, 0.5]) put(x, 0, 0.75, 0.12, 2.6, 0.12, DARK, S.SMOOTH)
      for (const x of [-0.35, 0.35]) put(x, 0.15, 1.3, 0.15, 0.08, 1.1, DARK, S.SMOOTH)
      wheels(put, 1.8, 1.4, 0.3, trim)
      return
    default: {
      // Sedan (and taxi).
      put(0, 0.3, 0, 1.8, 0.7, 3.6, body, S.SMOOTH)
      put(0, 1, -0.15, 1.6, 0.6, 1.9, body, S.SMOOTH)
      put(0, 1.08, -0.15, 1.64, 0.4, 1.8, glass, S.SMOOTH)
      put(0, 0.45, 1.8, 1.4, 0.15, 0.05, '#fff6c8', S.GLOW)
      if (v === 'taxi') {
        put(0, 1.6, -0.15, 0.7, 0.28, 0.35, WHITE, S.SMOOTH)
        put(0, 0.55, 0, 1.84, 0.14, 3.2, DARK, S.SMOOTH)
      }
      wheels(put, 3.6, 1.85, 0.32, trim)
    }
  }
}

function scarecrow(put, { c }) {
  put(0, 0, 0, 0.2, 2.3, 0.2, WOOD)
  put(0, 1.6, 0, 2, 0.16, 0.16, WOOD)
  put(0, 1.05, 0, 0.8, 0.8, 0.45, c[1])
  for (const x of [-0.75, 0.75]) put(x, 1.35, 0, 0.5, 0.35, 0.35, c[1], S.SMOOTH)
  put(0, 1.85, 0, 0.55, 0.55, 0.55, c[2])
  put(0, 2.35, 0, 0.9, 0.1, 0.9, c[0], S.SMOOTH)
  put(0, 2.45, 0, 0.5, 0.35, 0.5, c[0], S.SMOOTH)
}

function cow(put, { c }) {
  put(0, 0.6, 0, 0.85, 0.8, 1.7, c[0], S.SMOOTH)
  for (const [x, z] of [[-0.3, -0.6], [0.3, -0.6], [-0.3, 0.6], [0.3, 0.6]]) put(x, 0, z, 0.22, 0.62, 0.22, c[0], S.SMOOTH)
  for (const [x, y, z] of [[0.44, 0.8, 0.2], [-0.44, 1, -0.3], [0.1, 1.41, -0.4]]) put(x, y, z, 0.05, 0.35, 0.5, c[1], S.SMOOTH)
  put(0, 1, 1.05, 0.55, 0.5, 0.55, c[0], S.SMOOTH)
  put(0, 0.95, 1.34, 0.4, 0.22, 0.08, c[2], S.SMOOTH)
  for (const x of [-0.22, 0.22]) put(x, 1.5, 1, 0.08, 0.2, 0.08, WHITE, S.SMOOTH)
}

function statue(put, { v, c }) {
  switch (v) {
    case 'teacup':
      put(0, 0, 0, 2.4, 0.3, 2.4, c[1], S.SMOOTH, Math.PI / 4)
      cyl(put, 0, 0.3, 0, 0.9, 1, c[0], S.SMOOTH)
      put(1.05, 0.55, 0, 0.3, 0.5, 0.15, c[0], S.SMOOTH)
      put(0, 1.3, 0, 1.3, 0.12, 1.3, c[2], S.SMOOTH)
      return
    case 'cupcake':
      cone(put, 0, 0, 0, 0.8, 0.9, 2, c[0], S.STUDS)
      put(0, 0.9, 0, 1.6, 0.5, 1.6, c[1], S.SMOOTH)
      put(0, 1.4, 0, 1.1, 0.45, 1.1, c[1], S.SMOOTH, Math.PI / 4)
      put(0, 1.85, 0, 0.4, 0.4, 0.4, c[2], S.SMOOTH)
      return
    case 'knight':
      put(0, 0, 0, 1.3, 0.6, 1.3, '#8a8e9a')
      put(0, 0.6, 0, 0.7, 1.2, 0.45, c[0], S.PLATE)
      put(0, 1.8, 0, 0.5, 0.5, 0.5, c[0], S.PLATE)
      put(0, 2.3, 0, 0.12, 0.4, 0.4, c[1], S.SMOOTH)
      put(0.5, 0.8, 0.15, 0.12, 0.9, 0.7, c[2], S.SMOOTH)
      put(-0.5, 0.6, 0.2, 0.1, 1.8, 0.1, '#d8dce4', S.SMOOTH)
      return
    case 'arcade':
      put(0, 0, 0, 1, 2, 0.9, c[0], S.SMOOTH)
      put(0, 1.15, 0.46, 0.75, 0.55, 0.04, c[1], S.GLOW)
      put(0, 0.85, 0.5, 0.8, 0.2, 0.3, c[2], S.SMOOTH)
      put(0, 1.85, 0.46, 0.8, 0.2, 0.04, c[2], S.GLOW)
      return
    case 'idol':
      put(0, 0, 0, 1.1, 1.8, 1, c[0])
      for (const x of [-0.25, 0.25]) put(x, 1.2, 0.5, 0.22, 0.16, 0.06, c[1], S.GLOW)
      put(0, 0.6, 0.5, 0.6, 0.18, 0.06, c[1], S.GLOW)
      put(0, 1.8, 0, 1.3, 0.3, 1.2, c[2])
      return
    case 'crystal':
      put(0, 0, 0, 1, 0.5, 1, '#5a4a7a')
      put(0, 0.5, 0, 0.8, 2, 0.8, c[0], S.GLOW, 0.4)
      put(0, 1.3, 0, 0.5, 1.6, 0.5, c[1], S.GLOW, 1.2, 0.2)
      return
    case 'robot':
      put(0, 0, 0, 0.9, 0.9, 0.6, c[2], S.PLATE)
      put(0, 0.9, 0, 1.1, 0.9, 0.7, c[0], S.PLATE)
      put(0, 1.8, 0, 0.7, 0.55, 0.6, c[0], S.SMOOTH)
      put(0, 1.95, 0.31, 0.5, 0.15, 0.04, c[1], S.GLOW)
      for (const x of [-0.7, 0.7]) put(x, 0.8, 0, 0.25, 1, 0.25, c[2], S.SMOOTH)
      put(0, 2.35, 0, 0.06, 0.4, 0.06, c[1], S.GLOW)
      return
    case 'satellite':
      put(0, 0, 0, 0.8, 0.4, 0.8, c[1], S.PLATE)
      put(0, 0.4, 0, 0.2, 1.2, 0.2, c[1], S.SMOOTH)
      put(0, 1.5, 0, 2, 0.15, 2, c[0], S.SMOOTH, 0, 0, -0.6)
      put(0, 1.6, 0.6, 0.15, 0.15, 0.6, c[2], S.GLOW, 0, 0, -0.6)
      return
    case 'balloon':
      put(0, 0, 0, 1.1, 0.8, 1.1, c[2])
      for (const [x, z] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]]) put(x, 0.8, z, 0.05, 1.3, 0.05, DARK, S.SMOOTH)
      put(0, 2, 0, 2.2, 1, 2.2, c[0], S.SMOOTH)
      put(0, 3, 0, 2.6, 1.4, 2.6, c[1], S.STRIPES)
      put(0, 4.4, 0, 2, 0.8, 2, c[0], S.SMOOTH)
      return
    case 'planet':
      put(0, 0, 0, 0.8, 0.8, 0.8, DARK, S.SMOOTH)
      put(0, 0.8, 0, 1.6, 1.6, 1.6, c[0], S.STUDS, 0.5)
      put(0, 0.95, 0, 1.4, 1.3, 1.4, c[0], S.STUDS, 1.3)
      put(0, 1.5, 0, 2.8, 0.08, 2.8, c[1], S.GLOW, 0.3, 0.3)
      return
    case 'totem':
      for (let i = 0; i < 4; i += 1) {
        put(0, i * 0.85, 0, 0.9, 0.85, 0.9, c[i % 3])
        put(0, i * 0.85 + 0.4, 0.46, 0.5, 0.15, 0.05, DARK, S.SMOOTH)
      }
      put(0, 2.8, 0, 2, 0.3, 0.4, c[1])
      return
    case 'alien':
      put(0, 0, 0, 1, 0.4, 1, c[1], S.SMOOTH)
      put(0, 0.4, 0, 0.5, 1.2, 0.4, c[0], S.SMOOTH)
      put(0, 1.6, 0, 0.9, 0.8, 0.8, c[0], S.SMOOTH)
      for (const x of [-0.22, 0.22]) put(x, 1.9, 0.41, 0.28, 0.32, 0.04, c[1], S.SMOOTH)
      for (const x of [-0.3, 0.3]) put(x, 2.4, 0, 0.06, 0.5, 0.06, c[0], S.SMOOTH)
      return
    default:
      put(0, 0, 0, 1, 0.5, 1, '#8a8e9a')
      put(0, 0.5, 0, 0.6, 1.6, 0.6, c[0])
  }
}

function stall(put, { c }) {
  put(0, 0.4, 0, 2.2, 1, 1.3, c[1], S.SMOOTH)
  put(0, 1.4, 0, 2.1, 0.3, 1.2, c[2], S.SMOOTH)
  for (const x of [-1, 1]) put(x, 1.4, 0, 0.08, 1.2, 0.08, WHITE, S.SMOOTH)
  put(0, 2.55, 0, 2.6, 0.2, 1.7, c[0], S.STRIPES)
  for (const x of [-0.9, 0.9]) put(x, 0, 0, 0.12, 0.55, 0.55, DARK, S.SMOOTH)
}

// --- Medium ----------------------------------------------------------------------------

function truck(put, { v, c }) {
  const body = c[0]
  const trim = c[1]
  const glass = c[2] ?? GLASS
  switch (v) {
    case 'bus':
      put(0, 0.35, 0, 2.2, 2.3, 7, body, S.SMOOTH)
      put(0, 1.5, 0, 2.24, 0.75, 6.4, glass, S.SMOOTH)
      put(0, 0.35, 0, 2.26, 0.35, 7.04, trim, S.SMOOTH)
      put(0, 2.65, 0, 2, 0.15, 6.6, body, S.SMOOTH)
      wheels(put, 7, 2.25, 0.42)
      return
    case 'hoverbus':
      put(0, 0.9, 0, 2.2, 2, 7, body, S.SMOOTH)
      put(0, 1.8, 0, 2.24, 0.6, 6.4, trim, S.GLOW)
      put(0, 0.7, 0, 1.9, 0.2, 6.6, trim, S.GLOW)
      return
    case 'limo':
      put(0, 0.3, 0, 1.9, 0.75, 6.4, body, S.SMOOTH)
      put(0, 1.05, -0.2, 1.7, 0.6, 4.6, body, S.SMOOTH)
      put(0, 1.12, -0.2, 1.74, 0.35, 4.4, glass, S.GLOW)
      put(0, 0.5, 3.2, 1.5, 0.12, 0.05, trim, S.GLOW)
      wheels(put, 6.4, 1.95, 0.34)
      return
    case 'tractor':
      put(0, 0.5, 0.6, 1.3, 1, 2.2, body, S.SMOOTH)
      put(0, 1.5, -0.4, 1.4, 1.3, 1.3, glass, S.SMOOTH)
      put(0, 2.8, -0.4, 1.6, 0.15, 1.5, body, S.SMOOTH)
      put(0.4, 1.5, 1.2, 0.18, 1, 0.18, DARK, S.SMOOTH)
      for (const x of [-0.95, 0.95]) {
        put(x, 0, -0.6, 0.45, 1.6, 1.6, c[2], S.SMOOTH)
        put(x * 0.8, 0, 1.3, 0.35, 0.8, 0.8, c[2], S.SMOOTH)
        put(x * 1.02, 0.55, -0.6, 0.06, 0.5, 0.5, trim, S.SMOOTH)
      }
      return
    case 'tanker':
      put(0, 0.35, 2.4, 2, 1.9, 1.7, trim, S.SMOOTH)
      put(0, 1.3, 2.8, 2.04, 0.6, 0.9, GLASS, S.SMOOTH)
      cylAlong(put, 0, 0.7, -0.6, 1.05, 4.8, body)
      put(0, 1.25, -0.6, 2.25, 0.3, 4.6, trim, S.SMOOTH)
      wheels(put, 6.8, 2.05, 0.4, c[2])
      return
    case 'dump':
      put(0, 0.4, 2.2, 2, 1.9, 1.6, body, S.SMOOTH)
      put(0, 1.3, 2.6, 2.04, 0.6, 0.8, glass, S.SMOOTH)
      put(0, 1, -0.8, 2.3, 1.2, 3.8, body, S.PLATE, 0, 0, -0.18)
      wheels(put, 6.2, 2.1, 0.5, trim)
      return
    case 'boat':
      put(0, 0, 0, 2.2, 0.9, 5, body, S.SMOOTH)
      put(0, 0, 2.6, 1.5, 0.9, 1.3, body, S.SMOOTH, Math.PI / 4)
      put(0, 0.9, -0.6, 1.6, 1, 2, trim, S.SMOOTH)
      put(0, 1.4, 0.45, 1.6, 0.5, 0.08, glass, S.SMOOTH)
      put(0, 0, 0, 2.24, 0.25, 4.6, '#ffffff', S.SMOOTH)
      return
    case 'wagon':
      put(0, 0.7, 0, 2, 0.8, 3.4, body)
      for (let i = 0; i < 3; i += 1) put(0, 1.5 + (i === 1 ? 0.25 : 0), -1.1 + i * 1.1, 2.1, 1.2 - (i === 1 ? 0 : 0.2), 1, trim, S.SMOOTH)
      for (const z of [-1, 1]) for (const x of [-1.05, 1.05]) put(x, 0, z, 0.15, 1.1, 1.1, c[2], S.SMOOTH)
      return
    case 'drill':
      put(0, 0.4, -0.5, 2, 1.4, 2.8, body, S.PLATE)
      cone(put, 0, 0.6, 1.4, 0.8, 1.6, 4, trim, S.PLATE)
      put(0, 0.9, 1.1, 1.8, 0.4, 0.4, c[2], S.GLOW)
      wheels(put, 3, 2.05, 0.4, DARK)
      return
    case 'lander':
      put(0, 1.2, 0, 2.2, 1.2, 2.2, body, S.PLATE, Math.PI / 4)
      put(0, 2.4, 0, 1.5, 1, 1.5, trim, S.SMOOTH)
      put(0, 2.8, 0.76, 0.6, 0.4, 0.05, GLASS, S.GLOW)
      for (let i = 0; i < 4; i += 1) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4
        put(Math.cos(a) * 1.4, 0, Math.sin(a) * 1.4, 0.15, 1.4, 0.15, c[2], S.SMOOTH, 0, 0, Math.cos(a) * 0.3)
        put(Math.cos(a) * 1.6, 0, Math.sin(a) * 1.6, 0.5, 0.1, 0.5, c[2], S.SMOOTH)
      }
      return
    case 'blimp':
      put(0, 3.2, 0, 2.4, 2.2, 6, body, S.SMOOTH)
      put(0, 3.4, 0, 1.9, 1.6, 7, body, S.SMOOTH)
      put(0, 3.2, 0, 2.5, 0.4, 5.4, trim, S.SMOOTH)
      put(0, 2.5, 0.5, 0.9, 0.7, 1.8, c[2], S.SMOOTH)
      put(0, 3.6, -3.4, 0.1, 1.6, 1, trim, S.SMOOTH)
      put(0, 3.4, -3.4, 2, 0.1, 1, trim, S.SMOOTH)
      put(0, 0, 0, 0.06, 2.6, 0.06, DARK, S.SMOOTH)
      return
    case 'ufo':
      put(0, 1.3, 0, 3.8, 0.45, 3.8, body, S.PLATE)
      put(0, 1.3, 0, 3.8, 0.45, 3.8, body, S.PLATE, Math.PI / 4)
      put(0, 1.75, 0, 1.8, 0.8, 1.8, trim, S.GLOW, Math.PI / 4)
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * Math.PI * 2
        put(Math.cos(a) * 2.1, 1.35, Math.sin(a) * 2.1, 0.3, 0.3, 0.3, c[2], S.GLOW)
      }
      put(0, 0, 0, 1.2, 1.3, 1.2, c[2], S.GLOW)
      return
    case 'ship':
      put(0, 1, 0, 1.6, 1.2, 5, body, S.SMOOTH)
      put(0, 1.3, 2.6, 1.1, 0.8, 1.2, body, S.SMOOTH)
      put(0, 1.8, 1.4, 1, 0.5, 1.4, trim, S.GLOW)
      put(0, 1.1, -0.6, 5.2, 0.2, 1.8, body, S.SMOOTH)
      for (const x of [-0.5, 0.5]) put(x, 1.1, -2.6, 0.5, 0.5, 0.3, c[2], S.GLOW)
      put(0, 0, 0, 0.4, 1, 0.4, DARK, S.SMOOTH)
      return
    case 'raft':
      for (let i = 0; i < 5; i += 1) put(-1 + i * 0.5, 0, 0, 0.45, 0.45, 3.6, i % 2 ? c[2] : body)
      put(0, 0.45, 0, 0.12, 2.6, 0.12, c[2], S.SMOOTH)
      put(0, 1.2, 0.05, 1.8, 1.6, 0.06, trim, S.SMOOTH)
      return
    default: {
      // Box truck (snowplow, ice-cream and food trucks).
      put(0, 0.4, 2.3, 2.1, 1.9, 1.6, body, S.SMOOTH)
      put(0, 1.35, 2.7, 2.14, 0.65, 0.85, glass, S.SMOOTH)
      put(0, 0.5, -0.6, 2.3, 2.5, 4.2, body, S.SMOOTH)
      put(0, 1.2, -0.6, 2.34, 0.6, 3.6, trim, S.SMOOTH)
      wheels(put, 6.2, 2.15, 0.42)
    }
  }
}

/** A cylinder lying along Z (a tank). */
function cylAlong(put, x, base, z, r, len, color) {
  put(x, base, z, r * 1.65, r * 1.65, len, color, S.SMOOTH)
  put(x, base + r * 0.82 - r * 0.82, z, r * 1.65, r * 1.65, len, color, S.SMOOTH, 0, Math.PI / 4)
}

function shed(put, { v, c }) {
  switch (v) {
    case 'garage':
      put(0, 0, 0, 4, 2.8, 4.4, c[0])
      put(0, 0, 2.2, 3, 2.2, 0.08, c[1], S.PLATE)
      put(0, 2.8, 0, 4.3, 0.2, 4.7, c[2], S.SMOOTH)
      return
    case 'kiosk':
      put(0, 0, 0, 2.6, 2.4, 2.2, c[0])
      put(0, 1, 1.1, 2, 0.8, 0.08, GLASS, S.SMOOTH)
      put(0, 2.2, 1.4, 2.9, 0.15, 1, c[1], S.STRIPES, 0, 0, 0)
      put(0, 2.4, 0, 2.8, 0.3, 2.4, c[2], S.SMOOTH)
      return
    case 'tent':
      for (const side of [-1, 1]) put(side * 1.05, 1.15, 0, 2.6, 0.15, 4, side < 0 ? c[0] : c[1], S.SMOOTH, 0, side * 0.95)
      put(0, 0, 2.05, 0.15, 2.4, 0.15, c[2], S.SMOOTH)
      put(0, 0, -2.05, 0.15, 2.4, 0.15, c[2], S.SMOOTH)
      return
    case 'igloo':
      cone(put, 0, 0, 0, 1.9, 2.4, 4, c[0], S.SMOOTH)
      put(0, 0, 2.1, 1.3, 1.3, 1.4, c[1], S.SMOOTH)
      put(0, 0, 2.81, 0.8, 1, 0.05, c[2], S.SMOOTH)
      return
    case 'hut':
      cyl(put, 0, 0, 0, 1.5, 2, c[1])
      cone(put, 0, 2, 0, 2.2, 1.8, 4, c[0], S.STUDS, 0.3)
      put(0, 0, 1.3, 0.8, 1.4, 0.06, DARK, S.SMOOTH)
      if (c[2]) put(0, 1.3, 1.31, 0.3, 0.3, 0.05, c[2], S.GLOW)
      return
    case 'dome':
      cyl(put, 0, 0, 0, 1.9, 0.8, c[0], S.PLATE)
      cone(put, 0, 0.8, 0, 1.8, 1.8, 4, c[1], S.GLOW)
      put(0, 0, 1.6, 0.9, 1.4, 0.4, c[0], S.SMOOTH)
      put(0, 2.6, 0, 0.3, 0.3, 0.3, c[2], S.GLOW)
      return
    case 'carousel':
      cyl(put, 0, 0, 0, 2.2, 0.35, c[1], S.SMOOTH)
      put(0, 0.35, 0, 0.35, 2.4, 0.35, c[2], S.STRIPES)
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2
        put(Math.cos(a) * 1.6, 0.35, Math.sin(a) * 1.6, 0.06, 2.4, 0.06, c[2], S.SMOOTH)
        put(Math.cos(a) * 1.6, 1, Math.sin(a) * 1.6, 0.35, 0.6, 0.9, i % 2 ? c[0] : WHITE, S.SMOOTH, -a)
      }
      cone(put, 0, 2.75, 0, 2.5, 1.3, 3, c[0], S.STRIPES)
      return
    case 'pod':
      put(0, 0, 0, 2.6, 1.8, 3.4, c[0], S.SMOOTH)
      put(0, 0.2, 0, 2.2, 2.2, 3, c[0], S.SMOOTH)
      put(0, 1, 1.52, 1.6, 0.8, 0.06, c[1], S.GLOW)
      put(0, 0.05, 0, 2.7, 0.15, 3.5, c[2], S.SMOOTH)
      return
    default:
      // A garden shed (and the gingerbread hut).
      put(0, 0, 0, 3, 2.2, 2.6, c[0])
      gable(put, 3, 2.6, 2.2, 1.1, c[2] ?? c[1], c[0])
      put(0, 0, 1.31, 1, 1.6, 0.06, c[1], S.SMOOTH)
      for (const x of [-0.95, 0.95]) put(x, 1.1, 1.31, 0.6, 0.55, 0.05, GLASS, S.SMOOTH)
  }
}

// --- Large -----------------------------------------------------------------------------

function house(put, { v, c }) {
  const wall = c[0]
  const roof = c[1]
  const accent = c[2] ?? WHITE
  switch (v) {
    case 'twostory':
      put(0, 0, 0, 5.4, 5.2, 4.6, wall)
      gable(put, 5.4, 4.6, 5.2, 1.8, roof, wall)
      frontWindows(put, 5.4, 4.6, 1.1, 3)
      frontWindows(put, 5.4, 4.6, 3.4, 3)
      put(0, 0, 2.31, 1, 1.9, 0.08, WOOD, S.SMOOTH)
      put(1.8, 5.6, -0.6, 0.6, 1.6, 0.6, '#a8582f')
      return
    case 'cabin':
      for (let i = 0; i < 6; i += 1) put(0, i * 0.5, 0, 5 + (i % 2) * 0.2, 0.5, 4.2 + ((i + 1) % 2) * 0.2, i % 2 ? '#7a4a22' : wall)
      gable(put, 5, 4.2, 3, 2.2, roof, wall, 0.5)
      put(0, 0, 2.15, 1, 1.9, 0.08, '#5a3a22', S.SMOOTH)
      for (const x of [-1.6, 1.6]) put(x, 1.2, 2.15, 0.9, 0.8, 0.06, accent, S.GLOW)
      put(-1.6, 4.4, 0, 0.7, 1.6, 0.7, '#8a8e9a')
      return
    case 'adobe':
      put(0, 0, 0, 5.4, 3, 4.6, wall)
      put(-0.8, 3, -0.4, 3, 2, 3, wall)
      for (let i = 0; i < 4; i += 1) put(-2 + i * 1.3, 2.6, 2.4, 0.2, 0.2, 0.6, c[1], S.SMOOTH)
      for (let i = 0; i < 3; i += 1) put(-2.1 + i * 0.95, 4.6, 1.15, 0.2, 0.2, 0.5, c[1], S.SMOOTH)
      put(1.2, 0, 2.31, 1, 1.9, 0.08, '#5a3a22', S.SMOOTH)
      put(-1.2, 1.2, 2.31, 0.9, 0.9, 0.06, c[2], S.SMOOTH)
      put(0, 3, 0, 5.6, 0.25, 4.8, c[1], S.SMOOTH)
      return
    case 'cottage':
      put(0, 0, 0, 5, 3, 4.2, wall)
      for (const x of [-2.4, -0.8, 0.8, 2.4]) put(x, 0, 2.11, 0.18, 3, 0.06, accent, S.SMOOTH)
      put(0, 1.5, 2.11, 5, 0.18, 0.06, accent, S.SMOOTH)
      gable(put, 5, 4.2, 3, 2.4, roof, wall, 0.5)
      put(0, 0, 2.15, 1, 1.9, 0.08, accent, S.SMOOTH)
      for (const x of [-1.6, 1.6]) put(x, 1.9, 2.15, 0.8, 0.7, 0.06, '#ffd27a', S.GLOW)
      return
    case 'beach':
      for (const [x, z] of [[-2.2, -1.8], [2.2, -1.8], [-2.2, 1.8], [2.2, 1.8]]) put(x, 0, z, 0.3, 1.4, 0.3, WOOD, S.SMOOTH)
      put(0, 1.4, 0, 5.2, 0.25, 5.2, WOOD, S.STUDS)
      put(0, 1.65, -0.5, 4.6, 2.6, 3.6, wall)
      gable(put, 4.6, 3.6, 4.25, 1.4, roof, wall)
      frontWindows(put, 4.6, 2.6, 2.4, 2, 1)
      put(0, 1.65, 2.5, 5.2, 0.6, 0.12, accent, S.SMOOTH)
      return
    case 'candy':
      put(0, 0, 0, 5, 3.2, 4.4, wall)
      gable(put, 5, 4.4, 3.2, 2, roof, wall)
      for (const side of [-1, 1]) put(side * 1.6, 4, 0, 0.3, 0.3, 4.8, accent, S.SMOOTH)
      put(0, 0, 2.21, 1.1, 2, 0.08, roof, S.SMOOTH)
      for (const x of [-1.7, 1.7]) put(x, 1.3, 2.21, 0.9, 0.9, 0.06, '#ffe8a0', S.GLOW)
      for (const [x, z] of [[-2.6, 2.3], [2.6, 2.3]]) put(x, 0, z, 0.5, 0.6, 0.5, accent, S.SMOOTH)
      return
    case 'stone':
      put(0, 0, 0, 5.4, 3.6, 4.6, wall)
      for (let i = 0; i < 5; i += 1) put(-2.2 + i * 1.1, 3.6, 2.15, 0.55, 0.5, 0.35, wall)
      for (let i = 0; i < 5; i += 1) put(-2.2 + i * 1.1, 3.6, -2.15, 0.55, 0.5, 0.35, wall)
      put(0, 3.6, 0, 5.2, 0.2, 4.4, roof, S.SMOOTH)
      put(0, 0, 2.31, 1.1, 2.1, 0.08, roof, S.SMOOTH)
      for (const x of [-1.7, 1.7]) put(x, 1.4, 2.31, 0.8, 1, 0.06, accent, S.GLOW)
      return
    case 'dome':
      cyl(put, 0, 0, 0, 3, 1.6, wall, S.PLATE)
      cone(put, 0, 1.6, 0, 2.9, 3, 5, roof, S.GLOW)
      put(0, 0, 2.7, 1.4, 1.9, 0.9, wall, S.SMOOTH)
      put(0, 0.2, 3.16, 0.9, 1.4, 0.05, accent, S.GLOW)
      put(1.4, 4.4, 0, 0.12, 1.4, 0.12, wall, S.SMOOTH)
      put(1.4, 5.8, 0, 0.35, 0.35, 0.35, accent, S.GLOW)
      return
    case 'flat':
      put(0, 0, 0, 5.4, 3, 4.6, wall, S.SMOOTH)
      put(0.8, 3, -0.3, 3.6, 2.4, 3.6, wall, S.SMOOTH)
      put(0, 0.4, 2.31, 4.2, 2, 0.06, roof, S.GLOW)
      put(0.8, 3.4, 1.51, 2.8, 1.6, 0.06, roof, S.GLOW)
      put(0, 3, 0, 5.6, 0.15, 4.8, accent, S.GLOW)
      return
    default:
      // Gable-roofed house (and the farmhouse).
      put(0, 0, 0, 5, 3, 4.4, wall)
      gable(put, 5, 4.4, 3, 1.8, roof, wall)
      frontWindows(put, 5, 4.4, 1.2, 2)
      put(0, 0, 2.21, 1, 1.9, 0.08, WOOD, S.SMOOTH)
      put(1.6, 3.6, -0.8, 0.6, 1.4, 0.6, '#a8582f')
      put(0, 0, 2.6, 2.2, 0.15, 0.9, '#d8dce4', S.SMOOTH)
  }
}

function barn(put, { c }) {
  const [red, white, roof] = c
  put(0, 0, 0, 6.4, 4, 5.6, red)
  // A gambrel roof: steep low slopes, shallow upper ones.
  for (const side of [-1, 1]) {
    put(side * 2.6, 3.8, 0, 2.2, 0.25, 6, roof, S.STUDS, 0, -side * 1)
    put(side * 1.1, 5.25, 0, 2.6, 0.25, 6, roof, S.STUDS, 0, -side * 0.38)
  }
  for (let i = 0; i < 3; i += 1) put(0, 4 + i * 0.6, 0, 5.6 - i * 1.6, 0.6, 5.5, red, S.SMOOTH)
  put(0, 0, 2.82, 2.6, 2.8, 0.08, white, S.SMOOTH)
  put(0, 0, 2.86, 2.2, 2.4, 0.06, red, S.SMOOTH)
  put(0, 1.2, 2.9, 2.6, 0.2, 0.06, white, S.SMOOTH, 0, 0.75)
  put(0, 1.2, 2.9, 2.6, 0.2, 0.06, white, S.SMOOTH, 0, -0.75)
  put(0, 4.6, 2.82, 1.2, 1, 0.08, white, S.SMOOTH)
  for (const x of [-3.2, 3.2]) put(x, 0, 2.8, 0.25, 4, 0.12, white, S.SMOOTH)
}

function shop(put, { v, c }) {
  const wall = c[0]
  const accent = c[1]
  const extra = c[2] ?? WHITE
  switch (v) {
    case 'saloon':
      put(0, 0, -0.5, 6, 3.6, 4.4, wall)
      put(0, 0, 1.8, 6.4, 5.4, 0.3, wall)
      put(0, 3.2, 2.5, 6.4, 0.18, 1.4, accent, S.STUDS)
      for (const x of [-3, 3]) put(x, 0, 3.1, 0.18, 3.2, 0.18, accent, S.SMOOTH)
      put(0, 4.4, 1.98, 4, 0.8, 0.06, extra, S.SMOOTH)
      put(0, 0.4, 1.98, 1.4, 1.6, 0.06, accent, S.SMOOTH)
      return
    case 'lodge':
      for (const side of [-1, 1]) put(side * 1.9, 0, 0, 4.6, 0.3, 6, wall, S.STUDS, 0, -side * 1.05)
      for (let i = 0; i < 4; i += 1) put(0, i * 1.1, 0, 5.2 - i * 1.3, 1.1, 5.6, wall, S.SMOOTH)
      put(0, 0.2, 2.82, 3, 2.6, 0.06, extra, S.GLOW)
      for (const side of [-1, 1]) put(side * 1.9, 0.05, 0, 4.6, 0.12, 6.1, accent, S.SMOOTH, 0, -side * 1.05)
      return
    case 'funhouse':
      put(0, 0, 0, 6, 4.2, 5, wall)
      for (const x of [-3, 3]) put(x, 0, 2.4, 0.9, 6, 0.9, accent, S.STRIPES)
      for (const x of [-3, 3]) cone(put, x, 6, 2.4, 0.7, 1.4, 3, extra)
      put(0, 4.2, 0, 5, 1.2, 4, extra, S.STRIPES)
      put(0, 0.3, 2.51, 1.6, 2.6, 0.06, DARK, S.SMOOTH)
      for (const x of [-1.8, 1.8]) put(x, 2.6, 2.52, 0.9, 0.9, 0.06, accent, S.GLOW)
      return
    case 'club':
      put(0, 0, 0, 6, 4.4, 5, wall, S.SMOOTH)
      put(0, 4.4, 0, 6.2, 0.2, 5.2, accent, S.GLOW)
      put(0, 0, 2.51, 6, 0.2, 0.06, extra, S.GLOW)
      for (const x of [-3, 3]) put(x, 0, 2.5, 0.2, 4.4, 0.2, extra, S.GLOW)
      put(0, 4.8, 2.3, 4, 1.4, 0.3, wall, S.SMOOTH)
      put(0, 5, 2.46, 3.4, 1, 0.06, accent, S.GLOW)
      put(0, 0.2, 2.53, 1.4, 2.4, 0.04, accent, S.GLOW)
      return
    case 'warehouse':
      put(0, 0, 0, 7.2, 4.2, 5.6, wall, S.PLATE)
      for (const side of [-1, 1]) put(side * 1.85, 4.5, 0, 3.9, 0.22, 6, accent, S.PLATE, 0, -side * 0.18)
      put(0, 0, 2.81, 3.2, 3.2, 0.08, accent, S.PLATE)
      put(2.6, 2.6, 2.81, 1.4, 0.6, 0.06, extra, S.SMOOTH)
      return
    case 'tavern':
      put(0, 0, 0, 5.6, 3, 4.6, wall)
      put(0, 3, 0, 6, 2.4, 5, wall)
      for (const x of [-2.8, -0.9, 0.9, 2.8]) put(x, 3, 2.51, 0.18, 2.4, 0.06, accent, S.SMOOTH)
      gable(put, 6, 5, 5.4, 2, accent, wall)
      put(0, 0, 2.31, 1.2, 2, 0.08, accent, S.SMOOTH)
      put(2.2, 2.4, 2.8, 1, 0.7, 0.08, extra, S.SMOOTH)
      for (const x of [-1.8, 1.8]) put(x, 1.2, 2.31, 0.9, 0.8, 0.06, '#ffd27a', S.GLOW)
      return
    case 'forge':
      put(0, 0, 0, 6, 3.4, 5, wall)
      put(2, 0, -1.2, 1.6, 7, 1.6, wall)
      put(2, 7, -1.2, 1.2, 0.6, 1.2, accent, S.GLOW)
      put(0, 0, 2.51, 2.4, 2.2, 0.06, accent, S.GLOW)
      put(-2, 0, 3, 1.6, 0.6, 1, accent, S.LAVA)
      put(0, 3.4, 0, 6.2, 0.25, 5.2, extra, S.SMOOTH)
      return
    case 'lab':
      put(0, 0, 0, 6, 3.2, 5, wall, S.PLATE)
      cone(put, -0.8, 3.2, 0, 2.2, 2.4, 4, accent, S.SMOOTH)
      put(-0.8, 4.4, 0.9, 0.5, 1.2, 1.8, DARK, S.SMOOTH, 0, 0, -0.5)
      frontWindows(put, 6, 5, 1.2, 4, 0.8, extra, S.GLOW)
      put(2.2, 3.2, -1.2, 0.15, 2.4, 0.15, wall, S.SMOOTH)
      put(2.2, 5.6, -1.2, 0.35, 0.35, 0.35, extra, S.GLOW)
      return
    case 'windmill':
      put(0, 0, 0, 4.2, 4, 4.2, wall)
      put(0, 4, 0, 3.4, 3, 3.4, wall)
      cone(put, 0, 7, 0, 2.2, 2, 3, accent)
      for (let i = 0; i < 4; i += 1) put(0, 6.2, 2.2, 0.5, 6.4, 0.12, extra, S.SMOOTH, 0, (i * Math.PI) / 2 + 0.4)
      put(0, 5.9, 2.15, 0.6, 0.6, 0.3, accent, S.SMOOTH)
      put(0, 0, 2.11, 1.1, 2, 0.08, WOOD, S.SMOOTH)
      return
    default:
      // A shop front with a striped awning and a sign.
      put(0, 0, 0, 6, 3.8, 4.6, wall)
      put(0, 0.3, 2.31, 4.4, 2, 0.06, extra === WHITE ? GLASS : extra, S.SMOOTH)
      put(0, 2.55, 2.75, 6, 0.15, 1.2, accent, S.STRIPES, 0, 0, -0.32)
      put(0, 3.8, 1.9, 5, 1, 0.25, accent, S.SMOOTH)
      put(0, 3.95, 2.04, 4.2, 0.6, 0.04, WHITE, S.GLOW)
      put(0, 3.8, 0, 6.2, 0.25, 4.8, '#8a8e9a', S.SMOOTH)
  }
}

// --- Huge ------------------------------------------------------------------------------

function tower(put, { v, c }) {
  const main = c[0]
  const accent = c[1]
  const extra = c[2] ?? WHITE
  switch (v) {
    case 'silo':
      cyl(put, -1.4, 0, 0, 2.2, 12, main, S.PLATE)
      cone(put, -1.4, 12, 0, 2.2, 2.2, 4, accent, S.SMOOTH)
      for (const y of [3, 6.5, 10]) cyl(put, -1.4, y, 0, 2.25, 0.3, extra, S.SMOOTH)
      cyl(put, 2.4, 0, 0.6, 1.5, 8, main, S.PLATE)
      cone(put, 2.4, 8, 0.6, 1.5, 1.5, 3, accent, S.SMOOTH)
      put(0.6, 0, -1.6, 0.2, 12.5, 0.2, extra, S.SMOOTH)
      return
    case 'apartment':
      put(0, 0, 0, 8, 15, 7, main, S.WINDOWS)
      for (let f = 1; f < 5; f += 1) put(0, f * 3, 3.7, 6.5, 0.2, 0.9, accent, S.SMOOTH)
      put(0, 15, 0, 8.4, 0.4, 7.4, extra, S.SMOOTH)
      cyl(put, 2, 15.4, -1.5, 1.1, 2.2, '#8a96a6', S.PLATE)
      put(-2, 15.4, 1, 1.4, 0.8, 1, '#c8ccd4', S.PLATE)
      put(0, 0, 3.55, 2, 2.6, 0.1, extra, S.GLOW)
      return
    case 'office':
      put(0, 0, 0, 7.4, 20, 7.4, main, S.WINDOWS)
      put(0, 20, 0, 5.8, 4, 5.8, main, S.WINDOWS)
      put(0, 24, 0, 4, 0.5, 4, accent, S.SMOOTH)
      put(0, 24.5, 0, 0.3, 4, 0.3, extra, S.SMOOTH)
      put(0, 28.5, 0, 0.4, 0.4, 0.4, '#ff3a3a', S.GLOW)
      put(0, 0, 3.75, 3, 3, 0.1, accent, S.GLOW)
      return
    case 'glass':
      put(0, 0, 0, 7, 26, 7, main, S.WINDOWS)
      for (let i = 0; i < 4; i += 1) {
        const a = (i * Math.PI) / 2
        put(Math.cos(a) * 3.55, 0, Math.sin(a) * 3.55, 0.2, 26, 0.2, accent, S.SMOOTH)
      }
      put(0, 26, 0, 6, 2, 6, accent, S.GLOW)
      put(0, 28, 0, 3, 3, 3, main, S.WINDOWS, Math.PI / 4)
      return
    case 'mesa':
      put(0, 0, 0, 8.4, 5, 7.6, main)
      put(0.4, 5, -0.3, 7, 4, 6.4, accent)
      put(-0.3, 9, 0.2, 5.6, 4, 5, main)
      put(0, 13, 0, 4, 1.2, 3.6, extra)
      for (const y of [2.4, 7, 11]) put(0, y, 0, 8.6 - y * 0.25, 0.4, 7.8 - y * 0.25, extra, S.SMOOTH)
      return
    case 'chalet':
      put(0, 0, 0, 7.4, 4, 6.6, main)
      put(0, 4, 0, 7.4, 4, 6.6, main)
      for (const y of [4, 8]) put(0, y, 3.6, 7, 0.25, 1.2, main, S.SMOOTH)
      gable(put, 7.4, 6.6, 8, 4.2, accent, main, 0.6)
      frontWindows(put, 7.4, 6.6, 1.4, 3, 1.4, extra, S.GLOW)
      frontWindows(put, 7.4, 6.6, 5.4, 3, 1.4, extra, S.GLOW)
      return
    case 'drop':
      put(0, 0, 0, 5, 1, 5, accent, S.SMOOTH)
      put(0, 1, 0, 1.6, 26, 1.6, main, S.STRIPES)
      put(0, 9, 0, 3.8, 1.4, 3.8, accent, S.SMOOTH)
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * Math.PI * 2
        put(Math.cos(a) * 1.7, 8.7, Math.sin(a) * 1.7, 0.6, 0.9, 0.6, extra, S.SMOOTH)
      }
      put(0, 27, 0, 3, 0.8, 3, accent, S.SMOOTH)
      put(0, 27.8, 0, 1, 1, 1, extra, S.GLOW)
      return
    case 'hotel':
      put(0, 0, 0, 9, 18, 6.4, main, S.WINDOWS)
      for (let f = 1; f < 6; f += 1) put(0, f * 3, 3.4, 8.4, 0.2, 0.8, accent, S.SMOOTH)
      put(0, 18, 0, 9.4, 0.4, 6.8, extra, S.SMOOTH)
      put(0, 18.4, 0, 6, 2, 0.4, accent, S.SMOOTH)
      put(0, 18.7, 0.22, 5.4, 1.4, 0.05, WHITE, S.GLOW)
      return
    case 'factory':
      put(0, 0, 0, 9, 6, 8, main)
      for (let i = 0; i < 3; i += 1) put(-3 + i * 3, 6.6, 0, 3.2, 0.22, 8.2, '#8a8e9a', S.PLATE, 0, -0.4)
      for (const x of [-2.6, 2.6]) {
        cyl(put, x, 6, -2.6, 0.7, 10, accent, S.STRIPES)
      }
      put(0, 0, 4.01, 3, 3.4, 0.08, extra, S.PLATE)
      frontWindows(put, 9, 8, 3.8, 5, 0.8, '#ffe8a0', S.GLOW)
      return
    case 'candy':
      for (let i = 0; i < 4; i += 1) {
        const w = 8 - i * 1.6
        put(0, i * 3.2, 0, w, 3.2, w, i % 2 ? accent : main, S.MESA)
      }
      for (let i = 0; i < 5; i += 1) put(-1.6 + i * 0.8, 12.8, 0, 0.3, 1.2, 0.3, extra, S.SMOOTH)
      for (let i = 0; i < 5; i += 1) put(-1.6 + i * 0.8, 14, 0, 0.25, 0.35, 0.25, '#ffd21f', S.GLOW)
      return
    case 'castle':
      put(0, 0, 0, 6, 15, 6, main)
      for (let i = 0; i < 4; i += 1) {
        const a = (i * Math.PI) / 2
        for (let j = -1; j <= 1; j += 2) put(Math.cos(a) * 2.9 + Math.sin(a) * j * 1.6, 15, Math.sin(a) * 2.9 + Math.cos(a) * j * 1.6, 1, 1.2, 1, main)
      }
      cone(put, 0, 15, 0, 2.6, 6, 5, accent)
      put(0, 21, 0, 0.12, 2, 0.12, extra, S.SMOOTH)
      put(0.5, 22.3, 0, 1, 0.6, 0.06, c[1], S.SMOOTH)
      for (const y of [5, 9, 13]) put(0, y, 3.01, 0.6, 1.2, 0.06, DARK, S.SMOOTH)
      put(0, 0, 3.01, 1.6, 2.6, 0.06, '#5a3a22', S.SMOOTH)
      return
    case 'containers': {
      const cols = [main, accent, extra, '#ffc21f', '#8a5aff']
      let k = 0
      for (let level = 0; level < 4; level += 1) {
        for (const x of [-1.3, 1.3]) {
          put(x, level * 2.5, (level % 2) * 0.6 - 0.3, 2.4, 2.4, 6, cols[k % cols.length], S.PLATE, level === 3 ? 0.2 : 0)
          k += 1
        }
      }
      return
    }
    case 'neon':
      put(0, 0, 0, 7, 24, 7, main, S.SMOOTH)
      for (let i = 0; i < 4; i += 1) {
        const a = (i * Math.PI) / 2 + Math.PI / 4
        put(Math.cos(a) * 4.9, 0, Math.sin(a) * 4.9, 0.3, 24, 0.3, i % 2 ? accent : extra, S.GLOW)
      }
      for (let y = 3; y < 24; y += 4) put(0, y, 0, 7.1, 0.25, 7.1, y % 8 === 3 ? accent : extra, S.GLOW)
      put(0, 24, 0, 4.4, 3, 4.4, main, S.SMOOTH, Math.PI / 4)
      put(0, 27, 0, 0.5, 5, 0.5, accent, S.GLOW)
      return
    case 'spire':
      for (let i = 0; i < 6; i += 1) {
        const w = 6.4 - i * 0.9
        put(0, i * 3.4, 0, w, 3.4, w, i % 2 ? main : main, S.STUDS, i * 0.3)
        put(0, i * 3.4 + 1.5, 0, w + 0.2, 0.4, w + 0.2, accent, S.GLOW, i * 0.3)
      }
      put(0, 20.4, 0, 1.4, 4, 1.4, extra, S.GLOW, Math.PI / 4)
      return
    case 'comms':
      for (const [x, z] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) put(x, 0, z, 0.35, 22, 0.35, main, S.STRIPES, 0, (x > 0 ? -1 : 1) * 0.06, (z > 0 ? 1 : -1) * 0.06)
      for (let y = 2; y < 22; y += 4) {
        put(0, y, 0, 4.4 - y * 0.12, 0.2, 0.2, main, S.SMOOTH)
        put(0, y, 0, 0.2, 0.2, 4.4 - y * 0.12, main, S.SMOOTH)
      }
      put(0, 22, 0, 2.4, 0.5, 2.4, main, S.PLATE)
      put(0, 22.5, 0, 3.6, 0.2, 3.6, '#d8dce4', S.SMOOTH, 0, 0, -0.5)
      put(0, 24, 0, 0.5, 0.5, 0.5, accent, S.GLOW)
      put(0, 0, 0, 4.6, 0.6, 4.6, extra, S.PLATE)
      return
    case 'ruin':
      put(0, 0, 0, 7, 6, 7, main)
      put(-0.6, 6, 0.3, 5.6, 5, 5.4, main)
      put(0.8, 11, -0.4, 3.6, 3, 3.6, main)
      put(-1.2, 11, 1, 1.6, 1.6, 1.6, c[2])
      for (const [x, y, z] of [[3.3, 2, 1], [-3.3, 4, -1], [2, 7, 2.6], [-2.4, 9, -2.4]]) put(x, y, z, 1.4, 1.2, 1.4, accent)
      put(0, 0, 3.51, 1.6, 2.8, 0.06, DARK, S.SMOOTH)
      return
    default:
      put(0, 0, 0, 7, 18, 7, main, S.WINDOWS)
  }
}

// --- The Giant Trophy ---------------------------------------------------------------

function trophy(put, { c }) {
  const [gold, deep, shine] = c
  put(0, 0, 0, 4.2, 1, 4.2, '#2a3560', S.STUDS)
  put(0, 1, 0, 3.4, 0.7, 3.4, '#ffffff', S.SMOOTH)
  put(0, 1.7, 0, 1.2, 0.6, 1.2, deep, S.SMOOTH)
  put(0, 2.3, 0, 0.7, 1.6, 0.7, gold, S.SMOOTH)
  put(0, 3.9, 0, 1.6, 0.7, 1.6, deep, S.SMOOTH)
  put(0, 4.6, 0, 2.4, 1.2, 2.4, gold, S.SMOOTH)
  put(0, 5.8, 0, 3, 1.3, 3, gold, S.SMOOTH)
  put(0, 7.1, 0, 3.4, 0.4, 3.4, deep, S.SMOOTH)
  for (const side of [-1, 1]) {
    put(side * 1.9, 5.2, 0, 0.4, 2, 0.4, gold, S.SMOOTH)
    put(side * 1.75, 6.95, 0, 0.6, 0.4, 0.4, gold, S.SMOOTH)
  }
  put(0, 5.3, 1.52, 1.2, 1.2, 0.08, shine, S.GLOW, 0, Math.PI / 4)
}

// --- Landmarks: one per city ---------------------------------------------------------

const LANDMARKS = {
  farm(put) {
    // The Grain Tower: a tall elevator with silos round it.
    put(0, 0, 0, 12, 1, 12, '#c9975a', S.STUDS)
    put(0, 1, 0, 4.6, 20, 4.6, '#d8322a', S.STUDS)
    put(0, 21, 0, 5.4, 4, 5.4, '#ffffff', S.STUDS)
    gable(put, 5.4, 5.4, 25, 2.4, '#5a3a2a', '#ffffff')
    for (const [x, z] of [[-4.4, -3], [4.4, -3], [-4.4, 3], [4.4, 3]]) {
      cyl(put, x, 1, z, 1.8, 13, '#d0d6de', S.PLATE)
      cone(put, x, 14, z, 1.8, 1.6, 3, '#5a8ad8', S.SMOOTH)
    }
    put(0, 10, 2.4, 1.6, 1.6, 0.1, '#ffd21f', S.GLOW)
  },
  suburb(put) {
    // The Town Hall Clock: a stone hall with a clock tower.
    put(0, 0, 0, 13, 1, 11, '#c8ccd4')
    put(0, 1, 0, 11, 6, 8, '#e8e2d8')
    for (let i = 0; i < 6; i += 1) put(-4.5 + i * 1.8, 1, 4.2, 0.7, 6, 0.7, '#ffffff', S.SMOOTH)
    gable(put, 11, 8, 7, 2.4, '#5a6a8a', '#e8e2d8')
    put(0, 7, 0, 3.6, 12, 3.6, '#e8e2d8')
    put(0, 15, 1.82, 2.6, 2.6, 0.1, '#ffffff', S.GLOW)
    put(0, 16.1, 1.9, 0.15, 1.2, 0.06, DARK, S.SMOOTH)
    put(0.4, 16.2, 1.9, 0.9, 0.15, 0.06, DARK, S.SMOOTH)
    cone(put, 0, 19, 0, 2.4, 5, 5, '#5a6a8a')
    put(0, 24, 0, 0.5, 0.5, 0.5, '#ffd21f', S.GLOW)
  },
  downtown(put) {
    // The Sky Needle: a slender tower with a saucer deck.
    put(0, 0, 0, 12, 1, 12, '#8a96a6', S.PLATE)
    for (let i = 0; i < 3; i += 1) {
      const a = (i / 3) * Math.PI * 2
      put(Math.cos(a) * 1.6, 1, Math.sin(a) * 1.6, 0.9, 24, 0.9, '#e8eef6', S.STRIPES)
    }
    put(0, 1, 0, 1.6, 26, 1.6, '#c8d0dc', S.SMOOTH)
    put(0, 25, 0, 8, 1, 8, '#5ab8e8', S.WINDOWS)
    put(0, 25, 0, 8, 1, 8, '#5ab8e8', S.WINDOWS, Math.PI / 4)
    put(0, 26, 0, 6.4, 2, 6.4, '#ffffff', S.GLOW, Math.PI / 8)
    put(0, 28, 0, 0.6, 7, 0.6, '#e8eef6', S.SMOOTH)
    put(0, 35, 0, 0.7, 0.7, 0.7, '#ff3a3a', S.GLOW)
  },
  desert(put) {
    // The Oil Derrick: a lattice tower over a pump.
    put(0, 0, 0, 12, 0.8, 12, '#b8864a')
    for (const [x, z] of [[-3.5, -3.5], [3.5, -3.5], [-3.5, 3.5], [3.5, 3.5]]) put(x * 0.75, 0.8, z * 0.75, 0.5, 22, 0.5, '#5a4a3a', S.SMOOTH, 0, -Math.sign(x) * 0.12, Math.sign(z) * 0.12)
    for (let y = 3; y < 22; y += 4) {
      const w = 6 - y * 0.2
      put(0, y, w / 2, w, 0.3, 0.3, '#ffc21f', S.SMOOTH)
      put(0, y, -w / 2, w, 0.3, 0.3, '#ffc21f', S.SMOOTH)
      put(w / 2, y, 0, 0.3, 0.3, w, '#ffc21f', S.SMOOTH)
      put(-w / 2, y, 0, 0.3, 0.3, w, '#ffc21f', S.SMOOTH)
    }
    put(0, 22.8, 0, 2.4, 1.2, 2.4, '#d83a3a', S.SMOOTH)
    put(4, 0.8, 3, 3, 2, 1.6, '#3a3a46', S.PLATE)
    put(4, 2.8, 3, 4.4, 0.6, 0.6, '#d83a3a', S.SMOOTH, 0, 0.3)
  },
  snow(put) {
    // The Ice Palace: glowing ice towers round a great hall.
    put(0, 0, 0, 13, 1, 13, '#d8ecff', S.SMOOTH)
    put(0, 1, 0, 8, 8, 8, '#bfe8ff', S.GLOW)
    cone(put, 0, 9, 0, 4, 8, 6, '#e8f8ff', S.GLOW)
    for (const [x, z] of [[-5, -5], [5, -5], [-5, 5], [5, 5]]) {
      put(x, 1, z, 2.6, 12, 2.6, '#9fdcff', S.GLOW)
      cone(put, x, 13, z, 1.6, 5, 4, '#e8f8ff', S.GLOW)
    }
    put(0, 1, 4.05, 3, 4.4, 0.1, '#5ab8e8', S.SMOOTH)
  },
  park(put) {
    // The Mega Ferris Wheel.
    put(0, 0, 0, 14, 1, 6, '#ff9ac8', S.STUDS)
    for (const x of [-2.6, 2.6]) for (const z of [-1, 1]) put(x * 0.4, 1, z * 1.2, 0.6, 15, 0.6, '#ffffff', S.SMOOTH, 0, x > 0 ? 0.3 : -0.3)
    put(0, 15.5, 0, 1.6, 1.6, 2.6, '#ffd21f', S.SMOOTH)
    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * Math.PI * 2
      put(Math.cos(a) * 6, 15.5 + Math.sin(a) * 6, 0, 12.2, 0.25, 0.25, '#ffffff', S.SMOOTH, 0, a)
      put(Math.cos(a) * 12, 15.5 + Math.sin(a) * 12 - 0.8, 0, 1.6, 1.6, 1.6, ['#ff5f8a', '#5fd8ff', '#ffd21f', '#8a5aff'][i % 4], S.SMOOTH)
    }
    for (let i = 0; i < 24; i += 1) {
      const a = (i / 24) * Math.PI * 2
      put(Math.cos(a) * 12, 15.5 + Math.sin(a) * 12, 0, 3.2, 0.3, 0.3, '#ff3a8a', S.GLOW, 0, a + Math.PI / 2)
    }
  },
  beach(put) {
    // The Lighthouse.
    put(0, 0, 0, 12, 1.4, 12, '#a8a296', S.STUDS)
    for (let i = 0; i < 6; i += 1) {
      const r = 3.2 - i * 0.3
      cyl(put, 0, 1.4 + i * 3.5, 0, r, 3.5, i % 2 ? '#e8322a' : '#ffffff', S.SMOOTH)
    }
    put(0, 22.4, 0, 4.6, 0.4, 4.6, '#2a2f3a', S.SMOOTH)
    cyl(put, 0, 22.8, 0, 1.6, 2.4, '#fff6a8', S.GLOW)
    cone(put, 0, 25.2, 0, 2, 2.4, 4, '#e8322a')
    put(3, 1.4, 2, 3.6, 2.6, 3, '#ffffff')
    gable(put, 3.6, 3, 4, 1, '#e8322a', '#ffffff')
  },
  industrial(put) {
    // The Power Plant: two cooling towers and a turbine hall.
    put(0, 0, 0, 14, 1, 13, '#8a8e98', S.PLATE)
    for (const x of [-3.6, 3.6]) {
      for (let i = 0; i < 6; i += 1) {
        const r = 3.2 - Math.sin((i / 5) * Math.PI) * 0.9
        cyl(put, x, 1 + i * 3, -2, r, 3, '#c8ccd4', S.STUDS)
      }
      cyl(put, x, 19, -2, 2.6, 0.5, '#ff7a1e', S.STRIPES)
    }
    put(0, 1, 4, 12, 5, 4, '#5a6676', S.PLATE)
    frontWindows(put, 12, 8, 3, 6, 1, '#ffe27a', S.GLOW)
  },
  candy(put) {
    // The Cake Tower: a giant layer cake, candles lit.
    for (let i = 0; i < 6; i += 1) {
      const w = 13 - i * 1.9
      put(0, i * 3.6, 0, w, 3.6, w, ['#ff9ad8', '#fff0f8', '#7ad8ff'][i % 3], S.MESA)
    }
    for (let i = 0; i < 4; i += 1) {
      const a = (i / 4) * Math.PI * 2
      put(Math.cos(a) * 1.2, 21.6, Math.sin(a) * 1.2, 0.5, 2.6, 0.5, '#ffffff', S.STRIPES)
      put(Math.cos(a) * 1.2, 24.2, Math.sin(a) * 1.2, 0.4, 0.6, 0.4, '#ffd21f', S.GLOW)
    }
    put(0, 21.6, 0, 1.4, 1.4, 1.4, '#ff3a4a', S.SMOOTH)
  },
  medieval(put) {
    // The Royal Castle: walls, a keep and four turrets.
    put(0, 0, 0, 14, 1, 14, '#8a8e9a')
    for (const [x, z, w, d] of [[0, -6, 13, 1.4], [0, 6, 13, 1.4], [-6, 0, 1.4, 13], [6, 0, 1.4, 13]]) put(x, 1, z, w, 5, d, '#a8acb8')
    put(0, 1, 0, 6, 14, 6, '#b8bcc8')
    cone(put, 0, 15, 0, 3.4, 6, 5, '#3a6ad8')
    for (const [x, z] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) {
      cyl(put, x, 1, z, 1.6, 9, '#a8acb8')
      cone(put, x, 10, z, 1.9, 4, 4, '#3a6ad8')
    }
    put(0, 1, 6.75, 2.6, 3.6, 0.1, '#5a3a22', S.SMOOTH)
    put(0, 21, 0, 0.15, 2.4, 0.15, '#ffffff', S.SMOOTH)
    put(0.6, 22.6, 0, 1.2, 0.7, 0.06, '#ffd21f', S.SMOOTH)
  },
  harbor(put) {
    // The Cargo Crane: a gantry over stacked containers.
    put(0, 0, 0, 14, 1, 10, '#5a6270', S.PLATE)
    for (const x of [-5, 5]) for (const z of [-3, 3]) put(x, 1, z, 0.9, 18, 0.9, '#ff9a1e', S.STRIPES)
    put(0, 19, -3, 12, 1.2, 1, '#ff9a1e', S.SMOOTH)
    put(0, 19, 3, 12, 1.2, 1, '#ff9a1e', S.SMOOTH)
    put(0, 20, 0, 22, 1.2, 1.4, '#ffc21f', S.SMOOTH)
    put(-3, 21.2, 0, 3, 2.4, 2.4, '#3a3f4a', S.PLATE)
    put(-3, 9, 0, 0.12, 12, 0.12, DARK, S.SMOOTH)
    put(-3, 7, 0, 2.6, 2.4, 6, '#2f6ae8', S.PLATE)
    const cols = ['#e8422a', '#2f8ae8', '#3fbf4a', '#ffc21f']
    for (let i = 0; i < 6; i += 1) put(3 + (i % 2) * 2.5, 1 + Math.floor(i / 2) * 2.5, 0, 2.4, 2.4, 6, cols[i % 4], S.PLATE)
  },
  neon(put) {
    // The Neon Spire.
    put(0, 0, 0, 13, 1, 13, '#16182a', S.SMOOTH)
    for (let i = 0; i < 8; i += 1) {
      const w = 9 - i * 1
      put(0, 1 + i * 4, 0, w, 4, w, '#1f2240', S.SMOOTH, i * 0.2)
      put(0, 4.6 + i * 4, 0, w + 0.3, 0.35, w + 0.3, i % 2 ? '#ff3ad2' : '#3fe8ff', S.GLOW, i * 0.2)
    }
    put(0, 33, 0, 0.8, 8, 0.8, '#ffffff', S.GLOW)
    for (const [x, z] of [[-5, 5], [5, 5]]) put(x, 1, z, 0.4, 10, 0.4, '#ff3ad2', S.GLOW)
  },
  volcano(put) {
    // The Fire Temple: a stepped pyramid with a burning top.
    for (let i = 0; i < 5; i += 1) {
      const w = 14 - i * 2.6
      put(0, i * 3, 0, w, 3, w, '#3a2a2a')
      put(0, i * 3 + 2.6, 0, w + 0.2, 0.4, w + 0.2, '#ff6a1e', S.LAVA)
    }
    put(0, 15, 0, 3, 3, 3, '#2a1f1a')
    put(0, 18, 0, 2.2, 2.4, 2.2, '#ff8a1e', S.GLOW)
    put(0, 0, 7.01, 1.6, 4, 0.1, '#ff6a1e', S.GLOW)
  },
  crystal(put) {
    // The Giant Geode.
    put(0, 0, 0, 13, 2, 13, '#4a3a5a')
    for (let i = 0; i < 9; i += 1) {
      const a = (i / 9) * Math.PI * 2
      const r = i % 3 === 0 ? 0 : 3.5
      put(Math.cos(a) * r, 2, Math.sin(a) * r, 2.6 - (r ? 0.8 : 0), 14 - (r ? 6 : 0) + (i % 2) * 3, 2.6 - (r ? 0.8 : 0), i % 2 ? '#c08cff' : '#5ac8ff', S.GLOW, a, r ? Math.cos(a) * 0.25 : 0, r ? -Math.sin(a) * 0.25 : 0)
    }
    put(0, 2, 0, 3.4, 18, 3.4, '#e8d8ff', S.GLOW, 0.4)
  },
  sky(put) {
    // The Sky Castle, on its cloud.
    put(0, 0, 0, 14, 2, 14, '#ffffff', S.SMOOTH)
    put(0, 0.5, 0, 16, 1.2, 10, '#eef6ff', S.SMOOTH, 0.6)
    put(0, 2, 0, 8, 8, 8, '#ffffff', S.STUDS)
    for (const [x, z] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) {
      cyl(put, x, 2, z, 1.4, 12, '#ffffff')
      cone(put, x, 14, z, 1.8, 4, 4, '#5fd8ff')
    }
    cone(put, 0, 10, 0, 3.6, 8, 5, '#5fd8ff')
    put(0, 18, 0, 0.6, 0.6, 0.6, '#ffd21f', S.GLOW)
  },
  moon(put) {
    // The Launch Rocket on its pad.
    put(0, 0, 0, 13, 1, 13, '#8a8e9a', S.PLATE)
    cyl(put, 0, 1, 0, 2.4, 20, '#f2f2f2', S.SMOOTH)
    for (const y of [6, 13]) cyl(put, 0, y, 0, 2.45, 0.6, '#e8322a', S.SMOOTH)
    cone(put, 0, 21, 0, 2.4, 6, 6, '#e8322a', S.SMOOTH)
    for (let i = 0; i < 4; i += 1) {
      const a = (i / 4) * Math.PI * 2
      put(Math.cos(a) * 2.8, 1, Math.sin(a) * 2.8, 1.8, 5, 0.3, '#e8322a', S.SMOOTH, -a)
    }
    put(5, 1, 0, 1.2, 24, 1.2, '#ffc21f', S.STRIPES)
    put(3.6, 18, 0, 2.6, 0.5, 0.5, '#ffc21f', S.SMOOTH)
    put(0, 10, 2.42, 1.2, 1.2, 0.1, '#5fd8ff', S.GLOW)
  },
  jungle(put) {
    // The Sun Pyramid.
    for (let i = 0; i < 6; i += 1) {
      const w = 14 - i * 2.2
      put(0, i * 2.6, 0, w, 2.6, w, i % 2 ? '#8a9a7a' : '#9aa88a')
    }
    put(0, 0, 0, 3, 15.6, 14.2, '#7a8a6a')
    put(0, 15.6, 0, 3, 3.2, 3, '#8a9a7a')
    put(0, 16.4, 1.52, 1.6, 1.6, 0.1, '#ffd21f', S.GLOW)
    for (const [x, z] of [[-6.5, 6.5], [6.5, 6.5], [-6.5, -6.5], [6.5, -6.5]]) put(x, 0, z, 1, 2.4, 1, '#3fae3a')
  },
  cyber(put) {
    // The Mega Mainframe: server towers round a data core.
    put(0, 0, 0, 13, 1, 13, '#10131c', S.SMOOTH)
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2
      put(Math.cos(a) * 4.6, 1, Math.sin(a) * 4.6, 2.2, 14, 2.2, '#1f2433', S.SMOOTH, -a)
      for (let y = 2; y < 15; y += 2) put(Math.cos(a) * 4.6, y, Math.sin(a) * 4.6, 2.3, 0.2, 2.3, i % 2 ? '#3fe8ff' : '#ff3ad2', S.GLOW, -a)
    }
    put(0, 1, 0, 3, 22, 3, '#3fe8ff', S.GLOW, Math.PI / 4)
    put(0, 23, 0, 5, 0.5, 5, '#ff3ad2', S.GLOW)
  },
  alien(put) {
    // The Mothership, hovering over its landing ring.
    cyl(put, 0, 0, 0, 7, 0.6, '#3a2a5a', S.PLATE)
    for (let i = 0; i < 3; i += 1) {
      const a = (i / 3) * Math.PI * 2
      put(Math.cos(a) * 4, 0.6, Math.sin(a) * 4, 0.6, 8, 0.6, '#8a5aff', S.GLOW, 0, Math.sin(a) * 0.2, Math.cos(a) * 0.2)
    }
    cyl(put, 0, 9, 0, 7.5, 1.4, '#c8d0dc', S.PLATE)
    cyl(put, 0, 10.4, 0, 5.4, 1.4, '#a8b0bc', S.PLATE)
    cone(put, 0, 11.8, 0, 3.4, 3, 4, '#5aff8a', S.GLOW)
    for (let i = 0; i < 12; i += 1) {
      const a = (i / 12) * Math.PI * 2
      put(Math.cos(a) * 6.8, 9.2, Math.sin(a) * 6.8, 0.6, 0.6, 0.6, i % 2 ? '#5aff8a' : '#ff5fd2', S.GLOW)
    }
    cone(put, 0, 0.6, 0, 2.2, 8.4, 3, '#5aff8a', S.GLOW)
  },
  cosmic(put) {
    // The Star Forge: a ring round a blazing star.
    put(0, 0, 0, 13, 1, 13, '#1a1440', S.GALAXY)
    for (const x of [-5, 5]) put(x, 1, 0, 1.2, 12, 1.2, '#3a2a6a', S.GALAXY)
    for (let i = 0; i < 20; i += 1) {
      const a = (i / 20) * Math.PI * 2
      put(Math.cos(a) * 7, 13 + Math.sin(a) * 7, 0, 2.4, 0.6, 1, '#8a7aff', S.GLOW, 0, a + Math.PI / 2)
    }
    put(0, 10, 0, 5, 5, 5, '#ffe27a', S.GLOW, 0.4, 0.6)
    put(0, 10.5, 0, 4, 4, 4, '#ff7ad2', S.GLOW, 1.2, 0.2)
  },
}

const SMALL = { tree, car, scarecrow, cow, statue, stall, sign: tiny.sign }
const BUILDERS = { ...tiny, ...SMALL, truck, shed, house, barn, shop, tower, trophy }

/**
 * Builds kind `kind` (a cities KINDS entry, or for a landmark `{ arch: 'landmark', v: theme }`)
 * through `put`.
 */
export function buildKind(put, kind) {
  if (kind.arch === 'landmark') {
    ;(LANDMARKS[kind.v] ?? LANDMARKS.farm)(put)
    return
  }
  const builder = BUILDERS[kind.arch]
  if (builder) builder(put, kind)
  else put(0, 0, 0, 1, 1, 1, kind.c?.[0] ?? '#ff00ff')
}
