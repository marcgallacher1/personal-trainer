import type { PlanScheduleRow } from '../../lib/plans/instantiate'
import { toggleWeekday } from './data'

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** Mon–Sun toggles assigning a plan version to days of the week. */
export function WeekdayPicker({
  planId,
  sessionId,
  schedule,
}: {
  planId: string
  sessionId: string
  schedule: PlanScheduleRow[]
}) {
  return (
    <div className="grid grid-cols-7 gap-1">
      {WEEKDAYS.map((d, i) => {
        const on = schedule.some(
          (s) => s.plan_session_id === sessionId && s.weekday === i + 1 && !s.deleted_at,
        )
        return (
          <button
            key={d}
            type="button"
            aria-pressed={on}
            aria-label={`${on ? 'Unschedule' : 'Schedule'} on ${d}`}
            onClick={() => void toggleWeekday(planId, sessionId, i + 1, schedule)}
            className={`h-9 rounded-lg text-xs font-semibold ${
              on ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-muted'
            }`}
          >
            {d}
          </button>
        )
      })}
    </div>
  )
}
