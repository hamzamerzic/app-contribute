import React, { useEffect, useState } from 'react'
import { parseUnifiedDiff, parseDiffStat } from '../diff.js'
import { DiffLines, fileKind } from './DiffView.jsx'

// The changed-file list a prepared PR expands into. On mount it fetches the
// full diff once (loadDiff), parses it, and lists one row per file: a
// left-truncating path so the basename never clips, a right-aligned +adds
// −dels, and a per-row inline diff that scrolls inside its own panel. When the
// stored .diff is missing it falls back to the (non-expandable, approximate)
// rows parsed from plan.diff_stat, with a note pointing back to chat. When
// neither is available it renders nothing rather than empty chrome.

const KIND_LABELS = {
  added: 'new',
  deleted: 'deleted',
  renamed: 'renamed',
  binary: 'bin',
}
// Above this many files the list starts collapsed to the first COLLAPSED_COUNT.
const EXPAND_THRESHOLD = 8
const COLLAPSED_COUNT = 6

// Split into dir (no trailing slash) + basename. The separator slash is
// rendered as its own fixed span, not left on the dir: a trailing neutral char
// on the rtl-truncated dir gets reordered to the wrong side, dropping the slash.
function splitPath(path) {
  const value = String(path || '')
  const slash = value.lastIndexOf('/')
  if (slash === -1) return { dir: '', base: value }
  return { dir: value.slice(0, slash), base: value.slice(slash + 1) }
}

// The +adds −dels pair, reused by the header and every row. The minus is a real
// minus sign (U+2212) so it reads as a stat, not a hyphenated word.
function FileStat({ additions, deletions, approximate }) {
  return (
    <span className={`co-file-stat${approximate ? ' is-approx' : ''}`}>
      <span className="co-file-add">+{additions}</span>
      <span className="co-file-del">{'−'}{deletions}</span>
    </span>
  )
}

function FilePath({ path }) {
  const { dir, base } = splitPath(path)
  return (
    <span className="co-file-path" title={path}>
      {dir ? <span className="co-file-dir">{dir}</span> : null}
      {dir ? <span className="co-file-sep">/</span> : null}
      <span className="co-file-base">{base}</span>
    </span>
  )
}

function FileRow({ file, open, onToggle }) {
  const kindLabel = KIND_LABELS[file.kind]
  const meta = (
    <span className="co-file-meta">
      {kindLabel ? <span className="co-file-kind">{kindLabel}</span> : null}
      {/* A binary row has no meaningful +/− split; the "bin" kind says it all. */}
      {file.binary ? null : (
        <FileStat
          additions={file.additions}
          deletions={file.deletions}
          approximate={file.approximate}
        />
      )}
    </span>
  )

  // Fallback rows (from diff_stat) have no line body to expand.
  if (!file.expandable) {
    return (
      <div className="co-file">
        <div className="co-file-row is-static">
          <FilePath path={file.path} />
          {meta}
        </div>
      </div>
    )
  }

  return (
    <div className="co-file">
      <button
        type="button"
        className="co-file-row"
        aria-expanded={open}
        onClick={onToggle}
      >
        <span className="co-file-caret" aria-hidden="true" />
        <FilePath path={file.path} />
        {meta}
      </button>
      {open ? (
        <div className="co-file-panel">
          <DiffLines file={file} />
        </div>
      ) : null}
    </div>
  )
}

function fromFullDiff(text) {
  const parsed = parseUnifiedDiff(text)
  if (parsed.length === 0) return null
  // The index rides in the key: a valid diff can hold two entries whose
  // display paths collide (delete b.txt + rename a.txt -> b.txt), and
  // path-only keys would merge their rows and their open/closed state.
  const files = parsed.map((file, index) => ({
    key: `${index}:${file.newPath || file.oldPath || file.label}`,
    path: file.newPath || file.oldPath || file.label,
    additions: file.additions,
    deletions: file.deletions,
    kind: fileKind(file),
    rows: file.rows,
    expandable: true,
  }))
  return {
    mode: 'full',
    files,
    totalFiles: files.length,
    additions: files.reduce((acc, f) => acc + f.additions, 0),
    deletions: files.reduce((acc, f) => acc + f.deletions, 0),
  }
}

function fromDiffStat(stat) {
  const parsed = parseDiffStat(stat)
  // A summary-only stat ("5 files changed, ...") still carries honest totals;
  // render the header with no rows rather than nothing at all.
  if (!parsed || (parsed.files.length === 0 && parsed.totalFiles === 0)) {
    return null
  }
  const files = parsed.files.map((file, index) => ({
    key: `${index}:${file.path}`,
    path: file.path,
    additions: file.additions,
    deletions: file.deletions,
    kind: file.binary ? 'binary' : 'modified',
    binary: file.binary,
    approximate: true,
    expandable: false,
  }))
  return {
    mode: 'fallback',
    files,
    totalFiles: parsed.totalFiles,
    additions: parsed.additions,
    deletions: parsed.deletions,
  }
}

export function FileDiffList({ rec, loadDiff }) {
  const plan = rec.plan || {}
  const [data, setData] = useState({ mode: 'loading' })
  const [open, setOpen] = useState(() => new Set())
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function run() {
      const text = typeof loadDiff === 'function' ? await loadDiff(rec) : null
      if (cancelled) return
      const full =
        typeof text === 'string' && text.trim() ? fromFullDiff(text) : null
      if (full) {
        setData(full)
        return
      }
      const fallback = fromDiffStat(plan.diff_stat)
      setData(fallback || { mode: 'empty' })
    }
    run()
    return () => {
      cancelled = true
    }
    // rec.id + the stored diff identity pin the fetch; the card is expanded
    // (mounted) per review, so this runs once per open.
  }, [rec.id, loadDiff, plan.diff_stat, plan.diff_sha256]) // eslint-disable-line react-hooks/exhaustive-deps

  if (data.mode === 'loading') {
    return (
      <div className="co-files is-loading">
        <div className="co-files-head">
          <span className="co-files-count">Loading changes…</span>
        </div>
      </div>
    )
  }
  if (data.mode === 'empty') return null

  const { files, totalFiles, additions, deletions } = data
  const collapsedList = files.length > EXPAND_THRESHOLD && !showAll
  const visible = collapsedList ? files.slice(0, COLLAPSED_COUNT) : files
  const hidden = files.length - visible.length

  function toggleFile(key) {
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="co-files">
      <div className="co-files-head">
        <span className="co-files-count">
          {totalFiles} {totalFiles === 1 ? 'file' : 'files'}
        </span>
        <FileStat additions={additions} deletions={deletions} />
      </div>
      {visible.map((file) => (
        <FileRow
          key={file.key}
          file={file}
          open={open.has(file.key)}
          onToggle={() => toggleFile(file.key)}
        />
      ))}
      {hidden > 0 ? (
        <button
          type="button"
          className="co-files-more"
          onClick={() => setShowAll(true)}
        >
          Show all {files.length} files
        </button>
      ) : null}
      {files.length > EXPAND_THRESHOLD && showAll ? (
        <button
          type="button"
          className="co-files-more"
          onClick={() => setShowAll(false)}
        >
          Show fewer
        </button>
      ) : null}
      {data.mode === 'fallback' ? (
        <p className="co-files-note">
          Full diff isn't stored — ask your agent in chat for the full change.
        </p>
      ) : null}
    </div>
  )
}
