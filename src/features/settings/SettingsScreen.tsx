import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { PageTitle } from '../../app/Layout'
import { BackButton } from '../../components/BackButton'
import { Sheet } from '../../components/Sheet'
import { showToast } from '../../components/Toast'
import { updateProfile, useProfile, type Profile } from '../plans/data'
import { RULE_INFO, saveRule, summarise, useRules, type RuleEntry } from './data'
import { disablePush, enablePush, pushStatus, sendTestPush, type PushStatus } from './push'
import { RuleEditor } from './RuleEditor'

export function SettingsScreen() {
  const profile = useProfile()
  const rules = useRules()
  const [open, setOpen] = useState<string | null>(null)
  const editing = rules?.find((r) => r.row.id === open)

  return (
    <div className="flex flex-col gap-5">
      <BackButton fallback="/more" label="More" />
      <PageTitle>Settings</PageTitle>

      <PushCard />

      <Link
        to="/settings/setup"
        className="flex h-12 items-center justify-center rounded-xl bg-surface font-semibold text-accent"
      >
        Run notification setup
      </Link>

      {profile && <GoalCard profile={profile} />}
      {profile && <QuietCard profile={profile} />}
      {profile && <PauseCard profile={profile} />}

      <section>
        <h2 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">
          Notifications
        </h2>
        <ul className="flex flex-col gap-2">
          {(rules ?? []).map((e) => (
            <li key={e.row.id}>
              <button
                type="button"
                onClick={() => setOpen(e.row.id)}
                className="flex w-full items-center gap-3 rounded-2xl bg-surface p-4 text-left active:opacity-80"
              >
                <span className="text-2xl">{RULE_INFO[e.rule.type].emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold">{RULE_INFO[e.rule.type].name}</span>
                  <span
                    className={`block text-sm ${e.rule.enabled ? 'text-muted' : 'text-muted/60'}`}
                  >
                    {summarise(e.rule)}
                  </span>
                </span>
                <span className="text-2xl text-muted">›</span>
              </button>
            </li>
          ))}
        </ul>
        {rules?.length === 0 && (
          <p className="rounded-2xl bg-surface p-4 text-center text-sm text-muted">
            Your notification settings haven’t synced yet.
          </p>
        )}
      </section>

      {editing && (
        <Sheet
          open
          title={RULE_INFO[editing.rule.type].name}
          subtitle={RULE_INFO[editing.rule.type].question}
          onClose={() => setOpen(null)}
        >
          <EditRule entry={editing} />
        </Sheet>
      )}
    </div>
  )
}

/** Edits a rule, saving each change. */
export function EditRule({ entry }: { entry: RuleEntry }) {
  return <RuleEditor rule={entry.rule} onChange={(r) => void saveRule(entry, r)} />
}

const STATUS_TEXT: Record<PushStatus, string> = {
  unsupported: 'This browser can’t receive notifications.',
  'needs-install':
    'Add Trainer to your Home Screen first (Share → Add to Home Screen), then open it from there.',
  'not-configured': 'Notifications aren’t set up on the server yet.',
  denied: 'Notifications are blocked. Turn them on in iPhone Settings → Notifications → Trainer.',
  off: 'Off on this phone.',
  on: 'On for this phone.',
}

export function PushCard() {
  const [status, setStatus] = useState<PushStatus | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    void pushStatus().then(setStatus)
  }, [])

  async function run(task: () => Promise<void>, done?: string) {
    setBusy(true)
    try {
      await task()
      if (done) showToast({ message: done })
    } catch (e) {
      showToast({ message: e instanceof Error ? e.message : String(e) })
    } finally {
      setStatus(await pushStatus())
      setBusy(false)
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-surface p-4">
      <div>
        <p className="font-bold">Notifications</p>
        <p className="text-sm text-muted">{status ? STATUS_TEXT[status] : 'Checking…'}</p>
      </div>
      {status === 'off' && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(enablePush, 'Notifications on')}
          className="h-12 rounded-xl bg-accent font-bold text-accent-fg disabled:opacity-50"
        >
          Enable notifications
        </button>
      )}
      {status === 'on' && (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(sendTestPush, 'Test sent')}
            className="h-12 rounded-xl bg-accent font-bold text-accent-fg disabled:opacity-50"
          >
            Send test
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(disablePush, 'Notifications off for this phone')}
            className="h-12 rounded-xl bg-surface-2 font-semibold disabled:opacity-50"
          >
            Turn off
          </button>
        </div>
      )}
    </section>
  )
}

