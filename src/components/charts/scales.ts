/** Chart geometry shared by the SVG charts (pure). */

export const W = 340
export const H = 180
export const PAD = { top: 12, right: 10, bottom: 22, left: 36 }
export const PLOT_W = W - PAD.left - PAD.right
export const PLOT_H = H - PAD.top - PAD.bottom

/** Round numbers for axis ticks covering [min, max]. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) {
    max = min + 1
    min = Math.max(0, min - 1)
  }
  const raw = (max - min) / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw
  const lo = Math.floor(min / step) * step
  const ticks: number[] = []
  for (let v = lo; v <= max + step * 0.999; v += step) ticks.push(Math.round(v * 1000) / 1000)
  return ticks
}

export const linear =
  (d0: number, d1: number, r0: number, r1: number) =>
  (v: number): number =>
    d1 === d0 ? (r0 + r1) / 2 : r0 + ((v - d0) / (d1 - d0)) * (r1 - r0)

/** "3 Nov" from YYYY-MM-DD. */
export function shortDate(date: string): string {
  const [, m, d] = date.split('-')
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ]
  return `${Number(d)} ${months[Number(m) - 1] ?? ''}`
}

/** Indices of up to `n` evenly spaced x labels (always including the last). */
export function labelIndices(length: number, n = 4): number[] {
  if (length <= n) return Array.from({ length }, (_, i) => i)
  const step = (length - 1) / (n - 1)
  return Array.from({ length: n }, (_, i) => Math.round(i * step))
}
