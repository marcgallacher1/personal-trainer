import { Button } from '../../components/Button'

function ShareIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="inline h-5 w-5 align-[-3px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-label="Share"
    >
      <path d="M12 3v12M7 8l5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" strokeLinecap="round" />
    </svg>
  )
}

export function InstallScreen({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="flex min-h-full flex-col justify-center gap-8 px-safe pt-safe pb-safe">
      <div className="text-center">
        <img src="/logo.svg" alt="" className="mx-auto mb-4 h-20 w-20 rounded-2xl" />
        <h1 className="text-3xl font-bold">Install Trainer</h1>
        <p className="mt-2 text-muted">
          Trainer works best from your Home Screen: full screen, offline, and with reminders.
        </p>
      </div>

      <ol className="flex flex-col gap-3 text-lg">
        {[
          <>
            Tap <ShareIcon /> <b>Share</b> in Safari's toolbar
          </>,
          <>
            Scroll down and tap <b>Add to Home Screen</b>
          </>,
          <>
            Tap <b>Add</b>, then open Trainer from your Home Screen
          </>,
        ].map((step, i) => (
          <li key={i} className="flex items-center gap-4 rounded-xl bg-surface p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent font-bold text-accent-fg">
              {i + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>

      <p className="text-center text-sm text-muted">
        Notifications only work when Trainer is opened from the Home Screen (iOS 16.4+).
      </p>

      <Button variant="secondary" onClick={onContinue}>
        Continue in browser anyway
      </Button>
    </div>
  )
}
