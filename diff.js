// Unified-diff parsing for the review card. The renderer stays React-native
// (text nodes, no injected HTML); this module turns a git diff into the per-file
// rows the UI shows (headers, hunks, line numbers, additions/deletions).
//
// Line classification is delegated to the platform's canonical diff parser
// (copied verbatim into parse-unified-diff.js, per "copy, don't import"). The
// review card's own file/row shape is produced by the thin adapter below, so
// ContributionCard, FileDiffList, and DiffView keep the shape they render.
// parseDiffStat (further down) is a separate `git diff --stat` reader with no
// canonical equivalent and stays as-is.

import { parseUnifiedDiff as parseCanonicalDiff } from './parse-unified-diff.js'

// Canonical line numbers are a number on the present side and null on the
// absent side; the card renders '' for the absent side.
function lineNumber(value) {
  return typeof value === 'number' ? value : ''
}

// Flatten canonical hunks into the card's flat row list: a hunk-header row
// followed by its add/del/context rows. Canonical's 'meta' line type only ever
// carries "\ No newline at end of file", which the card shows as a note.
function reviewRows(hunks) {
  const rows = []
  for (const hunk of hunks) {
    rows.push({ kind: 'hunk', content: hunk.header })
    for (const line of hunk.lines) {
      if (line.type === 'add' || line.type === 'del' || line.type === 'context') {
        rows.push({
          kind: line.type,
          marker: line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' ',
          oldNumber: lineNumber(line.oldNo),
          newNumber: lineNumber(line.newNo),
          content: line.text,
        })
      } else {
        rows.push({ kind: 'note', content: line.text })
      }
    }
  }
  return rows
}

function toReviewFile(entry) {
  const oldPath = entry.oldPath || ''
  const newPath = entry.newPath || ''
  const rows = reviewRows(entry.hunks)
  // A binary file carries no hunks; surface it as a note, not an empty panel.
  if (entry.binary && rows.length === 0) {
    rows.push({ kind: 'note', content: 'Binary file — not shown as text.' })
  }
  return {
    oldPath,
    newPath,
    additions: entry.insertions,
    deletions: entry.deletions,
    rows,
    label: newPath || oldPath || entry.path || 'Diff',
  }
}

// Parse a unified diff into the review card's per-file shape. Delegating to the
// canonical parser fixes the class of bug where a hunk-body line whose content
// begins "-- "/"++ " (a removed SQL comment, a YAML "---") was mistaken for a
// ---/+++ file header — clobbering the path and dropping the line from counts.
export function parseUnifiedDiff(input) {
  return parseCanonicalDiff(String(input || '')).map(toReviewFile)
}

// Parse the tail of `git diff --stat` into structured counts. The summary line
// ("N files changed, A insertions(+), B deletions(-)") is authoritative for the
// totals — that is what the collapsed card's diffline and the file-list header
// show. The per-file rows ("path | N +++--") give per-file paths with an
// APPROXIMATE add/del split recovered from the bar characters; git scales the
// bar, so the split is exact only for small files. The file list uses those
// rows solely as a fallback when the full .diff blob is missing, which is why
// approximate is honest enough. Returns null when nothing parses.
export function parseDiffStat(input) {
  const text = String(input || '')
  if (!text.trim()) return null

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+$/, ''))
    .filter((line) => line.trim())

  const files = []
  let totalFiles = 0
  let additions = 0
  let deletions = 0
  let sawSummary = false

  for (const line of lines) {
    // The summary line carries the authoritative totals and has no " | "
    // column, which distinguishes it from a file row whose name happens to
    // contain the words "files changed".
    const summary = line.match(/(\d+)\s+files?\s+changed/)
    if (summary && !line.includes('|')) {
      totalFiles = Number(summary[1]) || 0
      const ins = line.match(/(\d+)\s+insertions?\(\+\)/)
      const del = line.match(/(\d+)\s+deletions?\(-\)/)
      additions = ins ? Number(ins[1]) : 0
      deletions = del ? Number(del[1]) : 0
      sawSummary = true
      continue
    }

    // A per-file row: "<path> | <count> <bar>" or "<path> | Bin ...".
    const row = line.match(/^(.*\S)\s+\|\s+(.+)$/)
    if (!row) continue
    const path = row[1].trim()
    const rest = row[2].trim()
    if (/^Bin\b/.test(rest)) {
      files.push({ path, additions: 0, deletions: 0, binary: true })
      continue
    }
    const num = rest.match(/^(\d+)/)
    if (!num) continue
    const total = Number(num[1]) || 0
    const plus = (rest.match(/\+/g) || []).length
    const minus = (rest.match(/-/g) || []).length
    let add = 0
    let rem = 0
    if (total > 0 && plus + minus > 0) {
      add = Math.round((total * plus) / (plus + minus))
      rem = total - add
    } else if (total > 0) {
      add = total // no bar to split on — attribute the whole to additions
    }
    files.push({ path, additions: add, deletions: rem, binary: false })
  }

  if (!sawSummary && files.length === 0) return null
  if (!sawSummary) {
    totalFiles = files.length
    additions = files.reduce((acc, f) => acc + f.additions, 0)
    deletions = files.reduce((acc, f) => acc + f.deletions, 0)
  } else if (totalFiles === 0) {
    totalFiles = files.length
  }
  return { totalFiles, additions, deletions, files }
}
