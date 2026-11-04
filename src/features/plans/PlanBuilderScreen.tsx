import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { BackButton } from '../../components/BackButton'
import { Confirm } from '../../components/Confirm'
import { Sheet } from '../../components/Sheet'
import { showToast, useInlineToast } from '../../components/Toast'
import type { Exercise } from '../../db/queries'
import { asLogType } from '../../lib/logging/logTypes'
import {
  DAY_NAMES,
  replaceDraftSource,
  sourceKey,
  titleFor,
  toggleDraftDay,
  weekSummary,
  type DraftItem,
  type WorkoutSource,
} from '../../lib/plans/draft'
import { TEMPLATES, versionTitle, type PlanTemplate } from '../../lib/plans/templates'
import { cardioEmoji, cardioName } from '../../lib/cardio'
import { CustomWorkoutCard, type CustomCard } from './CustomWorkoutCard'
import { DayButtons } from './DayButtons'
import {
  addPlanExercise,
  removePlanExercise,
  savePlanFromDraft,
  togglePlanDay,
  updatePlanSession,
  usePlanRows,
  usePlans,
} from './data'

const DRAFT_KEY = 'trainer-plan-draft'
const NAME_KEY = 'trainer-plan-draft-name'

function loadDraft(): DraftItem[] {
  try {
    return JSON.parse(sessionStorage.getItem(DRAFT_KEY) ?? '[]') as DraftItem[]
  } catch {
    return []
  }
}

let cardSeq = 0
const blankCard = (group: string, name: string): CustomCard => ({
  id: `card-${++cardSeq}`,
  group,
  name,
  exercises: [],
  cardio: [],
})

const groupOf = (c: PlanTemplate | 'custom') => (c === 'custom' ? 'own' : c.id)
const defaultCardName = (c: PlanTemplate | 'custom', n: number) =>
  c === 'custom' ? '' : `Custom ${c.name}${n > 0 ? ` ${n + 1}` : ''}`

const customSource = (c: CustomCard): WorkoutSource => ({
  kind: 'custom',
  name: c.name,
  ...(c.group === 'own' ? {} : { templateId: c.group }),
  exercises: c.exercises,
  ...(c.cardio.length ? { cardio: c.cardio } : {}),
})

