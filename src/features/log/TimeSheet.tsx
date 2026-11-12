import { useState } from 'react'
import { Sheet } from '../../components/Sheet'
import type { Session } from '../../db/queries'
import { londonToIso } from '../../lib/time/london'
import { updateSession } from './actions'
import { londonDate } from './format'

const HHMM = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

const INPUT =
  'h-full min-w-0 flex-1 appearance-none bg-transparent text-right text-lg tabular-nums outline-none'

/** Fix when a workout was: its day and start time, and for a saved one how long it lasted. */
export function TimeSheet({ session, onClose }: { session: Session; onClose: () => void }) {
  const [today] = useState(() => londonDate(new Date().toISOString()))
  const [date, setDate] = useState(londonDate(session.started_at))
  const [time, setTime] = useState(HHMM.format(new Date(session.started_at)))
  const [minutes, setMinutes] = useState(
    session.ended_at
      ? Math.max(
          1,
          Math.round((Date.parse(session.ended_at) - Date.parse(session.started_at)) / 60_000),
        )
      : 0,
  )

  async function save() {
    const started_at = londonToIso(date, time)
    await updateSession(session, {
      started_at,
      ended_at: session.ended_at
        ? new Date(Date.parse(started_at) + minutes * 60_000).toISOString()
        : null,
    })
    onClose()
  }

  return (
    <Sheet
      open
      title="Workout time"
      subtitle={session.ended_at ? 'When it was and how long it took.' : 'When you started.'}
      closeLabel="Cancel"
      onClose={onClose}
      footer={
        <button
          type="button"
          disabled={Boolean(session.ended_at) && minutes <= 0}
          onClick={() => void save()}
          className="h-14 w-full rounded-2xl bg-accent text-lg font-bold text-accent-fg disabled:opacity-40"
        >
          Save
        </button>
      }
    >
      <div className="flex flex-col gap-2">
        <Row label="Day">
          <input
            type="date"
            value={date}
            max={today}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className={INPUT}
          />
        </Row>
        <Row label="Started">
          <input
            type="time"
            value={time}
            onChange={(e) => e.target.value && setTime(e.target.value)}
            className={INPUT}
          />
        </Row>
        {session.ended_at && (
          <Row label="Minutes">
            <input
              inputMode="numeric"
              value={minutes || ''}
              onFocus={(e) => e.target.select()}
              onChange={(e) => setMinutes(Math.min(600, Math.round(Number(e.target.value) || 0)))}
              className={INPUT}
            />
          </Row>
        )}
      </div>
    </Sheet>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex h-14 items-center gap-3 rounded-xl bg-surface px-4 focus-within:ring-2 focus-within:ring-accent">
      <span className="shrink-0 font-semibold">{label}</span>
      {children}
    </label>
  )
}
