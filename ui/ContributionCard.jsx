import React, { useState } from 'react'
import { STATUS_LABELS, TYPE_LABELS, timeAgo } from '../domain.js'
import { DiffView } from './DiffView.jsx'
import { MarkdownView } from './MarkdownView.jsx'

// One ledger row. The title links to the PR/issue when a url is present (a
// prepared record has none yet), the status chip carries the group's identity
// in color, and the meta line reads type · repo#number · updated-time. Every
// field is optional-tolerant — the ledger is written by the agent and cron, so
// a missing summary or repo just drops that piece rather than breaking layout.
//
// Prepared records grow a review flow when the feed passes the handlers:
//   - with a `plan`, a Review toggle expands the staged plan — action badge,
//     body draft, diff stat + excerpt, full diff on demand — above the
//     Approve/Dismiss row.
//   - without one (a record staged by a v1-skill agent), the card stays the
//     plain v1 row and the Approve/Dismiss row renders directly: the approval
//     message only needs the id, and the agent still enforces the gate.
// Approve never writes the record — it sends the approval message through a
// new chat, which is the green light the agent acts on. Dismiss CAS-flips to
// abandoned via storage.js.

const ACTION_LABELS = {
  pr: 'New PR to',
  issue: 'New issue in',
  issue_comment: 'Comment on',
  discussion_comment: 'Comment on',
}

// The staged plan, rendered for review. Shown only when rec.plan exists.
function ReviewPlan({ rec, loadDiff }) {
  const plan = rec.plan
  // idle → loading → loaded | missing; missing covers both "no .diff stored"
  // and "unreadable", each an honest quiet label rather than a broken pane.
  const [diffState, setDiffState] = useState('idle')
  const [fullDiff, setFullDiff] = useState(null)

  const where = plan.repo || rec.repo || ''
  const badge = (ACTION_LABELS[plan.action] || 'Contribution to') +
    (where ? ' ' + where : '')
  const hasDiffShape = Boolean(
    plan.diff_stat || plan.diff_excerpt || plan.diff_sha256)
  const displayedDiff = diffState === 'loaded' ? fullDiff : plan.diff_excerpt
  const isPr = plan.action === 'pr' || rec.type === 'pr'

  async function showFullDiff() {
    setDiffState('loading')
    const text = typeof loadDiff === 'function' ? await loadDiff(rec) : null
    if (typeof text === 'string' && text.length > 0) {
      setFullDiff(text)
      setDiffState('loaded')
    } else {
      setDiffState('missing')
    }
  }

  return (
    <>
      <span className="co-review-badge">{badge}</span>
      {plan.title && plan.title !== rec.title ? (
        <div className="co-review-title">{plan.title}</div>
      ) : null}
      {isPr ? (
        <div className="co-review-coauthor" title="The contribution workflow adds this commit trailer before publishing.">
          <span>Co-authored with</span>
          <strong>Möbius Agent</strong>
        </div>
      ) : null}
      {plan.body_draft ? (
        <section className="co-review-section">
          <div className="co-review-section-title">Description</div>
          <MarkdownView markdown={plan.body_draft} />
        </section>
      ) : null}
      {hasDiffShape && (
        <section className="co-review-section co-review-diffwrap">
          <div className="co-review-section-title">Diff</div>
          {plan.diff_stat ? (
            <div className="co-review-diffstat">{plan.diff_stat}</div>
          ) : null}
          {displayedDiff ? (
            <DiffView diff={displayedDiff} />
          ) : null}
          {diffState === 'loaded' ? null : diffState === 'missing' ? (
            <p className="co-review-note">No stored diff to show — ask your agent in chat for the full change.</p>
          ) : (
            <button
              type="button"
              className="co-btn co-btn-sm"
              disabled={diffState === 'loading'}
              onClick={showFullDiff}
            >
              {diffState === 'loading' ? 'Loading diff…' : 'View full diff'}
            </button>
          )}
        </section>
      )}
      {typeof plan.target_url === 'string' &&
        plan.target_url.startsWith('https://github.com/') && (
        <a
          className="co-review-link"
          href={plan.target_url}
          target="_blank"
          rel="noopener noreferrer"
        >
          View the target on GitHub
        </a>
      )}
    </>
  )
}

