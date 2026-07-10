import React, { useState } from 'react'
import { STATUS_LABELS, TYPE_LABELS, timeAgo } from '../domain.js'
import { DiffView } from './DiffView.jsx'
import { MarkdownView } from './MarkdownView.jsx'

// One ledger row. Pointer clicks on a linked PR/issue card open the target, and
// pointer clicks on a prepared card open its review detail; keyboard users keep
// the familiar visible link/button targets. The status chip carries the group's
// identity in color, and the meta line reads type · repo#number · updated-time.
// Every field is optional-tolerant — the ledger is written by the agent and
// cron, so a missing summary or repo just drops that piece rather than breaking
// layout.
//
// Prepared records grow a review flow when the feed passes the handlers:
//   - with a `plan`, the collapsed card shows only high-level context; Review
//     expands the exact markdown body and an on-demand structured diff.
//   - without one (a record staged by a v1-skill agent), the card keeps the
//     plain fallback and Send returns a re-stage error from the platform.
// Send calls the platform submit endpoint directly for PR plans; Feedback
// returns to the source chat; Dismiss CAS-flips to abandoned via storage.js.

const ACTION_LABELS = {
  pr: 'New PR to',
  issue: 'New issue in',
  issue_comment: 'Comment on',
  discussion_comment: 'Comment on',
}

