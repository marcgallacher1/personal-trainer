import type { Exercise, ExerciseMuscle } from '../../db/queries'
import { db } from '../../db/local'
import { requireUserId } from '../../db/user'
import { deletion, newId, nowIso, save, type Change } from '../../db/write'
import type { LogType } from '../../lib/logging/types'
import type { Equipment, MovementPattern } from '../../lib/seed/exercises'

export type MuscleRole = 'primary' | 'secondary'

export interface ExerciseInput {
  name: string
  equipment: Equipment
  pattern: MovementPattern
  logType: LogType
  muscles: Record<string, MuscleRole>
}

const WEIGHT: Record<MuscleRole, number> = { primary: 1, secondary: 0.5 }

/** Creates or updates a custom exercise and its muscle mapping. Returns the exercise. */
export async function saveCustomExercise(
  input: ExerciseInput,
  existing?: Exercise,
): Promise<Exercise> {
  const userId = requireUserId()
  const now = nowIso()
  const isCompound = input.pattern !== 'isolation' && input.pattern !== 'core'
  const exercise: Exercise = existing
    ? {
        ...existing,
        name: input.name.trim(),
        equipment: input.equipment,
        pattern: input.pattern,
        log_type: input.logType,
        is_compound: isCompound,
      }
    : {
        id: newId(),
        user_id: userId,
        name: input.name.trim(),
        equipment: input.equipment,
        pattern: input.pattern,
        log_type: input.logType,
        is_compound: isCompound,
        is_custom: true,
        default_rest_seconds: isCompound ? 120 : 90,
        notes: null,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      }

  const current = existing
    ? await db.exercise_muscles.where('exercise_id').equals(existing.id).toArray()
    : []
  const changes: Change[] = [{ table: 'exercises', row: exercise }]

  for (const [muscleId, role] of Object.entries(input.muscles)) {
    const row: ExerciseMuscle = {
      exercise_id: exercise.id,
      muscle_id: muscleId,
      user_id: userId,
      weight: WEIGHT[role],
      updated_at: now,
      deleted_at: null,
    }
    changes.push({ table: 'exercise_muscles', row })
  }
  for (const m of current) {
    if (!m.deleted_at && !(m.muscle_id in input.muscles))
      changes.push(deletion('exercise_muscles', m))
  }

  await save(changes)
  return exercise
}

export async function deleteCustomExercise(exercise: Exercise): Promise<void> {
  await save([deletion('exercises', exercise)])
}
