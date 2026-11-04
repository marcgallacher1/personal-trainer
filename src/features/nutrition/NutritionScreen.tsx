import { useState } from 'react'
import { BackButton } from '../../components/BackButton'
import { Button } from '../../components/Button'
import { BarChart } from '../../components/charts/BarChart'
import { ChartCard } from '../../components/charts/ChartCard'
import { LineChart } from '../../components/charts/LineChart'
import { Sheet } from '../../components/Sheet'
import { Stepper } from '../../components/Stepper'
import { showToast } from '../../components/Toast'
import { addDays } from '../../lib/analysis/training'
import {
  DEFAULT_G_PER_KG,
  QUICK_FOODS,
  dailyProtein,
  daysHit,
  foodLabel,
  foodProtein,
  proteinTarget,
  weightChange,
  weightTrend,
  type QuickFood,
} from '../../lib/nutrition'
import { undoDeletion } from '../log/actions'
import { londonDate } from '../log/format'
import { useProfile, type Profile } from '../plans/data'
import {
  addProtein,
  deleteProtein,
  logWeight,
  setProteinPerKg,
  useProteinLogs,
  useWeighIns,
} from './data'

const SHORT = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
const dayLabel = (d: string) => SHORT.format(new Date(`${d}T12:00:00Z`))
/** "12 Oct" */
const shortDay = (d: string) => dayLabel(d).split(' ').slice(1).join(' ')

type Open =
  | { kind: 'food'; food: QuickFood }
  | { kind: 'grams' }
  | { kind: 'weight' }
  | { kind: 'target' }
  | null

