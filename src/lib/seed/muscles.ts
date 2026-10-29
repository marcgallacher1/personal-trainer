export const MUSCLE_IDS = [
  'chest',
  'front_delts',
  'side_delts',
  'rear_delts',
  'lats',
  'upper_back',
  'lower_back',
  'biceps',
  'triceps',
  'forearms',
  'abs',
  'obliques',
  'glutes',
  'quads',
  'hamstrings',
  'adductors',
  'calves',
] as const

export type MuscleId = (typeof MUSCLE_IDS)[number]

export interface MuscleSeed {
  id: MuscleId
  name: string
  region: 'upper' | 'lower' | 'core'
  bodySide: 'front' | 'back'
}

export const MUSCLES: readonly MuscleSeed[] = [
  { id: 'chest', name: 'Chest', region: 'upper', bodySide: 'front' },
  { id: 'front_delts', name: 'Front delts', region: 'upper', bodySide: 'front' },
  { id: 'side_delts', name: 'Side delts', region: 'upper', bodySide: 'front' },
  { id: 'rear_delts', name: 'Rear delts', region: 'upper', bodySide: 'back' },
  { id: 'lats', name: 'Lats', region: 'upper', bodySide: 'back' },
  { id: 'upper_back', name: 'Upper back / traps', region: 'upper', bodySide: 'back' },
  { id: 'lower_back', name: 'Lower back', region: 'core', bodySide: 'back' },
  { id: 'biceps', name: 'Biceps', region: 'upper', bodySide: 'front' },
  { id: 'triceps', name: 'Triceps', region: 'upper', bodySide: 'back' },
  { id: 'forearms', name: 'Forearms', region: 'upper', bodySide: 'front' },
  { id: 'abs', name: 'Abs', region: 'core', bodySide: 'front' },
  { id: 'obliques', name: 'Obliques', region: 'core', bodySide: 'front' },
  { id: 'glutes', name: 'Glutes', region: 'lower', bodySide: 'back' },
  { id: 'quads', name: 'Quads', region: 'lower', bodySide: 'front' },
  { id: 'hamstrings', name: 'Hamstrings', region: 'lower', bodySide: 'back' },
  { id: 'adductors', name: 'Adductors', region: 'lower', bodySide: 'front' },
  { id: 'calves', name: 'Calves', region: 'lower', bodySide: 'back' },
]
