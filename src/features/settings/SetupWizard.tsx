import { useState } from 'react'
import { useNavigate } from 'react-router'
import { BackButton } from '../../components/BackButton'
import { useProfile } from '../plans/data'
import { RULE_INFO, useRules } from './data'
import { EditRule, GoalCard, PushCard, QuietCard } from './SettingsScreen'

/** Asks the notification questions one at a time. Answers save as you go; re-run any time. */
export function SetupWizard() {
  const navigate = useNavigate()
  const rules = useRules()
  const profile = useProfile()
  const [step, setStep] = useState(0)
  if (!rules || profile === undefined) return null

  const steps: { title: string; hint?: string; body: React.ReactNode }[] = [
    {
      title: 'Turn on notifications',
      hint: 'Allow them on this phone so reminders can reach you with the app closed.',
      body: <PushCard />,
    },
    {
      title: 'Training for something?',
      hint: 'Reminders will count down to it.',
      body: profile ? <GoalCard profile={profile} /> : null,
    },
    ...rules.map((e) => ({
      title: RULE_INFO[e.rule.type].name,
      hint: RULE_INFO[e.rule.type].question,
      body: <EditRule entry={e} />,
    })),
    {
      title: 'Quiet hours',
      hint: 'When should nothing be sent?',
      body: profile ? <QuietCard profile={profile} /> : null,
    },
  ]
  const s = steps[step]!
  const last = step === steps.length - 1

  return (
    <div className="flex flex-col gap-4 pb-32">
      <BackButton fallback="/settings" label="Settings" />
      <p className="text-sm text-muted">
        Step {step + 1} of {steps.length}
      </p>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{s.title}</h1>
        {s.hint && <p className="mt-1 text-muted">{s.hint}</p>}
      </div>
      <div key={step}>{s.body}</div>

      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-10 border-t border-border bg-bg/95 px-safe py-3 backdrop-blur">
        <div className="mx-auto flex max-w-xl gap-2">
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
              className="h-12 rounded-xl bg-surface-2 px-5 font-semibold"
            >
              Back
            </button>
          )}
          <button
            type="button"
            onClick={() =>
              last ? void navigate('/settings', { replace: true }) : setStep(step + 1)
            }
            className="h-12 flex-1 rounded-xl bg-accent text-lg font-bold text-accent-fg"
          >
            {last ? 'Done' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  )
}
