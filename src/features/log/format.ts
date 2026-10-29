import type { Session } from '../../db/queries'

const TZ = 'Europe/London'

/** "42 min" / "1 h 05 min". Open sessions are measured to `now`. */
export function formatDuration(startIso: string, endIso: string | null, now = Date.now()): string {
  const end = endIso ? Date.parse(endIso) : now
  const mins = Math.max(0, Math.round((end - Date.parse(startIso)) / 60_000))
  if (mins < 60) return `${mins} min`
  return `${Math.floor(mins / 60)} h ${String(mins % 60).padStart(2, '0')} min`
}

/** Default title for an unnamed workout, e.g. "Wed evening workout". */
export function sessionTitle(session: Pick<Session, 'name' | 'started_at'>): string {
  if (session.name) return session.name
  const d = new Date(session.started_at)
  const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: TZ }).format(d)
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: TZ }).format(d),
  )
  const part = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'
  return `${weekday} ${part} workout`
}

/** YYYY-MM-DD in Europe/London (training days follow local time, not UTC). */
export function londonDate(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso))
}
