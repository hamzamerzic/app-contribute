import React, { useMemo } from 'react'
import { parseUnifiedDiff } from '../diff.js'

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

function FileDiff({ file }) {
  return (
    <section className="co-diff-file">
      <div className="co-diff-file-head">
        <span className="co-diff-file-name">{file.label}</span>
        <span className="co-diff-file-stat">
          +{file.additions} -{file.deletions}
        </span>
      </div>
      <div className="co-diff-lines">
        {file.rows.length > 0 ? (
          file.rows.map((row, index) => <LineRow key={index} row={row} />)
        ) : (
          <div className="co-diff-meta">No textual diff lines.</div>
        )}
      </div>
    </section>
  )
}

export function DiffView({ diff }) {
  const files = useMemo(() => parseUnifiedDiff(diff), [diff])
  if (files.length === 0) {
    return <p className="co-review-note">No diff to show.</p>
  }
  return (
    <div className="co-diff-view" role="region" aria-label="Unified diff">
      {files.map((file, index) => (
        <FileDiff key={`${file.label}-${index}`} file={file} />
      ))}
    </div>
  )
}