// The Approve/Dismiss row plus its outcome messaging; shared by the plan
// review and the plan-less v1 fallback.
function ReviewActions({ rec, onApprove, onDismiss }) {
  const [approveNote, setApproveNote] = useState(null)
  const [dismissing, setDismissing] = useState(false)
  const [note, setNote] = useState(null)
  const isPr = rec.plan?.action === 'pr' || rec.type === 'pr'
  const approveLabel = isPr ? 'Send PR for review' : 'Approve and send'

  function approve() {
    const outcome = onApprove(rec) || {}
    // Approve posts the green-light request to the shell, which only exists
    // when the app runs inside Möbius. Claim success only when the shell can
    // receive it; in the standalone PWA there is no parent shell, so steer the
    // partner back to the app instead of faking a send.
    setApproveNote(outcome.ok
      ? 'Sent to the approval chat. Your agent will claim this record; if this platform leaves the text in the composer, press Send once.'
      : 'Open Contribute from the Möbius app to approve — approval happens in a chat.')
  }

  async function dismiss() {
    setDismissing(true)
    setNote(null)
    try {
      const outcome = (await onDismiss(rec)) || {}
      if (outcome.conflict !== undefined) {
        setNote('This contribution just changed under you — the feed has been refreshed.')
      } else if (outcome.gone) {
        setNote('This record no longer exists — the feed has been refreshed.')
      } else if (outcome.error) {
        setNote(outcome.error === 'offline'
          ? 'You are offline — dismissing needs a connection; try again once you are back online.'
          : 'Could not dismiss: ' + outcome.error)
      }
    } finally {
      setDismissing(false)
    }
  }

  return (
    <>
      <div className="co-review-actions">
        <button type="button" className="co-btn co-btn-primary" onClick={approve}>
          {approveLabel}
        </button>
        <button
          type="button"
          className="co-btn co-btn-danger"
          disabled={dismissing}
          onClick={dismiss}
        >
          {dismissing ? 'Dismissing…' : 'Dismiss'}
        </button>
      </div>
      {approveNote && <p className="co-review-note">{approveNote}</p>}
      {note && <p className="co-review-error">{note}</p>}
    </>
  )
}

export function ContributionCard({ rec, onApprove, onDismiss, loadDiff }) {
  const status = rec.status || 'prepared'
  const statusLabel = STATUS_LABELS[status] || status
  const typeLabel = TYPE_LABELS[rec.type] || rec.type || 'Contribution'
  const when = timeAgo(rec.updated_at || rec.created_at)
  const [expanded, setExpanded] = useState(false)

  // repo, optionally with a #number; both tolerate absence.
  let where = rec.repo || ''
  if (where && rec.number) where += ' #' + rec.number
  const meta = [typeLabel, where, when].filter(Boolean)

  const title = rec.title || where || 'Untitled contribution'
  const hasLink =
    typeof rec.url === 'string' && rec.url.startsWith('https://github.com/')
  const reviewable =
    status === 'prepared' && typeof onApprove === 'function' &&
    typeof onDismiss === 'function'
  const hasPlan = reviewable && rec.plan && typeof rec.plan === 'object'

  return (
    <div className="co-card">
      <div className="co-card-top">
        {hasLink ? (
          <a
            className="co-card-title"
            href={rec.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {title}
          </a>
        ) : (
          <span className="co-card-title">{title}</span>
        )}
        <span className={`co-chip is-${status}`}>{statusLabel}</span>
      </div>
      {rec.summary ? <p className="co-card-summary">{rec.summary}</p> : null}
      {meta.length > 0 && (
        <div className="co-card-meta">
          {meta.map((part, i) => (
            <span key={i}>
              {i > 0 ? '· ' : ''}
              {part}
            </span>
          ))}
        </div>
      )}
      {hasPlan && (
        <button
          type="button"
          className="co-btn co-btn-sm co-review-toggle"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? 'Hide review' : 'Review'}
        </button>
      )}
      {reviewable && (!hasPlan || expanded) && (
        <div className="co-review">
          {hasPlan && <ReviewPlan rec={rec} loadDiff={loadDiff} />}
          <ReviewActions rec={rec} onApprove={onApprove} onDismiss={onDismiss} />
        </div>
      )}
    </div>
  )
}
