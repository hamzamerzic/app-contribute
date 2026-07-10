import React, { useMemo, useState } from 'react'
import { parseUnifiedDiff } from '../diff.js'

function fileKind(file) {
  if (!file.oldPath && file.newPath) return 'added'
  if (file.oldPath && !file.newPath) return 'deleted'
  if (file.oldPath && file.newPath && file.oldPath !== file.newPath) {
    return 'renamed'
  }
  return 'modified'
}

function DiffOverview({ files }) {
  const totals = files.reduce((acc, file) => {
    acc.additions += file.additions
    acc.deletions += file.deletions
    return acc
  }, { additions: 0, deletions: 0 })
  return (
    <div className="co-diff-overview">
      <div className="co-diff-overview-main">
        <strong>{files.length}</strong>
        <span>{files.length === 1 ? 'file changed' : 'files changed'}</span>
      </div>
      <div className="co-diff-overview-stats" aria-label="Diff totals">
        <span className="co-diff-stat is-add">+{totals.additions}</span>
        <span className="co-diff-stat is-del">-{totals.deletions}</span>
      </div>
    </div>
  )
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

function FileDiff({ file }) {
  const [open, setOpen] = useState(true)
  const kind = fileKind(file)
  return (
    <section className={`co-diff-file is-${kind}`}>
      <div className="co-diff-file-head">
        <button
          type="button"
          className="co-diff-file-toggle"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="co-diff-caret" aria-hidden="true" />
          <span className="co-diff-file-name">{file.label}</span>
        </button>
        <div className="co-diff-file-meta">
          {kind !== 'modified' ? (
            <span className={`co-diff-kind is-${kind}`}>{kind}</span>
          ) : null}
          <span className="co-diff-file-stat">
            +{file.additions} -{file.deletions}
          </span>
        </div>
      </div>
      {open && (
        <div className="co-diff-lines">
          {file.rows.length > 0 ? (
            file.rows.map((row, index) => <LineRow key={index} row={row} />)
          ) : (
            <div className="co-diff-meta">No textual diff lines.</div>
          )}
        </div>
      )}
    </section>
  )
}

export function DiffView({ diff }) {
  const files = useMemo(() => parseUnifiedDiff(diff), [diff])
  if (files.length === 0) {
    return <p className="co-review-note">No diff to show.</p>
  }
  return (
    <div className="co-diff-shell">
      <DiffOverview files={files} />
      <div className="co-diff-view" role="region" aria-label="Unified diff">
        {files.map((file, index) => (
          <FileDiff key={`${file.label}-${index}`} file={file} />
        ))}
      </div>
    </div>
  )
}
