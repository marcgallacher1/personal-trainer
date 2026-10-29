import { createHash } from 'node:crypto'

// Fixed namespace so seeded exercise IDs are stable across environments (local, hosted, fixtures).
const NAMESPACE = '6f1c2b8e-4d3a-4c59-9a7e-2b1d0e9f8a71'

/** RFC 4122 UUIDv5 of the exercise name. */
export function seedExerciseId(name: string): string {
  const ns = Buffer.from(NAMESPACE.replaceAll('-', ''), 'hex')
  const hash = createHash('sha1').update(ns).update(name.toLowerCase()).digest()
  const b = hash.subarray(0, 16)
  b[6] = (b[6]! & 0x0f) | 0x50
  b[8] = (b[8]! & 0x3f) | 0x80
  const h = b.toString('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}
