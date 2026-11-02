import { useState } from 'react'
import { Stepper } from '../../components/Stepper'
import type { DaysMode, Rule, Tone } from '../../lib/notify/rules'
import { TONES } from './data'

const DAY = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** An hour after `t` (capped at 23:00), or 18:00. */
const laterThan = (t: string | undefined): string => {
  if (!t) return '18:00'
  const [h, m] = t.split(':').map(Number)
  return `${String(Math.min(23, h! + 1)).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** Edits one notification rule. Every change is passed straight to `onChange`. */
export function RuleEditor({ rule, onChange }: { rule: Rule; onChange: (r: Rule) => void }) {
  const set = (patch: Partial<Rule>) => onChange({ ...rule, ...patch })
  const t = rule.type
  const timed = t !== 'log_session' && t !== 'plan_proposal'

  return (
    <div className="flex flex-col gap-5">
      <Toggle label="On" checked={rule.enabled} onChange={(enabled) => set({ enabled })} />
      {!rule.enabled ? null : (
        <>
          {t === 'log_session' && (
            <Field label="Nudge after (minutes)">
              <Stepper
                label="minutes after starting"
                value={rule.afterStartMinutes}
                step={15}
                min={15}
                onChange={(afterStartMinutes) => set({ afterStartMinutes })}
              />
            </Field>
          )}

          {t === 'celebration' && (
            <Field label="Celebrate">
              <div className="flex flex-col gap-2">
                <Toggle
                  label="New PBs, straight after the workout"
                  checked={rule.celebrate.pbs}
                  onChange={(pbs) => set({ celebrate: { ...rule.celebrate, pbs } })}
                />
                <Toggle
                  label="Streaks (every 4 weeks)"
                  checked={rule.celebrate.streaks}
                  onChange={(streaks) => set({ celebrate: { ...rule.celebrate, streaks } })}
                />
                <Toggle
                  label="Goal countdown (100, 60, 30, 21, 14, 7, 3 and 1 days)"
                  checked={rule.celebrate.countdown}
                  onChange={(countdown) => set({ celebrate: { ...rule.celebrate, countdown } })}
                />
              </div>
            </Field>
          )}

          {timed && (
            <Field
              label={t === 'celebration' ? 'Streak and countdown time' : 'Times'}
              hint={t === 'gym' ? 'One reminder at each time.' : undefined}
            >
              <TimeList times={rule.times} onChange={(times) => set({ times })} />
            </Field>
          )}

          {(t === 'gym' || t === 'protein' || t === 'bodyweight' || t === 'weekly_rundown') && (
            <Field label="Days">
              <DaysPicker
                mode={rule.days}
                weekdays={rule.weekdays}
                allowPlan={t === 'gym'}
                onChange={(days, weekdays) => set({ days, weekdays })}
              />
            </Field>
          )}

          {t === 'gym' && <WeekdayTimes rule={rule} onChange={(byWeekday) => set({ byWeekday })} />}

          {(t === 'gym' || t === 'bodyweight') && (
            <>
              <Toggle
                label="Skip if already done that day"
                checked={rule.skipIfLogged}
                onChange={(skipIfLogged) => set({ skipIfLogged })}
              />
              <Field
                label="Follow-ups"
                hint={
                  t === 'gym'
                    ? '“Log it or go” if nothing’s logged by then.'
                    : 'Another reminder if you haven’t weighed in.'
                }
              >
                <TimeList times={rule.followUps} onChange={(followUps) => set({ followUps })} />
              </Field>
            </>
          )}

          {t === 'missed_workout' && (
            <Toggle
              label="Suggest another day (tomorrow morning or a free day)"
              checked={rule.suggestReschedule}
              onChange={(suggestReschedule) => set({ suggestReschedule })}
            />
          )}

          {t === 'protein' && (
            <Toggle
              label="Show grams left for the day"
              checked={rule.showRemaining}
              onChange={(showRemaining) => set({ showRemaining })}
            />
          )}

          {t !== 'plan_proposal' && t !== 'weekly_rundown' && t !== 'celebration' && (
            <>
              <Field label="Tone">
                <div className="flex flex-col gap-2">
                  {TONES.map((tone) => (
                    <button
                      key={tone.id}
                      type="button"
                      aria-pressed={rule.tone === tone.id}
                      onClick={() => set({ tone: tone.id as Tone })}
                      className={`flex min-h-12 flex-col justify-center rounded-xl px-4 py-2 text-left ${
                        rule.tone === tone.id ? 'bg-accent text-accent-fg' : 'bg-surface'
                      }`}
                    >
                      <span className="font-semibold">{tone.name}</span>
                      <span
                        className={`text-xs ${rule.tone === tone.id ? 'opacity-80' : 'text-muted'}`}
                      >
                        {tone.example}
                      </span>
                    </button>
                  ))}
                </div>
              </Field>
              <CustomMessages
                messages={rule.customMessages}
                onChange={(customMessages) => set({ customMessages })}
              />
            </>
          )}
        </>
      )}
    </div>
  )
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <section>
      <h3 className="mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">{label}</h3>
      {children}
      {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
    </section>
  )
}

export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-12 items-center gap-3 rounded-xl bg-surface px-4 py-2 text-left"
    >
      <span className="min-w-0 flex-1">{label}</span>
      <span
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-surface-2 ring-1 ring-border'}`}
      >
        <span
          className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${checked ? 'left-5.5' : 'left-0.5'}`}
        />
      </span>
    </button>
  )
}

const sorted = (xs: string[]) => [...new Set(xs)].toSorted()

/** A list of HH:MM times with add and remove. */
export function TimeList({
  times,
  onChange,
}: {
  times: string[]
  onChange: (t: string[]) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {times.map((time, i) => (
        <span key={`${time}-${i}`} className="flex items-center gap-1 rounded-xl bg-surface pl-3">
          <input
            type="time"
            value={time}
            aria-label={`Time ${i + 1}`}
            onChange={(e) => {
              if (!e.target.value) return
              onChange(sorted(times.map((x, j) => (j === i ? e.target.value : x))))
            }}
            className="h-11 bg-transparent text-lg tabular-nums outline-none"
          />
          <button
            type="button"
            aria-label={`Remove ${time}`}
            onClick={() => onChange(times.filter((_, j) => j !== i))}
            className="h-11 w-10 text-muted"
          >
            ✕
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={() => onChange(sorted([...times, laterThan(times.at(-1))]))}
        className="h-11 rounded-xl border border-dashed border-border px-4 text-sm font-semibold text-muted"
      >
        + Add time
      </button>
    </div>
  )
}

function DaysPicker({
  mode,
  weekdays,
  allowPlan,
  onChange,
}: {
  mode: DaysMode
  weekdays: number[]
  allowPlan: boolean
  onChange: (mode: DaysMode, weekdays: number[]) => void
}) {
  const modes: { id: DaysMode; name: string }[] = [
    ...(allowPlan ? [{ id: 'plan' as const, name: 'Plan days' }] : []),
    { id: 'all', name: 'Every day' },
    { id: 'custom', name: 'Pick days' },
  ]
  return (
    <div className="flex flex-col gap-2">
      <div
        className={`grid gap-1 rounded-xl bg-surface-2 p-1 ${allowPlan ? 'grid-cols-3' : 'grid-cols-2'}`}
      >
        {modes.map((m) => (
          <button
            key={m.id}
            type="button"
            aria-pressed={mode === m.id}
            onClick={() => onChange(m.id, weekdays)}
            className={`h-10 rounded-lg text-sm font-semibold ${mode === m.id ? 'bg-bg shadow-sm' : 'text-muted'}`}
          >
            {m.name}
          </button>
        ))}
      </div>
      {mode === 'plan' && (
        <p className="text-xs text-muted">
          Days your active plan has a workout. With no plan switched on, every day.
        </p>
      )}
      {mode === 'custom' && (
        <div className="grid grid-cols-7 gap-1">
          {DAY.map((d, i) => {
            const on = weekdays.includes(i + 1)
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  onChange(
                    'custom',
                    on
                      ? weekdays.filter((x) => x !== i + 1)
                      : [...weekdays, i + 1].toSorted((a, b) => a - b),
                  )
                }
                className={`h-10 rounded-lg text-xs font-bold ${on ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-muted'}`}
              >
                {d}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** Different times on particular days, e.g. Saturday 10:00. */
function WeekdayTimes({
  rule,
  onChange,
}: {
  rule: Rule
  onChange: (b: Rule['byWeekday']) => void
}) {
  const [open, setOpen] = useState(Object.keys(rule.byWeekday).length > 0)
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-11 rounded-xl border border-dashed border-border text-sm font-semibold text-muted"
      >
        + Different times on some days
      </button>
    )
  }
  return (
    <Field label="Different times on some days">
      <ul className="flex flex-col divide-y divide-border rounded-xl bg-surface">
        {DAY.map((d, i) => {
          const times = rule.byWeekday[i + 1]
          return (
            <li key={d} className="flex items-center gap-3 px-3 py-2">
              <span className="w-10 font-semibold">{d}</span>
              {times ? (
                <div className="min-w-0 flex-1">
                  <TimeList
                    times={times}
                    onChange={(next) => {
                      const b = { ...rule.byWeekday }
                      if (next.length) b[i + 1] = next
                      else delete b[i + 1]
                      onChange(b)
                    }}
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => onChange({ ...rule.byWeekday, [i + 1]: [...rule.times] })}
                  className="flex-1 text-left text-sm text-muted"
                >
                  Same as usual · change
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </Field>
  )
}

function CustomMessages({
  messages,
  onChange,
}: {
  messages: string[]
  onChange: (m: string[]) => void
}) {
  return (
    <Field
      label="Your own messages (optional)"
      hint="One per line. Mixed in with the built-in ones. Use {workout} for today’s workout."
    >
      <textarea
        defaultValue={messages.join('\n')}
        rows={3}
        placeholder="e.g. Beach body loading…"
        onBlur={(e) =>
          onChange(
            e.target.value
              .split('\n')
              .map((l) => l.trim())
              .filter(Boolean),
          )
        }
        className="w-full resize-none rounded-2xl bg-surface p-4 outline-none"
      />
    </Field>
  )
}
