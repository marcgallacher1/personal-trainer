/** Working/drop/failure sets are numbered 1, 2, 3…; warm-ups get 0 (shown unnumbered). */
export function setNumbers(types: readonly string[]): number[] {
  let n = 0
  return types.map((t) => (t === 'warmup' ? 0 : ++n))
}
