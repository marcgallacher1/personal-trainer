import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { BackButton } from '../../components/BackButton'
import { Confirm } from '../../components/Confirm'
import { Sheet } from '../../components/Sheet'
import { showToast } from '../../components/Toast'
import {
  DAY_NAMES,
  sourceKey,
  titleFor,
  toggleDraftDay,
  weekSummary,
  type DraftItem,
  type WorkoutSource,
} from '../../lib/plans/draft'
import { TEMPLATES, versionTitle, type PlanTemplate } from '../../lib/plans/templates'
import { savePlanFromDraft, togglePlanDay, usePlanRows, usePlans } from './data'

const DRAFT_KEY = 'trainer-plan-draft'

function loadDraft(): DraftItem[] {
  try {
    return JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? '[]') as DraftItem[]
  } catch {
    return []
  }
}

/**
 * Build a plan: pick a workout type → pick a workout → tap the day(s) it's on. Repeat, then save.
 * /plans/new builds a new plan (kept as a draft until saved); /plans/:planId/add adds to an existing one.
 */
export function PlanBuilderScreen() {
  const { planId } = useParams()
  const navigate = useNavigate()
  const existing = usePlanRows(planId)
  const allPlans = usePlans()
  const [draft, setDraft] = useState<DraftItem[]>(() => (planId ? [] : loadDraft()))
  const [category, setCategory] = useState<PlanTemplate | 'custom' | null>(null)
  const [customName, setCustomName] = useState('')
  const [customs, setCustoms] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  useEffect(() => {
    if (!planId) sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  }, [draft, planId])

  // What's in the plan so far (draft, or the existing plan's workouts and days)
  const items: { key: string; title: string; weekdays: number[] }[] = planId
    ? (existing?.sessions ?? []).map((s) => ({
        key: s.name.toLowerCase(),
        title: s.name,
        weekdays: (existing?.schedule ?? [])
          .filter((d) => d.plan_session_id === s.id && d.weekday !== null)
          .map((d) => d.weekday!),
      }))
    : draft.map((d) => ({ key: d.key, title: d.title, weekdays: d.weekdays }))

  const daysFor = (source: WorkoutSource): number[] => {
    if (!planId) return draft.find((d) => d.key === sourceKey(source))?.weekdays ?? []
    return items.find((i) => i.key === titleFor(source).toLowerCase())?.weekdays ?? []
  }

  async function toggle(source: WorkoutSource, weekday: number) {
    const title = titleFor(source)
    const day = DAY_NAMES[weekday - 1]
    let added: boolean
    if (planId) {
      added = (await togglePlanDay(planId, source, weekday)) === 'added'
    } else {
      const r = toggleDraftDay(draft, source, weekday)
      setDraft(r.draft)
      added = r.added
    }
    showToast({
      message: added ? `${title} added to plan (${day})` : `${title} removed from ${day}`,
    })
  }

  function leave() {
    if (category) {
      setCategory(null)
      return
    }
    if (!planId && draft.length > 0) setConfirmDiscard(true)
    else void navigate(planId ? `/plans/${planId}` : '/plans', { replace: true })
  }

  const hasActive = (allPlans ?? []).some((p) => p.is_active)

  return (
    <div className="flex flex-col gap-4 pb-28">
      {category ? (
        <button
          type="button"
          onClick={() => setCategory(null)}
          className="-ml-2 flex h-10 items-center gap-1 self-start px-2 text-base font-semibold text-accent"
        >
          <span className="text-2xl leading-none">‹</span> All workouts
        </button>
      ) : planId ? (
        <BackButton fallback={`/plans/${planId}`} label={existing?.plan.name ?? 'Plan'} />
      ) : (
        <button
          type="button"
          onClick={leave}
          className="-ml-2 flex h-10 items-center gap-1 self-start px-2 text-base font-semibold text-accent"
        >
          <span className="text-2xl leading-none">‹</span> Plans
        </button>
      )}

      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {category === 'custom'
            ? 'Your own workout'
            : category
              ? category.name
              : planId
                ? `Add to ${existing?.plan.name ?? 'plan'}`
                : 'New plan'}
        </h1>
        <p className="text-sm text-muted">
          {category
            ? 'Tap the day(s) you’ll do it on to add it to your plan.'
            : 'Pick a workout, then choose its day. Repeat for each day you train.'}
        </p>
      </div>

      {/* Step 1: workout types */}
      {!category && (
        <ul className="flex flex-col gap-2">
          {[...TEMPLATES]
            .toSorted((a, b) => Number(Boolean(b.suggested)) - Number(Boolean(a.suggested)))
            .map((t) => {
              const chosen = t.sessions.filter((s) =>
                items.some(
                  (i) => i.title.toLowerCase() === versionTitle(t.name, s.name).toLowerCase(),
                ),
              )
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => setCategory(t)}
                    className="flex w-full items-center gap-3 rounded-2xl bg-surface p-4 text-left active:opacity-80"
                  >
                    <span className="text-2xl">{t.sessions[0]?.emoji}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-lg font-bold">{t.name}</span>
                      <span className="block text-sm text-muted">{t.description}</span>
                      {chosen.length > 0 && (
                        <span className="mt-1 block text-xs font-semibold text-accent">
                          ✓ In plan: {chosen.map((s) => versionTitle(t.name, s.name)).join(', ')}
                        </span>
                      )}
                    </span>
                    <span className="text-2xl text-muted">›</span>
                  </button>
                </li>
              )
            })}
          <li>
            <button
              type="button"
              onClick={() => setCategory('custom')}
              className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-border p-4 text-left"
            >
              <span className="text-2xl">✏️</span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-bold">Create your own</span>
                <span className="block text-sm text-muted">
                  Name it, pick a day, then add your exercises.
                </span>
              </span>
              <span className="text-2xl text-muted">›</span>
            </button>
          </li>
        </ul>
      )}

      {/* Step 2: preset workouts in a type */}
      {category && category !== 'custom' && (
        <div className="flex flex-col gap-3">
          {category.sessions.map((s) => {
            const source: WorkoutSource = {
              kind: 'preset',
              templateId: category.id,
              version: s.name,
            }
            return (
              <section key={s.name} className="rounded-3xl bg-surface p-4">
                <div className="flex items-start gap-3">
                  <span className="text-3xl">{s.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-xl font-bold">{versionTitle(category.name, s.name)}</h2>
                    <p className="text-sm text-muted">{s.description}</p>
                  </div>
                </div>
                <ul className="mt-3 flex flex-col gap-0.5 text-sm">
                  {s.exercises.map((e) => (
                    <li key={e.name} className="flex justify-between gap-3">
                      <span className="truncate">{e.name}</span>
                      <span className="shrink-0 text-muted">
                        {e.sets} × {e.min}–{e.max}
                      </span>
                    </li>
                  ))}
                </ul>
                <DayButtons selected={daysFor(source)} onToggle={(d) => void toggle(source, d)} />
              </section>
            )
          })}
          <p className="text-center text-xs text-muted">
            You can change any exercise, set or rep target after saving.
          </p>
        </div>
      )}

      {/* Step 2b: your own workout */}
      {category === 'custom' && (
        <div className="flex flex-col gap-3">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              const name = customName.trim()
              if (name && !customs.includes(name)) setCustoms([...customs, name])
              setCustomName('')
            }}
          >
            <input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="Name, e.g. Arms"
              className="h-12 min-w-0 flex-1 rounded-xl border border-border bg-surface px-4 outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={!customName.trim()}
              className="h-12 rounded-xl bg-accent px-4 font-bold text-accent-fg disabled:opacity-40"
            >
              Add
            </button>
          </form>
          {customs.map((name) => {
            const source: WorkoutSource = { kind: 'custom', name }
            return (
              <section key={name} className="rounded-3xl bg-surface p-4">
                <h2 className="text-xl font-bold">{name}</h2>
                <p className="text-sm text-muted">
                  Starts empty — add exercises from the plan once it’s saved.
                </p>
                <DayButtons selected={daysFor(source)} onToggle={(d) => void toggle(source, d)} />
              </section>
            )
          })}
        </div>
      )}

      {/* Pinned summary + save */}
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 border-t border-border bg-bg/95 px-safe py-3 backdrop-blur">
        <div className="mx-auto flex max-w-xl flex-col gap-2">
          <p className="truncate text-sm text-muted">
            {items.some((i) => i.weekdays.length)
              ? `Your week: ${weekSummary(items)}`
              : 'Nothing added yet — pick a workout, then a day.'}
          </p>
          {planId ? (
            <button
              type="button"
              onClick={() => void navigate(`/plans/${planId}`, { replace: true })}
              className="h-12 rounded-xl bg-accent text-lg font-bold text-accent-fg"
            >
              Done
            </button>
          ) : (
            <button
              type="button"
              disabled={draft.length === 0}
              onClick={() => setSaving(true)}
              className="h-12 rounded-xl bg-accent text-lg font-bold text-accent-fg disabled:bg-surface-2 disabled:text-muted"
            >
              Save plan
            </button>
          )}
        </div>
      </div>

      {saving && (
        <SaveSheet
          defaultActive={!hasActive}
          onCancel={() => setSaving(false)}
          onSave={async (name, active) => {
            const id = await savePlanFromDraft(name, draft, active)
            sessionStorage.removeItem(DRAFT_KEY)
            showToast({ message: active ? 'Plan saved and active' : 'Plan saved' })
            void navigate(`/plans/${id}`, { replace: true })
          }}
        />
      )}

      <Confirm
        open={confirmDiscard}
        title="Discard this plan?"
        body="You haven’t saved it yet."
        confirmLabel="Discard"
        onCancel={() => setConfirmDiscard(false)}
        onConfirm={() => {
          sessionStorage.removeItem(DRAFT_KEY)
          void navigate('/plans', { replace: true })
        }}
      />
    </div>
  )
}