/** Pick a workout, tap its day(s), repeat, save. Also adds to an existing plan. */
export function PlanBuilderScreen() {
  const { planId } = useParams()
  const navigate = useNavigate()
  const existing = usePlanRows(planId)
  const allPlans = usePlans()
  const [draft, setDraft] = useState<DraftItem[]>(() => (planId ? [] : loadDraft()))
  const [planName, setPlanName] = useState(() => sessionStorage.getItem(NAME_KEY) ?? '')
  const [category, setCategory] = useState<PlanTemplate | 'custom' | null>(null)
  // Your own workouts, made under a type ("Custom Push") or from "Create your own"
  const [cards, setCards] = useState<CustomCard[]>(() =>
    draft.flatMap((d) =>
      d.source.kind === 'custom'
        ? [
            {
              ...blankCard(d.source.templateId ?? 'own', d.source.name),
              exercises: d.source.exercises ?? [],
              cardio: d.source.cardio ?? [],
            },
          ]
        : [],
    ),
  )
  const [saving, setSaving] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  useEffect(() => {
    if (planId) return
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
    sessionStorage.setItem(NAME_KEY, planName)
  }, [draft, planName, planId])

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
      placement: 'inline',
    })
  }

  function openCategory(c: PlanTemplate | 'custom') {
    const group = groupOf(c)
    if (!cards.some((x) => x.group === group))
      setCards([...cards, blankCard(group, defaultCardName(c, 0))])
    setCategory(c)
  }

  function addCard(c: PlanTemplate | 'custom') {
    const n = cards.filter((x) => x.group === groupOf(c)).length
    setCards([...cards, blankCard(groupOf(c), defaultCardName(c, n))])
  }

  /** The saved-plan workout a card became (add mode), if it's been put on a day yet. */
  const savedSessionFor = (c: CustomCard) =>
    existing?.sessions.find((s) => s.name.toLowerCase() === c.name.trim().toLowerCase())

  async function changeCard(
    next: CustomCard,
    picked?: { exercise: Exercise; added: boolean } | { cardio: true },
  ) {
    const prev = cards.find((x) => x.id === next.id)
    if (!prev) return
    setCards(cards.map((x) => (x.id === next.id ? next : x)))
    if (!planId) {
      setDraft((d) => replaceDraftSource(d, sourceKey(customSource(prev)), customSource(next)))
      return
    }
    // Already in the saved plan: keep its exercises in step
    const session = savedSessionFor(prev)
    if (!session || !picked) return
    if ('cardio' in picked) {
      await updatePlanSession(session, { cardio_json: next.cardio as never })
      return
    }
    if (picked.added) {
      await addPlanExercise(session.id, picked.exercise, asLogType(picked.exercise.log_type))
    } else {
      const pe = existing?.exercises.find(
        (e) => e.plan_session_id === session.id && e.exercise_id === picked.exercise.id,
      )
      if (pe) await removePlanExercise(pe)
    }
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
  // Briefly shown in place of the Save button
  const inlineToast = useInlineToast()

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

      {!planId && !category && (
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold tracking-wide text-muted uppercase">
            Plan name
          </span>
          <input
            value={planName}
            onChange={(e) => setPlanName(e.target.value)}
            placeholder="e.g. Upper body block"
            className="h-12 rounded-xl border border-border bg-surface px-4 text-lg outline-none focus:border-accent"
          />
        </label>
      )}

      {/* Step 1: workout types */}
      {!category && (
        <ul className="flex flex-col gap-2">
          {[...TEMPLATES]
            .toSorted((a, b) => Number(Boolean(b.suggested)) - Number(Boolean(a.suggested)))
            .map((t) => {
              const chosen = [
                ...t.sessions
                  .map((s) => versionTitle(t.name, s.name))
                  .filter((title) =>
                    items.some((i) => i.title.toLowerCase() === title.toLowerCase()),
                  ),
                ...cards
                  .filter((c) => c.group === t.id)
                  .map((c) => c.name.trim())
                  .filter((name) =>
                    items.some((i) => i.title.toLowerCase() === name.toLowerCase()),
                  ),
              ]
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => openCategory(t)}
                    className="flex w-full items-center gap-3 rounded-2xl bg-surface p-4 text-left active:opacity-80"
                  >
                    <span className="text-2xl">{t.sessions[0]?.emoji}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-lg font-bold">{t.name}</span>
                      <span className="block text-sm text-muted">{t.description}</span>
                      {chosen.length > 0 && (
                        <span className="mt-1 block text-xs font-semibold text-accent">
                          ✓ In plan: {chosen.join(', ')}
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
              onClick={() => openCategory('custom')}
              className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-border p-4 text-left"
            >
              <span className="text-2xl">✏️</span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-bold">Create your own</span>
                <span className="block text-sm text-muted">
                  Name it, choose its exercises, then pick a day.
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
                  {(s.cardio ?? []).map((c) => (
                    <li key={c.activity} className="flex justify-between gap-3">
                      <span className="truncate">
                        {cardioEmoji(c.activity)} {cardioName(c.activity)}
                      </span>
                      <span className="shrink-0 text-muted">{c.minutes} min</span>
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

      {/* Step 2b: your own workouts, under a type or from scratch */}
      {category && (
        <div className="flex flex-col gap-3">
          {category !== 'custom' && (
            <h2 className="mt-2 text-xs font-semibold tracking-wide text-muted uppercase">
              Or make your own {category.name}
            </h2>
          )}
          {cards
            .filter((c) => c.group === groupOf(category))
            .map((c) => {
              const source = customSource(c)
              return (
                <CustomWorkoutCard
                  key={c.id}
                  card={c}
                  placeholder={
                    category === 'custom' ? 'Name, e.g. Arms' : `Custom ${category.name}`
                  }
                  nameLocked={Boolean(planId && savedSessionFor(c))}
                  cardioFirst={c.group === 'cardio'}
                  days={c.name.trim() ? daysFor(source) : []}
                  onChange={(next, picked) => void changeCard(next, picked)}
                  onToggleDay={(d) => void toggle(source, d)}
                />
              )
            })}
          <button
            type="button"
            onClick={() => addCard(category)}
            className="h-11 text-sm font-semibold text-accent"
          >
            + Another {category === 'custom' ? 'workout of your own' : `custom ${category.name}`}
          </button>
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
          {inlineToast ? (
            <p
              key={inlineToast.id}
              role="status"
              className="flex h-12 items-center justify-center truncate rounded-xl bg-text px-4 font-semibold text-bg"
            >
              {inlineToast.message}
            </p>
          ) : planId ? (
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
          defaultName={planName.trim() || 'My plan'}
          onCancel={() => setSaving(false)}
          onSave={async (name, active) => {
            const id = await savePlanFromDraft(name, draft, active)
            sessionStorage.removeItem(DRAFT_KEY)
            sessionStorage.removeItem(NAME_KEY)
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
          sessionStorage.removeItem(NAME_KEY)
          void navigate('/plans', { replace: true })
        }}
      />
    </div>
  )
}

function SaveSheet({
  defaultActive,
  defaultName,
  onCancel,
  onSave,
}: {
  defaultActive: boolean
  defaultName: string
  onCancel: () => void
  onSave: (name: string, active: boolean) => Promise<void>
}) {
  const [name, setName] = useState(defaultName)
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
