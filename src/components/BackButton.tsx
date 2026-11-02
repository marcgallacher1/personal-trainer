import { useNavigate } from 'react-router'

interface Props {
  /** Where to go if there's no in-app history (e.g. the app was opened on this screen) */
  fallback: string
  label?: string
  /** Runs before navigating back (e.g. cancel an empty workout) */
  onBack?: () => void | Promise<void>
}

/** Back link (home-screen apps have no browser back). Uses `fallback` if there's no history. */
export function BackButton({ fallback, label = 'Back', onBack }: Props) {
  const navigate = useNavigate()
  return (
    <button
      type="button"
      className="-ml-2 flex h-10 items-center gap-1 px-2 text-base font-semibold text-accent"
      onClick={async () => {
        await onBack?.()
        const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
        if (idx > 0) void navigate(-1)
        else void navigate(fallback, { replace: true })
      }}
    >
      <span className="text-2xl leading-none">‹</span> {label}
    </button>
  )
}
