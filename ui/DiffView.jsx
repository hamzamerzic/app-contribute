import React from 'react'

// Per-file diff rendering, split out so the file list owns the row + expand
// chrome and only borrows the line body. The renderer stays React-native (text
// nodes, no injected HTML); diff.js already classified every line.

// Classify a parsed file by its path pair: a missing old path is a new file, a
// missing new path a deletion, differing paths a rename. Pure, so the file-list
// row marker can reason about it without re-deriving the rule.
export function fileKind(file) {
  if (!file.oldPath && file.newPath) return 'added'
  if (file.oldPath && !file.newPath) return 'deleted'
  if (file.oldPath && file.newPath && file.oldPath !== file.newPath) {
    return 'renamed'
  }
  return 'modified'
}

function LineRow({ row }) {
  if (row.kind === 'hunk') {
    return <div className="co-diff-hunk">{row.content}</div>
  }
  if (row.kind === 'meta' || row.kind === 'note') {
    return <div className="co-diff-meta">{row.content}</div>
  }
  return (
    <div className={`co-diff-row is-${row.kind}`}>
      <span className="co-diff-num">{row.oldNumber}</span>
      <span className="co-diff-num">{row.newNumber}</span>
      <span className="co-diff-mark">{row.marker}</span>
      <span className="co-diff-code">{row.content || ' '}</span>
    </div>
  )
}

// The body of a single parsed file: its unified-diff line rows only. The file
// list wraps this in a scroll panel (max-height + both-axis overflow);
// min-width:max-content on the rows drives the horizontal scroll so a wide hunk
// never stretches the card or the page.
export function DiffLines({ file }) {
  const rows = file.rows || []
  return (
    <div className="co-diff-lines">
      {rows.length > 0 ? (
        rows.map((row, index) => <LineRow key={index} row={row} />)
      ) : (
        <div className="co-diff-meta">No textual diff lines.</div>
      )}
    </div>
  )
}
