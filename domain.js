// Pure logic for the Contribute feed: ledger grouping, headline counts, the
// batched live-refresh query, and display formatting. No React, no I/O.
//
// Ledger records live one JSON file per contribution under contributions/.
// The agent writes them from chat turns; the daily job.sh persists live
// GitHub state back into them. Shape:
//   { id, type: pr|issue|issue_comment|discussion_comment, repo, number?,
//     url?, title, status: prepared|draft|open|merged|closed|abandoned,
//     branch?, chat_id?, created_at, updated_at, summary }

export const TYPE_LABELS = {
  pr: 'Pull request',
  issue: 'Issue',
  issue_comment: 'Issue comment',
  discussion_comment: 'Discussion comment',
}

export const STATUS_LABELS = {
  prepared: 'Ready',
  draft: 'Draft',
  open: 'Open',
  merged: 'Merged',
  closed: 'Closed',
  abandoned: 'Abandoned',
}

// Feed groups: Ready to propose (waiting on the owner's go-ahead), Open
// (live on GitHub), History (settled). An unknown future status lands in
// History so it degrades to visible-but-quiet instead of vanishing.
export function groupRecords(records) {
  const ready = []
  const open = []
  const history = []
  for (const rec of records) {
    if (rec.status === 'prepared') ready.push(rec)
    else if (rec.status === 'draft' || rec.status === 'open') open.push(rec)
    else history.push(rec)
  }
  const newestFirst = (a, b) =>
    String(b.updated_at || b.created_at || '').localeCompare(
      String(a.updated_at || a.created_at || ''))
  ready.sort(newestFirst)
  open.sort(newestFirst)
  history.sort(newestFirst)
  return { ready, open, history }
}

export function countStats(records) {
  let merged = 0
  let open = 0
  let ready = 0
  for (const rec of records) {
    if (rec.status === 'merged') merged += 1
    else if (rec.status === 'draft' || rec.status === 'open') open += 1
    else if (rec.status === 'prepared') ready += 1
  }
  return { merged, open, ready }
}

// One GraphQL document refreshes every live PR/issue in a single round-trip
// (aliased resource(url:) nodes cost ~1 rate-limit point total). Comments
// carry no meaningful live state, so only pr/issue records participate.
// Returns null when nothing needs refreshing.
export function buildRefreshQuery(records) {
  const targets = records.filter((rec) =>
    (rec.type === 'pr' || rec.type === 'issue') &&
    (rec.status === 'draft' || rec.status === 'open') &&
    typeof rec.url === 'string' &&
    rec.url.startsWith('https://github.com/'))
  if (targets.length === 0) return null
  const aliases = {}
  const parts = targets.map((rec, i) => {
    const alias = 'r' + i
    aliases[alias] = rec.id
    // JSON.stringify escapes quotes/backslashes, which is exactly the
    // GraphQL string-literal escaping the URL needs.
    return alias + ': resource(url: ' + JSON.stringify(rec.url) + ') {' +
      ' __typename' +
      ' ... on PullRequest { state isDraft }' +
      ' ... on Issue { state } }'
  })
  return { query: 'query { ' + parts.join(' ') + ' }', aliases }
}

// Maps one resource() node to a ledger status. null = no verdict (deleted,
// inaccessible, or an unexpected type) — callers leave the record stale.
// job.sh mirrors this mapping in Python; keep the two in step.
export function liveStatusFor(node) {
  if (!node || typeof node !== 'object') return null
  if (node.__typename === 'PullRequest') {
    if (node.state === 'MERGED') return 'merged'
    if (node.state === 'CLOSED') return 'closed'
    if (node.state === 'OPEN') return node.isDraft ? 'draft' : 'open'
    return null
  }
  if (node.__typename === 'Issue') {
    if (node.state === 'CLOSED') return 'closed'
    if (node.state === 'OPEN') return 'open'
  }
  return null
}

// Overlays fresh GraphQL results onto the record list for display. Never
// mutates the inputs; records without a verdict pass through unchanged.
export function applyLiveStates(records, aliases, data) {
  if (!data) return records
  const statusById = new Map()
  for (const [alias, recId] of Object.entries(aliases)) {
    const status = liveStatusFor(data[alias])
    if (status) statusById.set(recId, status)
  }
  if (statusById.size === 0) return records
  return records.map((rec) => {
    const status = statusById.get(rec.id)
    return status && status !== rec.status ? { ...rec, status } : rec
  })
}

export function timeAgo(iso) {
  if (!iso) return ''
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return ''
  const s = Math.max(0, (Date.now() - t) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return Math.floor(s / 60) + 'm ago'
  if (s < 86400) return Math.floor(s / 3600) + 'h ago'
  if (s < 86400 * 30) return Math.floor(s / 86400) + 'd ago'
  return new Date(t).toLocaleDateString()
}
