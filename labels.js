const PUBLISHED_STATUSES = new Set(['draft', 'open', 'merged', 'closed'])

function normalizedLabels(value) {
  if (!Array.isArray(value)) return []
  // Match the reviewed UI/backend contract exactly: malformed and blank rows
  // are invisible, then the first two visible strings form the review boundary.
  // Validation and duplicate folding happen only inside that pair, so a hidden
  // third label can never replace a visible-but-unusable value at publish time.
  const visible = []
  for (const candidate of value) {
    if (typeof candidate !== 'string') continue
    const label = candidate.trim()
    if (!label) continue
    visible.push(label)
    if (visible.length === 2) break
  }
  const labels = []
  const seen = new Set()
  for (const label of visible) {
    const key = label.toLowerCase()
    if (label.length > 50 || label.includes('\n') || seen.has(key)) continue
    seen.add(key)
    labels.push(label)
  }
  return labels
}

function withoutKnownLabels(requested, ...knownGroups) {
  const known = new Set(
    knownGroups.flat().map((label) => label.toLowerCase()),
  )
  return requested.filter((label) => !known.has(label.toLowerCase()))
}

// The platform records label application after the PR exists. Keep that
// distinction explicit: a missing/timeout/permission result is an outcome of
// an already-published PR, never a failed PR submission or a reason to resend.
export function contributionLabelOutcome(rec = {}) {
  const published = PUBLISHED_STATUSES.has(rec.status)
  const hasOutcome = Array.isArray(rec.last_submit_labels_applied)
  const reviewed = normalizedLabels(rec.plan?.labels)
  const requested = published && hasOutcome
    ? normalizedLabels(Array.isArray(rec.last_submit_labels_requested)
      ? rec.last_submit_labels_requested
      : reviewed)
    : reviewed
  const applied = hasOutcome ? normalizedLabels(rec.last_submit_labels_applied) : []
  const missing = hasOutcome ? normalizedLabels(rec.last_submit_labels_missing) : []
  const unconfirmed = hasOutcome
    ? withoutKnownLabels(requested, applied, missing)
    : []
  const note = typeof rec.last_submit_labels_note === 'string'
    ? rec.last_submit_labels_note.trim()
    : ''
  const needsAttention = published && hasOutcome && (
    missing.length > 0 || unconfirmed.length > 0 || note.length > 0
  )

  return {
    published,
    hasOutcome,
    requested,
    applied,
    missing,
    unconfirmed,
    note,
    needsAttention,
    empty: requested.length === 0 && applied.length === 0 &&
      missing.length === 0 && unconfirmed.length === 0 && !note,
  }
}
