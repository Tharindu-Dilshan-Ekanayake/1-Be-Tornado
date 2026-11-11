import { setText } from './popups'

/**
 * The bars over big things you're tearing up ("GIANT TROPHY 44%"): a fixed pool of DOM
 * elements (ProgressLayer renders them once), moved from the frame loop without React.
 */
export const PROGRESS_POOL_SIZE = 3

/** @type {Array<{ el: HTMLElement, fill: HTMLElement, texts: HTMLElement[], shown: string, visible: boolean }>} */
const pool = []

export function registerProgressElements(elements) {
  pool.length = 0
  for (const el of elements) {
    if (!el) continue
    pool.push({ el, fill: el.querySelector('[data-fill]'), texts: [...el.querySelectorAll('[data-text]')], shown: '', visible: false })
  }
}

/** Shows bar `slot` at screen (x, y) with `label` and `progress` (0-1); `label` null hides it. */
export function placeProgress(slot, label, progress = 0, x = 0, y = 0) {
  const p = pool[slot]
  if (!p) return
  if (label === null) {
    if (p.visible) {
      p.visible = false
      p.el.style.display = 'none'
    }
    return
  }
  if (!p.visible) {
    p.visible = true
    p.el.style.display = 'flex'
  }
  const text = `${label.toUpperCase()} ${Math.floor(progress * 100)}%`
  if (text !== p.shown) {
    p.shown = text
    for (const t of p.texts) setText(t, text)
  }
  p.fill.style.transform = `scaleX(${progress})`
  p.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`
}