export function GoalCard({ profile }: { profile: Profile }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-surface p-4">
      <div>
        <p className="font-bold">Training for something?</p>
        <p className="text-sm text-muted">
          A holiday or event. Reminders count down to it to keep you locked in.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Field label="What">
          <input
            key={`name-${profile.updated_at}`}
            defaultValue={profile.goal_event_name ?? ''}
            placeholder="e.g. Australia"
            onBlur={(e) => {
              const v = e.target.value.trim() || null
              if (v !== profile.goal_event_name) void updateProfile(profile, { goal_event_name: v })
            }}
            className={INPUT}
          />
        </Field>
        <Field label="When">
          <input
            key={`date-${profile.updated_at}`}
            type="date"
            defaultValue={profile.goal_event_date ?? ''}
            onChange={(e) =>
              void updateProfile(profile, { goal_event_date: e.target.value || null })
            }
            className={INPUT}
          />
        </Field>
      </div>
    </section>
  )
}

const time = (t: string | null) => (t ? t.slice(0, 5) : '')

export function QuietCard({ profile }: { profile: Profile }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-surface p-4">
      <div>
        <p className="font-bold">Quiet hours</p>
        <p className="text-sm text-muted">Nothing is sent in this window.</p>
      </div>
      <div className="flex flex-col gap-2">
        <TimeRow
          label="From"
          value={time(profile.quiet_start)}
          onChange={(v) => void updateProfile(profile, { quiet_start: v })}
        />
        <TimeRow
          label="Until"
          value={time(profile.quiet_end)}
          onChange={(v) => void updateProfile(profile, { quiet_end: v })}
        />
      </div>
    </section>
  )
}

/** Every settings input: same size, no inner box. `appearance-none` stops iOS fixing the width. */
const INPUT =
  'h-full min-w-0 flex-1 appearance-none bg-transparent text-right text-lg tabular-nums outline-none placeholder:text-muted/60'

/** A labelled row: label on the left, value on the right. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex h-14 items-center gap-3 rounded-xl bg-surface-2 px-4 focus-within:ring-2 focus-within:ring-accent">
      <span className="shrink-0 font-semibold">{label}</span>
      {children}
    </label>
  )
}

function TimeRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string | null) => void
}) {
  return (
    <Field label={label}>
      <input
        type="time"
        value={value}
        onChange={(e) => onChange(e.target.value || null)}
        className={INPUT}
      />
    </Field>
  )
}

/** ISO time `days` from now. */
const daysFromNow = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString()

function PauseCard({ profile }: { profile: Profile }) {
  const [now] = useState(() => Date.now())
  const until = profile.notifications_paused_until
  const paused = until !== null && Date.parse(until) > now
  const pause = (days: number) => {
    void updateProfile(profile, { notifications_paused_until: daysFromNow(days) })
    showToast({ message: `Paused for ${days} day${days === 1 ? '' : 's'}` })
  }
  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-surface p-4">
      <div>
        <p className="font-bold">Pause notifications</p>
        <p className="text-sm text-muted">
          {paused
            ? `Paused until ${new Date(until).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}.`
            : 'Holiday or ill? Pause everything for a while.'}
        </p>
      </div>
      {paused ? (
        <button
          type="button"
          onClick={() => void updateProfile(profile, { notifications_paused_until: null })}
          className="h-12 rounded-xl bg-accent font-bold text-accent-fg"
        >
          Resume now
        </button>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {[1, 3, 7, 14].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => pause(d)}
              className="h-11 rounded-xl bg-surface-2 text-sm font-semibold"
            >
              {d} day{d === 1 ? '' : 's'}
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
