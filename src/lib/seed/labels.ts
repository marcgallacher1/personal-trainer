import type { Equipment, MovementPattern } from './exercises'

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: 'Barbell',
  dumbbell: 'Dumbbell',
  cable: 'Cable',
  machine: 'Machine',
  bodyweight: 'Bodyweight',
  kettlebell: 'Kettlebell',
  band: 'Band',
  smith: 'Smith machine',
  other: 'Other',
}

export const PATTERN_LABELS: Record<MovementPattern, string> = {
  horizontal_push: 'Horizontal push',
  vertical_push: 'Vertical push',
  horizontal_pull: 'Horizontal pull',
  vertical_pull: 'Vertical pull',
  squat: 'Squat',
  hinge: 'Hinge',
  lunge: 'Lunge',
  carry: 'Carry',
  core: 'Core',
  isolation: 'Isolation',
}

export const label = <K extends string>(map: Record<K, string>, key: string): string =>
  (map as Record<string, string>)[key] ?? key
