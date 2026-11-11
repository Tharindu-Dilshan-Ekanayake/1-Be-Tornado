/**
 * The storm's screen layer (ui/StormOverlay.jsx renders it, Storm.jsx drives it): a dark
 * vignette round the edges while you're in the storm, and a white-blue flash with each
 * bolt of lightning. Plain CSS opacity on two fixed elements - no post-processing, and
 * written only when the value actually changes.
 */
const els = { vignette: null, flash: null }
const last = { vignette: -1, flash: -1 }

export function registerStormOverlay(vignette, flash) {
  els.vignette = vignette
  els.flash = flash
  last.vignette = -1
  last.flash = -1
}

function set(name, value) {
  const el = els[name]
  if (!el) return
  const v = value < 0.01 ? 0 : Math.round(value * 100) / 100
  if (v === last[name]) return
  last[name] = v
  el.style.opacity = String(v)
  el.style.display = v > 0 ? 'block' : 'none'
}

/** `vignette` and `flash`, 0-1 each. */
export function setStormOverlay(vignette, flash) {
  set('vignette', vignette)
  set('flash', flash)
}
