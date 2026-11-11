/** Where a remote player's rider is: whirling round inside their funnel. */
export function riderPosition(r, time, out) {
  const orbit = Math.min(0.9, r.radius * 0.12)
  const a = r.spin + time * 2.4
  return out.set(r.position.x + Math.cos(a) * orbit, 0.6 + r.radius * 0.18 + Math.sin(time * 2.6 + r.spin) * 0.25, r.position.z + Math.sin(a) * orbit)
}
