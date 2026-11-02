import { useState } from 'react'
import { Sheet } from '../../components/Sheet'
import { showToast } from '../../components/Toast'
import type { Proposal } from '../../lib/adaptive/proposals'
import { acceptProposal, declineProposal, useProposals } from './data'

const ICON: Record<Proposal['kind'], string> = {
  missed: '📅',
  stall: '📈',
  rebalance: '⚖️',
  trim: '✂️',
}

/** The top coaching suggestion, only when there is one. Nothing changes until you pick. */
export function SuggestionCard() {
  const result = useProposals()
  const [all, setAll] = useState(false)
  const [busy, setBusy] = useState(false)
  if (!result?.proposals.length) return null
  const { planId, proposals } = result
  const top = proposals[0]!

  async function run(task: () => Promise<unknown>, message: string) {
    setBusy(true)
    try {
      await task()
      showToast({ message })
    } catch (e) {
      showToast({ message: e instanceof Error ? e.message : String(e) })
    } finally {
      setBusy(false)
    }
  }

  const card = (p: Proposal) => (
    <Suggestion
      key={p.key}
      proposal={p}
      busy={busy}
      onPick={(o) => void run(() => acceptProposal(planId, p, o), `✓ ${o.label}`)}
      onSkip={() => void run(() => declineProposal(planId, p), 'Okay, skipped')}
    />
  )

  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">Coach</h2>
        {proposals.length > 1 && (
          <button
            type="button"
            onClick={() => setAll(true)}
            className="text-sm font-semibold text-accent"
          >
            See all {proposals.length}
          </button>
        )}
      </div>
      {card(top)}
      <Sheet
        open={all && proposals.length > 0}
        title="Coach suggestions"
        subtitle="Nothing changes unless you pick an option"
        closeLabel="Done"
        onClose={() => setAll(false)}
      >
        <div className="flex flex-col gap-3">{proposals.map(card)}</div>
      </Sheet>
    </section>
  )
}

function Suggestion({
  proposal: p,
  busy,
  onPick,
  onSkip,
}: {
  proposal: Proposal
  busy: boolean
  onPick: (o: Proposal['options'][number]) => void
  onSkip: () => void
}) {
  return (
    <div className="rounded-2xl bg-surface p-4">
      <div className="flex gap-3">
        <span className="text-2xl">{ICON[p.kind]}</span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold">{p.title}</span>
          <span className="block text-sm text-muted">{p.detail}</span>
        </span>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {p.options.map((o, i) => (
          <button
            key={o.id}
            type="button"
            disabled={busy}
            onClick={() => onPick(o)}
            className={`min-h-11 rounded-xl px-3 py-2 text-left font-semibold disabled:opacity-50 ${
              i === 0 ? 'bg-accent text-accent-fg' : 'bg-surface-2'
            }`}
          >
            {o.label}
          </button>
        ))}
        <button
          type="button"
          disabled={busy}
          onClick={onSkip}
          className="h-10 text-sm font-semibold text-muted disabled:opacity-50"
        >
          Not now
        </button>
      </div>
    </div>
  )
}
