import { useState } from 'react'
import { Link } from 'react-router'
import { PageTitle } from '../../app/Layout'
import { Stepper } from '../../components/Stepper'
import { showToast } from '../../components/Toast'
import { useMuscles } from '../../db/queries'
import { save, type Change } from '../../db/write'
import { useMuscleTargets, useProfile, type MuscleTarget, type Profile } from '../plans/data'

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

type MuscleState = 'normal' | 'priority' | 'paused'

interface Draft {
  body_goal: string | null
  goal: string | null
  sessions_per_week: number
  muscles: Record<string, MuscleState>
}

const stateOf = (t: MuscleTarget): MuscleState =>
  t.paused ? 'paused' : t.priority ? 'priority' : 'normal'

function toDraft(profile: Profile, targets: MuscleTarget[]): Draft {
  return {
    body_goal: profile.body_goal,
    goal: profile.goal,
    sessions_per_week: profile.sessions_per_week,
    muscles: Object.fromEntries(targets.map((t) => [t.muscle_id, stateOf(t)])),
  }
}

export function GoalsScreen() {
  const profile = useProfile()
  const targets = useMuscleTargets()

  if (profile === undefined || targets === undefined) return null
  if (profile === null) {
    return (
      <p className="py-12 text-center text-muted">
        Your profile hasn’t synced yet. Try again in a moment.
      </p>
    )
  }
  // Re-key on save so the draft resets to the saved values
  return <GoalsForm key={profile.updated_at} profile={profile} targets={targets} />
}

function GoalsForm({ profile, targets }: { profile: Profile; targets: MuscleTarget[] }) {
  const muscles = useMuscles()
  const [saved] = useState(() => toDraft(profile, targets))
  const [draft, setDraft] = useState<Draft>(saved)
  const [busy, setBusy] = useState(false)
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved)

  async function onSave() {
    setBusy(true)
    const changes: Change[] = [
      {
        table: 'profiles',
        row: {
          ...profile,
          body_goal: draft.body_goal,
          goal: draft.goal,
          sessions_per_week: draft.sessions_per_week,
        },
      },
    ]
    for (const t of targets) {
      const next = draft.muscles[t.muscle_id] ?? 'normal'
      if (next !== stateOf(t)) {
        changes.push({
          table: 'muscle_targets',
          row: { ...t, priority: next === 'priority', paused: next === 'paused' },
        })
      }
    }
    await save(changes)
    setBusy(false)
    showToast({ message: 'Goals saved' })
  }

  return (
    <div className="flex flex-col gap-6 pb-20">
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
              selected={draft.body_goal === g.id}
              onClick={() => setDraft({ ...draft, body_goal: g.id })}
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
              selected={draft.goal === f.id}
              onClick={() => setDraft({ ...draft, goal: f.id })}
            />
          ))}
        </div>
      </Section>

      <Section title="Workouts per week" hint="Your weekly target on the Today screen.">
        <Stepper
          label="workouts per week"
          value={draft.sessions_per_week}
          step={1}
          min={1}
          onChange={(v) => setDraft({ ...draft, sessions_per_week: Math.min(14, Math.max(1, v)) })}
        />
      </Section>

      <Section
        title="Muscle focus"
        hint="Priority: muscles you want to bring up (get a higher target). Paused: muscles you’re deliberately not training for now — they won’t be flagged as missing."
      >
        <ul className="flex flex-col divide-y divide-border rounded-2xl bg-surface">
          {(muscles ?? []).map((m) => {
            const state = draft.muscles[m.id] ?? 'normal'
            return (
              <li
                key={m.id}
                className={`flex items-center gap-2 px-4 py-2 transition-colors ${
                  state === 'paused' ? 'bg-surface-2/60' : ''
                }`}
              >
                <span
                  className={`min-w-0 flex-1 truncate ${
                    state === 'paused' ? 'text-muted line-through decoration-muted/50' : ''
                  }`}
                >
                  {m.name}
                </span>
                <div className="grid grid-cols-3 gap-1 rounded-lg bg-surface-2 p-0.5 text-xs font-semibold">
                  {(['normal', 'priority', 'paused'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      aria-pressed={state === s}
                      onClick={() =>
                        setDraft({ ...draft, muscles: { ...draft.muscles, [m.id]: s } })
                      }
                      className={`h-8 rounded-md px-2 ${
                        state === s
                          ? s === 'priority'
                            ? 'bg-accent text-accent-fg'
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

      {/* Pinned above the tab bar */}
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 border-t border-border bg-bg/95 px-safe py-3 backdrop-blur">
        <div className="mx-auto flex max-w-xl gap-2">
          {dirty && (
            <button
              type="button"
              className="h-12 rounded-xl bg-surface-2 px-4 font-semibold"
              onClick={() => setDraft(saved)}
            >
              Discard
            </button>
          )}
          <button
            type="button"
            disabled={!dirty || busy}
            onClick={() => void onSave()}
            className="h-12 flex-1 rounded-xl bg-accent text-lg font-bold text-accent-fg disabled:bg-surface-2 disabled:text-muted"
          >
            {busy ? 'Saving…' : dirty ? 'Save goals' : 'Saved ✓'}
          </button>
        </div>
      </div>
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
