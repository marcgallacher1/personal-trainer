import { Link } from 'react-router'
import { PageTitle } from '../../app/Layout'
import { Stepper } from '../../components/Stepper'
import { useMuscles } from '../../db/queries'
import { setMuscleFlags, updateProfile, useMuscleTargets, useProfile } from '../plans/data'

const BODY_GOALS = [
  { id: 'bulk', name: 'Bulk', hint: 'Calorie surplus to gain size, accepting some fat.' },
  { id: 'lean_bulk', name: 'Lean bulk', hint: 'Small surplus — build muscle, minimise fat gain.' },
  { id: 'maintain', name: 'Maintain', hint: 'Hold your weight; recomp slowly.' },
  { id: 'cut', name: 'Cut', hint: 'Calorie deficit to lose fat while keeping muscle.' },
] as const

const FOCUS = [
  { id: 'hypertrophy', name: 'Build muscle', hint: 'Mostly 6–15 reps, close to failure.' },
  { id: 'strength', name: 'Strength', hint: 'Heavier, lower reps on the big lifts.' },
  { id: 'general', name: 'General fitness', hint: 'A balanced mix.' },
] as const

export function GoalsScreen() {
  const profile = useProfile()
  const muscles = useMuscles()
  const targets = useMuscleTargets()

  if (profile === undefined) return null
  if (profile === null) {
    return (
      <p className="py-12 text-center text-muted">
        Your profile hasn’t synced yet. Try again in a moment.
      </p>
    )
  }

  const byMuscle = new Map((targets ?? []).map((t) => [t.muscle_id, t]))

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link to="/more" className="text-sm text-accent">
          ‹ More
        </Link>
        <PageTitle>Goals</PageTitle>
        <p className="-mt-2 text-sm text-muted">
          These shape your plan rating, weekly report and suggestions. Change them any time.
        </p>
      </div>

      <Section title="Body goal">
        <div className="grid grid-cols-2 gap-2">
          {BODY_GOALS.map((g) => (
            <Option
              key={g.id}
              name={g.name}
              hint={g.hint}
              selected={profile.body_goal === g.id}
              onClick={() => void updateProfile(profile, { body_goal: g.id })}
            />
          ))}
        </div>
      </Section>

      <Section title="Training focus">
        <div className="flex flex-col gap-2">
          {FOCUS.map((f) => (
            <Option
              key={f.id}
              name={f.name}
              hint={f.hint}
              selected={profile.goal === f.id}
              onClick={() => void updateProfile(profile, { goal: f.id })}
            />
          ))}
        </div>
      </Section>

      <Section title="Workouts per week" hint="Your weekly target on the Today screen.">
        <Stepper
          label="workouts per week"
          value={profile.sessions_per_week}
          step={1}
          min={1}
          onChange={(v) =>
            void updateProfile(profile, { sessions_per_week: Math.min(14, Math.max(1, v)) })
          }
        />
      </Section>

      <Section
        title="Muscle focus"
        hint="Priority: muscles you want to bring up (get a higher target). Paused: muscles you’re deliberately not training for now — they won’t be flagged as missing."
      >
        <ul className="flex flex-col divide-y divide-border rounded-2xl bg-surface">
          {(muscles ?? []).map((m) => {
            const t = byMuscle.get(m.id)
            const state = t?.paused ? 'paused' : t?.priority ? 'priority' : 'normal'
            return (
              <li key={m.id} className="flex items-center gap-2 px-4 py-2">
                <span className="min-w-0 flex-1 truncate">{m.name}</span>
                <div className="grid grid-cols-3 gap-1 rounded-lg bg-surface-2 p-0.5 text-xs font-semibold">
                  {(['normal', 'priority', 'paused'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={!t}
                      aria-pressed={state === s}
                      onClick={() =>
                        t &&
                        void setMuscleFlags(t, {
                          priority: s === 'priority',
                          paused: s === 'paused',
                        })
                      }
                      className={`h-8 rounded-md px-2 ${
                        state === s
                          ? s === 'priority'
                            ? 'bg-accent text-accent-fg'
                            : s === 'paused'
                              ? 'bg-bg text-muted shadow-sm'
                              : 'bg-bg shadow-sm'
                          : 'text-muted'
                      }`}
                    >
                      {s === 'normal' ? 'Normal' : s === 'priority' ? 'Priority' : 'Paused'}
                    </button>
                  ))}
                </div>
              </li>
            )
          })}
        </ul>
      </Section>
    </div>
  )
}

function Section({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <section>
      <h2 className="mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">{title}</h2>
      {hint && <p className="mb-2 text-xs text-muted">{hint}</p>}
      {children}
    </section>
  )
}

function Option({
  name,
  hint,
  selected,
  onClick,
}: {
  name: string
  hint: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`flex min-h-16 flex-col justify-center rounded-xl px-4 py-2 text-left ${
        selected ? 'bg-accent text-accent-fg' : 'bg-surface'
      }`}
    >
      <span className="font-semibold">{name}</span>
      <span className={`text-xs ${selected ? 'opacity-80' : 'text-muted'}`}>{hint}</span>
    </button>
  )
}