/** Protein for today with quick-add buttons, the last two weeks, and the bodyweight trend. */
export function NutritionScreen() {
  const profile = useProfile()
  const protein = useProteinLogs()
  const weighIns = useWeighIns()
  const [today] = useState(() => londonDate(new Date().toISOString()))
  const [open, setOpen] = useState<Open>(null)

  if (profile === undefined || protein === undefined || weighIns === undefined) return null

  const kg = Number(weighIns.at(-1)?.kg ?? profile?.bodyweight_kg ?? 0) || null
  const perKg = Number(profile?.protein_g_per_kg ?? DEFAULT_G_PER_KG)
  const target = proteinTarget(kg, perKg)
  const todays = protein
    .filter((p) => p.date === today)
    .toSorted((a, b) => a.logged_at.localeCompare(b.logged_at))
  const eaten = Math.round(todays.reduce((a, p) => a + Number(p.grams), 0))
  const days = dailyProtein(
    protein.map((p) => ({ date: p.date, grams: Number(p.grams) })),
    addDays(today, -13),
    today,
  )
  const hit = daysHit(days, target)
  const trend = weightTrend(weighIns.map((w) => ({ date: w.date, kg: Number(w.kg) })))
  const change = weightChange(trend, 28)
  const latest = weighIns.at(-1)

  async function add(grams: number, label: string | null) {
    const row = await addProtein(today, grams, label)
    showToast({
      message: `+${grams} g protein`,
      action: { label: 'Undo', onClick: () => void deleteProtein(row) },
    })
  }

  async function remove(row: (typeof todays)[number]) {
    const changes = await deleteProtein(row)
    showToast({
      message: 'Removed',
      action: { label: 'Undo', onClick: () => void undoDeletion(changes) },
    })
  }

  return (
    <div className="flex flex-col gap-5">
      <BackButton fallback="/more" label="More" />
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Nutrition</h1>
        <p className="text-muted">Log your protein here; track the rest of your food wherever.</p>
      </div>

      <section className="rounded-3xl bg-surface p-4">
        <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">Protein today</h2>
        <p className="mt-1 text-3xl font-bold tabular-nums">
          {eaten} g
          {target && <span className="text-lg font-semibold text-muted"> of {target} g</span>}
        </p>
        {target ? (
          <>
            <div
              className="mt-2 h-3 overflow-hidden rounded-full bg-surface-2"
              role="progressbar"
              aria-label="Protein today"
              aria-valuenow={eaten}
              aria-valuemax={target}
            >
              <div
                className="h-full rounded-full bg-accent transition-all"
                style={{ width: `${Math.min(100, (eaten / target) * 100)}%` }}
              />
            </div>
            <p className="mt-2 text-sm text-muted">
              {eaten >= target ? 'Target hit 💪' : `${target - eaten} g to go`} ·{' '}
              <button
                type="button"
                onClick={() => setOpen({ kind: 'target' })}
                className="font-semibold text-accent"
              >
                {perKg} g/kg × {kg} kg
              </button>
            </p>
          </>
        ) : (
          <p className="mt-1 text-sm text-muted">Log your weight below to get a daily target.</p>
        )}

        <div className="mt-4 grid grid-cols-5 gap-2">
          {QUICK_FOODS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() =>
                f.grams ? void add(f.grams, f.name) : setOpen({ kind: 'food', food: f })
              }
              className="flex h-20 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl bg-surface-2 px-1 text-xs font-semibold active:opacity-80"
            >
              <span className="text-2xl">{f.emoji}</span>
              <span className="w-full truncate text-center">{f.name}</span>
              {f.grams && <span className="text-[11px] font-normal text-muted">{f.grams} g</span>}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setOpen({ kind: 'grams' })}
            className="flex h-20 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl bg-surface-2 px-1 text-xs font-semibold active:opacity-80"
          >
            <span className="text-2xl">➕</span>
            <span>Grams</span>
          </button>
        </div>

        {todays.length > 0 && (
          <ul className="mt-4 flex flex-col gap-0.5 text-sm">
            {todays.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3">
                <span className="min-w-0 flex-1 truncate">{p.label ?? 'Protein'}</span>
                <span className="shrink-0 text-muted tabular-nums">{Number(p.grams)} g</span>
                <button
                  type="button"
                  aria-label={`Remove ${p.label ?? 'entry'}`}
                  onClick={() => void remove(p)}
                  className="-mr-2 h-8 w-8 shrink-0 text-lg text-muted"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ChartCard
        title="Last 14 days"
        subtitle={
          hit.logged
            ? target
              ? `Hit your target on ${hit.hit} of ${hit.logged} day${hit.logged === 1 ? '' : 's'} logged`
              : `${hit.logged} day${hit.logged === 1 ? '' : 's'} logged`
            : 'Nothing logged yet'
        }
        raw={{
          columns: ['Day', 'Protein (g)', 'Target (g)'],
          rows: days.toReversed().map((d) => [d.date, d.grams, target ?? '']),
        }}
      >
        {hit.logged ? (
          <BarChart
            label="Protein per day"
            bars={days.map((d) => ({
              key: d.date,
              label: dayLabel(d.date).split(' ')[1] ?? d.date,
              values: { protein: d.grams },
            }))}
            series={[{ id: 'protein', name: 'Protein', colour: 'var(--color-accent)' }]}
            format={(v) => `${Math.round(v)} g`}
            target={target ?? undefined}
          />
        ) : (
          <p className="py-8 text-center text-sm text-muted">Your daily totals show here.</p>
        )}
      </ChartCard>

      <section className="rounded-3xl bg-surface p-4">
        <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">Bodyweight</h2>
        <div className="mt-1 flex items-baseline justify-between gap-3">
          <p className="text-3xl font-bold tabular-nums">
            {latest ? `${Number(latest.kg)} kg` : '–'}
          </p>
          {change !== null && (
            <p className="text-sm font-semibold text-muted tabular-nums">
              {change.kg > 0 ? '+' : change.kg < 0 ? '−' : ''}
              {Math.abs(change.kg)} kg{' '}
              {change.full ? 'in 4 weeks' : `since ${shortDay(change.from)}`}
            </p>
          )}
        </div>
        <p className="text-sm text-muted">
          {latest ? `Last weighed ${dayLabel(latest.date)}` : 'No weigh-ins yet'}
        </p>

        <div className="mt-3">
          {trend.length > 1 ? (
            <LineChart
              label="Bodyweight"
              points={trend.map((w) => ({ date: w.date, value: w.avg }))}
              format={(v) => `${Math.round(v * 10) / 10} kg`}
            />
          ) : (
            <p className="rounded-2xl bg-surface-2 p-4 text-center text-sm text-muted">
              Your trend shows here after a couple of weigh-ins.
            </p>
          )}
        </div>

        <Button
          variant="secondary"
          className="mt-3 w-full"
          onClick={() => setOpen({ kind: 'weight' })}
        >
          Log weight
        </Button>
      </section>

      {open?.kind === 'food' && (
        <FoodSheet
          food={open.food}
          onAdd={(grams, label) => void add(grams, label)}
          onClose={() => setOpen(null)}
        />
      )}
      {open?.kind === 'grams' && (
        <GramsSheet
          onAdd={(grams, label) => void add(grams, label)}
          onClose={() => setOpen(null)}
        />
      )}
      {open?.kind === 'weight' && (
        <WeightSheet
          today={today}
          start={kg ?? 75}
          onSave={(date, value) =>
            void logWeight(date, value, profile).then(() =>
              showToast({ message: `✓ ${value} kg logged` }),
            )
          }
          onClose={() => setOpen(null)}
        />
      )}
      {open?.kind === 'target' && profile && (
        <TargetSheet profile={profile} kg={kg} onClose={() => setOpen(null)} />
      )}
    </div>
  )
}

function AddButton({
  label,
  disabled,
  onClick,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="h-14 w-full rounded-2xl bg-accent text-lg font-bold text-accent-fg disabled:opacity-40"
    >
      {label}
    </button>
  )
}

/** Chicken, eggs, bacon: how much, and the protein it works out to. */
function FoodSheet({
  food,
  onAdd,
  onClose,
}: {
  food: QuickFood
  onAdd: (grams: number, label: string) => void
  onClose: () => void
}) {
  const [amount, setAmount] = useState(food.start ?? 1)
  const grams = foodProtein(food, amount)
  return (
    <Sheet
      open
      title={`${food.emoji} ${food.name}`}
      subtitle={food.question}
      closeLabel="Cancel"
      onClose={onClose}
      footer={
        <AddButton
          label={`Add ${grams} g protein`}
          disabled={grams <= 0}
          onClick={() => {
            onAdd(grams, foodLabel(food, amount))
            onClose()
          }}
        />
      }
    >
      <Stepper
        label={food.unit ?? 'amount'}
        value={amount}
        step={food.step ?? 1}
        min={0}
        unit={food.unit?.startsWith('g') ? 'g' : undefined}
        onChange={setAmount}
      />
      <p className="mt-2 text-sm text-muted">Roughly {grams} g of protein.</p>
    </Sheet>
  )
}

/** Anything else: type the grams (e.g. from MyFitnessPal), with an optional name. */
function GramsSheet({
  onAdd,
  onClose,
}: {
  onAdd: (grams: number, label: string | null) => void
  onClose: () => void
}) {
  const [grams, setGrams] = useState(0)
  const [label, setLabel] = useState('')
  return (
    <Sheet
      open
      title="Add protein"
      subtitle="Grams of protein, not grams of food."
      closeLabel="Cancel"
      onClose={onClose}
      footer={
        <AddButton
          label={grams > 0 ? `Add ${grams} g` : 'Add'}
          disabled={grams <= 0}
          onClick={() => {
            onAdd(grams, label.trim() || null)
            onClose()
          }}
        />
      }
    >
      <div className="flex flex-col gap-4">
        <Stepper
          label="grams of protein"
          value={grams}
          step={5}
          min={0}
          unit="g"
          onChange={setGrams}
        />
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="What was it? (optional)"
          className="h-14 rounded-xl bg-surface px-4 text-lg outline-none focus:ring-2 focus:ring-accent"
        />
      </div>
    </Sheet>
  )
}

function WeightSheet({
  today,
  start,
  onSave,
  onClose,
}: {
  today: string
  start: number
  onSave: (date: string, kg: number) => void
  onClose: () => void
}) {
  const [kg, setKg] = useState(start)
  const [date, setDate] = useState(today)
  return (
    <Sheet
      open
      title="Log weight"
      subtitle="First thing in the morning is most consistent."
      closeLabel="Cancel"
      onClose={onClose}
      footer={
        <AddButton
          label="Save"
          disabled={kg <= 0}
          onClick={() => {
            onSave(date, kg)
            onClose()
          }}
        />
      }
    >
      <div className="flex flex-col gap-4">
        <Stepper label="weight" value={kg} step={0.1} decimals min={0} unit="kg" onChange={setKg} />
        <label className="flex h-14 items-center gap-3 rounded-xl bg-surface px-4 focus-within:ring-2 focus-within:ring-accent">
          <span className="shrink-0 font-semibold">Day</span>
          <input
            type="date"
            value={date}
            max={today}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="h-full min-w-0 flex-1 appearance-none bg-transparent text-right text-lg outline-none"
          />
        </label>
      </div>
    </Sheet>
  )
}

function TargetSheet({
  profile,
  kg,
  onClose,
}: {
  profile: Profile
  kg: number | null
  onClose: () => void
}) {
  const [perKg, setPerKg] = useState(Number(profile.protein_g_per_kg ?? DEFAULT_G_PER_KG))
  const target = proteinTarget(kg, perKg)
  return (
    <Sheet
      open
      title="Protein target"
      subtitle="1.6–2.2 g per kg suits most people building muscle."
      closeLabel="Cancel"
      onClose={onClose}
      footer={
        <AddButton
          label="Save"
          disabled={perKg <= 0}
          onClick={() => {
            void setProteinPerKg(profile, perKg)
            onClose()
          }}
        />
      }
    >
      <Stepper
        label="grams per kg"
        value={perKg}
        step={0.1}
        decimals
        min={0}
        unit="g/kg"
        onChange={setPerKg}
      />
      {target && (
        <p className="mt-2 text-sm text-muted">
          That's {target} g a day at {kg} kg.
        </p>
      )}
    </Sheet>
  )
}