function DayButtons({ selected, onToggle }: { selected: number[]; onToggle: (d: number) => void }) {
  return (
    <div className="mt-4">
      <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted uppercase">
        {selected.length ? 'On' : 'Add to plan on'}
      </p>
      <div className="grid grid-cols-7 gap-1">
        {DAY_NAMES.map((d, i) => {
          const on = selected.includes(i + 1)
          return (
            <button
              key={d}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(i + 1)}
              className={`h-11 rounded-lg text-xs font-bold ${
                on ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-muted'
              }`}
            >
              {d}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function SaveSheet({
  defaultActive,
  onCancel,
  onSave,
}: {
  defaultActive: boolean
  onCancel: () => void
  onSave: (name: string, active: boolean) => Promise<void>
}) {
  const [name, setName] = useState('My plan')
  const [active, setActive] = useState(defaultActive)
  const [busy, setBusy] = useState(false)
  return (
    <Sheet open title="Save plan" closeLabel="Cancel" onClose={onCancel}>
      <div className="flex flex-col gap-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold tracking-wide text-muted uppercase">
            Plan name
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-14 rounded-xl border border-border bg-surface px-4 text-lg outline-none focus:border-accent"
          />
        </label>
        <ActiveToggle active={active} onChange={setActive} />
        <button
          type="button"
          disabled={busy || !name.trim()}
          onClick={async () => {
            setBusy(true)
            await onSave(name, active)
          }}
          className="h-14 rounded-2xl bg-accent text-lg font-bold text-accent-fg disabled:opacity-40"
        >
          {busy ? 'Saving…' : 'Save plan'}
        </button>
      </div>
    </Sheet>
  )
}

/** On/off switch for "active plan", with what it means. */
export function ActiveToggle({
  active,
  onChange,
}: {
  active: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      onClick={() => onChange(!active)}
      className="flex items-center gap-3 rounded-2xl bg-surface p-4 text-left"
    >
      <span className="min-w-0 flex-1">
        <span className="block font-bold">Active plan</span>
        <span className="block text-sm text-muted">
          {active
            ? 'Today shows this plan’s workout for the day.'
            : 'Off — you can still start any of its workouts, or just log freely.'}
        </span>
      </span>
      <span
        className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${active ? 'bg-accent' : 'bg-surface-2'}`}
      >
        <span
          className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${active ? 'left-7' : 'left-1'}`}
        />
      </span>
    </button>
  )
}
