/** Superset labels: A1, A2 for the first group, B1, B2 for the next. */
export function groupLabels(
  exercises: readonly { id: string; group_id: string | null }[],
): Map<string, string> {
  const labels = new Map<string, string>()
  const counts = new Map<string, number>()
  for (const e of exercises) {
    if (!e.group_id) continue
    if (!counts.has(e.group_id)) counts.set(e.group_id, 0)
    const groupLetter = String.fromCharCode(65 + [...counts.keys()].indexOf(e.group_id))
    counts.set(e.group_id, counts.get(e.group_id)! + 1)
    labels.set(e.id, `${groupLetter}${counts.get(e.group_id)}`)
  }
  return labels
}
