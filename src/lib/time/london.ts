/** UTC ISO time for a London wall-clock date and time (handles BST/GMT). */
export function londonToIso(date: string, time: string): string {
  const [y, mo, d] = date.split('-').map(Number)
  const [h, mi] = time.split(':').map(Number)
  const guess = Date.UTC(y!, mo! - 1, d!, h!, mi!)
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(guess))
  const lh = Number(parts.find((p) => p.type === 'hour')?.value)
  const lm = Number(parts.find((p) => p.type === 'minute')?.value)
  const offsetMin = ((lh * 60 + lm - (h! * 60 + mi!) + 1440 + 720) % 1440) - 720
  return new Date(guess - offsetMin * 60_000).toISOString()
}