function diffSummary(stat) {
  const lines = String(stat || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (lines.length === 0) return ''
  return lines[lines.length - 1]
}

function PlanSummary({ rec }) {
  const plan = rec.plan || {}
  const where = plan.repo || rec.repo || ''
  const branch = plan.branch || rec.branch || ''
  const summary = diffSummary(plan.diff_stat)
  const isPr = plan.action === 'pr' || rec.type === 'pr'
  return (
    <div className="co-plan-summary">
      <div className="co-plan-row">
        {where ? <span>{where}</span> : null}
        {branch ? <span>{branch}</span> : null}
        {summary ? <span>{summary}</span> : null}
      </div>
      {isPr ? (
        <div className="co-plan-coauthor" title="The prepared commit carries this GitHub co-author trailer.">
          <span>Co-authored with</span>
          <strong>Möbius Agent</strong>
        </div>
      ) : null}
      {rec.last_submit_error ? (
        <p className="co-review-error">{rec.last_submit_error}</p>
      ) : null}
      {typeof rec.last_pushed_branch_url === 'string' &&
        rec.last_pushed_branch_url.startsWith('https://github.com/') ? (
        <a
          className="co-review-link"
          href={rec.last_pushed_branch_url}
          target="_blank"
          rel="noopener noreferrer"
        >
          View pushed branch
        </a>
      ) : null}
    </div>
  )
}

function isInteractiveTarget(target) {
  return !!target?.closest?.('button, a, input, textarea, select, [role="button"]')
}

function attentionTitle(attention) {
  return attention?.title || 'Needs attention'
}

function attentionMessage(attention) {
  return attention?.message || 'There is new activity on GitHub.'
}

function attentionDraft(rec) {
  const attention = rec.attention || {}
  const bits = [
    'Please sort out this upstream contribution:',
    rec.title ? '"' + rec.title + '"' : '',
    rec.repo ? '(' + rec.repo + ')' : '',
  ].filter(Boolean)
  const details = [
    attention.title || '',
    attention.message || '',
    attention.url || rec.url || '',
  ].filter(Boolean)
  return bits.join(' ') + (details.length ? '\n\nContext:\n' + details.join('\n') : '')
}

function AttentionCallout({ rec, onFeedback }) {
  const attention = rec.attention || {}
  if (!rec.needs_attention && !attention.title && !attention.message) return null

  function handleAskAgent() {
    if (typeof onFeedback !== 'function') return
    onFeedback(rec, { draft: attentionDraft(rec) })
  }

  return (
    <div className="co-attention" role="status">
      <div className="co-attention-copy">
        <div className="co-attention-title">{attentionTitle(attention)}</div>
        <p className="co-attention-text">{attentionMessage(attention)}</p>
        {typeof attention.url === 'string' &&
          attention.url.startsWith('https://github.com/') ? (
          <a
            className="co-review-link"
            href={attention.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            View activity on GitHub
          </a>
        ) : null}
      </div>
      {typeof onFeedback === 'function' ? (
        <button type="button" className="co-btn co-btn-sm" onClick={handleAskAgent}>
          Draft follow-up
        </button>
      ) : null}
    </div>
  )
}

// The staged plan, rendered for review. Shown only when rec.plan exists.
function ReviewPlan({ rec, loadDiff }) {
  const plan = rec.plan
  // idle → excerpt | loading → loaded | missing. Nothing diff-like is shown by
  // default; the partner starts with the stat and opts into the excerpt/full
  // patch when they need detail.
  const [diffState, setDiffState] = useState('idle')
  const [fullDiff, setFullDiff] = useState(null)

  const where = plan.repo || rec.repo || ''
  const badge = (ACTION_LABELS[plan.action] || 'Contribution to') +
    (where ? ' ' + where : '')
  const hasDiffShape = Boolean(
    plan.diff_stat || plan.diff_excerpt || plan.diff_sha256)
  const displayedDiff = diffState === 'loaded'
    ? fullDiff
    : diffState === 'excerpt'
      ? plan.diff_excerpt
      : ''
  const isPr = plan.action === 'pr' || rec.type === 'pr'

  function showExcerpt() {
    setDiffState('excerpt')
  }

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
          {diffState === 'missing' ? (
            <p className="co-review-note">No stored diff to show — ask your agent in chat for the full change.</p>
          ) : (
            <div className="co-review-tools">
              {plan.diff_excerpt && diffState === 'idle' ? (
                <button
                  type="button"
                  className="co-btn co-btn-sm"
                  onClick={showExcerpt}
                >
                  Show diff excerpt
                </button>
              ) : null}
              {diffState !== 'loaded' ? (
                <button
                  type="button"
                  className="co-btn co-btn-sm"
                  disabled={diffState === 'loading'}
                  onClick={showFullDiff}
                >
                  {diffState === 'loading' ? 'Loading diff…' : 'View full diff'}
                </button>
              ) : null}
            </div>
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

// The Send/Dismiss row plus its outcome messaging; shared by the plan
// review and the plan-less v1 fallback.
function ReviewActions({ rec, onSend, onFeedback, onDismiss }) {
  const [sendNote, setSendNote] = useState(null)
  const [sending, setSending] = useState(false)
  const [dismissing, setDismissing] = useState(false)
  const [note, setNote] = useState(null)
  const isPr = rec.plan?.action === 'pr' || rec.type === 'pr'

  async function send() {
    if (!isPr) return
    setSending(true)
    setSendNote(null)
    setNote(null)
    try {
      const outcome = (await onSend(rec)) || {}
      if (outcome.ok) {
        setSendNote('Pull request opened on GitHub for review.')
      } else {
        setNote(outcome.error || 'Could not submit this contribution.')
      }
    } finally {
      setSending(false)
    }
  }

  function feedback() {
    setSendNote(null)
    setNote(null)
    const outcome = (typeof onFeedback === 'function' && onFeedback(rec)) || {}
    if (!outcome.ok) {
      setNote(outcome.reason === 'missing-chat'
        ? 'This older record does not know which chat created it.'
        : 'Open Contribute from inside Möbius to jump back to the source chat.')
    }
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
        {isPr ? (
          <button
            type="button"
            className="co-btn co-btn-primary"
            disabled={sending}
            onClick={send}
          >
            {sending ? 'Sending…' : 'Send PR for review'}
          </button>
        ) : null}
        <button type="button" className="co-btn" onClick={feedback}>
          Leave feedback
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
      {!isPr ? (
        <p className="co-review-note">
          Only prepared PRs can be sent to GitHub from here right now.
        </p>
      ) : null}
      {sendNote && <p className="co-review-note">{sendNote}</p>}
      {note && <p className="co-review-error">{note}</p>}
    </>
  )
}

export function ContributionCard({
  rec,
  onSend,
  onFeedback,
  onDismiss,
  loadDiff,
}) {
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
    status === 'prepared' && typeof onSend === 'function' &&
    typeof onDismiss === 'function'
  const hasPlan = reviewable && rec.plan && typeof rec.plan === 'object'
  const wholeCardTarget = hasLink || hasPlan
  const reviewLabel =
    rec.plan?.action === 'pr' || rec.type === 'pr' ? 'Review PR' : 'Review'

  function openCardTarget() {
    if (hasPlan) {
      setExpanded(true)
      return
    }
    if (hasLink) {
      window.open(rec.url, '_blank', 'noopener,noreferrer')
    }
  }

  function handleCardClick(event) {
    if (!wholeCardTarget || isInteractiveTarget(event.target)) return
    openCardTarget()
  }

  return (
    <div
      className={`co-card${wholeCardTarget ? ' is-clickable' : ''}`}
      onClick={handleCardClick}
    >
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
      <AttentionCallout rec={rec} onFeedback={onFeedback} />
      {hasPlan && !expanded ? <PlanSummary rec={rec} /> : null}
      {hasPlan && (
        <button
          type="button"
          className="co-btn co-btn-sm co-review-toggle"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? 'Hide review' : reviewLabel}
        </button>
      )}
      {reviewable && (!hasPlan || expanded) && (
        <div className="co-review">
          {hasPlan && <ReviewPlan rec={rec} loadDiff={loadDiff} />}
          <ReviewActions
            rec={rec}
            onSend={onSend}
            onFeedback={onFeedback}
            onDismiss={onDismiss}
          />
        </div>
      )}
    </div>
  )
}
