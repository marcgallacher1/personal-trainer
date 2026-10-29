export function ComingSoon({ phase, children }: { phase: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface p-6 text-center">
      <p className="text-sm font-semibold tracking-wide text-accent uppercase">{phase}</p>
      <p className="mt-2 text-muted">{children}</p>
    </div>
  )
}
