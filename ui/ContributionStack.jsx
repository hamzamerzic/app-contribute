import React, { useEffect, useId, useRef, useState } from 'react'
import { stackMeta, stackProgress, stackReadiness } from '../stack.js'
import { blockedReviewCount, reviewStateFor } from '../review.js'
import { ContributionCard } from './ContributionCard.jsx'
import { Icon } from './Icons.jsx'

function branchOf(rec) {
  return rec?.plan?.branch || rec?.branch || 'branch unavailable'
}

function StackRail({ records }) {
  return (
    <div className="co-stack-rail" aria-label="Pull request chain">
      {records.map((rec) => {
        const meta = stackMeta(rec)
        return (
          <div className="co-stack-node" key={rec.id}>
            <span className="co-stack-node-dot" aria-hidden="true" />
            <span className="co-stack-node-layer">PR {meta?.position || '?'}</span>
            <code title={meta?.baseBranch || ''}>{meta?.baseBranch || 'unknown base'}</code>
            <span aria-hidden="true">→</span>
            <code title={branchOf(rec)}>{branchOf(rec)}</code>
          </div>
        )
      })}
    </div>
  )
}

export function ContributionStack({
  unit,
  reviewStatus,
  onSendStack,
  onFeedback,
  loadDiff,
}) {
  const [confirming, setConfirming] = useState(false)
  const [sending, setSending] = useState(false)
  const [note, setNote] = useState('')
  const progress = stackProgress(unit)
  const ready = unit.records.filter((rec) => rec.status === 'prepared')
  const readiness = stackReadiness(unit)
  const blocked = blockedReviewCount(unit.records, reviewStatus)
  const canSend = readiness.ok && blocked === 0
  const keepPrivateRef = useRef(null)
  const readinessId = useId()
  const confirmDescriptionId = useId()

  useEffect(() => {
    if (confirming) keepPrivateRef.current?.focus()
  }, [confirming])

  useEffect(() => {
    if (!canSend && confirming) setConfirming(false)
  }, [canSend, confirming])

  async function send() {
    if (!canSend) return
    setSending(true)
    setNote('')
    try {
      const outcome = (await onSendStack(unit.records)) || {}
      if (outcome.ok) {
        setNote(`${outcome.submitted || ready.length} linked pull requests opened on GitHub.`)
        setConfirming(false)
      } else {
        setNote(outcome.error || 'Could not submit this PR stack.')
      }
    } finally {
      setSending(false)
    }
  }

  function feedback() {
    const rec = ready.find((item) => item.chat_id) || unit.records.find((item) => item.chat_id)
    if (!rec || typeof onFeedback !== 'function') {
      setNote('This stack does not know which source chat created it.')
      return
    }
    const outcome = onFeedback(rec, {
      draft: blocked > 0
        ? `Please refresh the reviewed source for PR stack ${unit.name} (${unit.id}). Contribute found ${blocked} stale ${blocked === 1 ? 'layer' : 'layers'}: `
        : `Feedback on PR stack ${unit.name} (${unit.id}): `,
    }) || {}
    if (!outcome.ok) setNote('Open Contribute inside Möbius to return to the source chat.')
  }

  return (
    <article className="co-stack-card">
      <header className="co-stack-head">
        <div>
          <span className="co-stack-kicker">{progress.total} related changes</span>
          <h3>{unit.name}</h3>
          <p>
            {progress.ready > 0 ? `${progress.ready} ready to send` : 'Everything has been sent'}
            {progress.open > 0 ? ` · ${progress.open} being reviewed` : ''}
            {progress.merged > 0 ? ` · ${progress.merged} complete` : ''}
          </p>
        </div>
      </header>

      <details className="co-stack-details">
        <summary>
          <span>Details</span>
          <Icon name="chevron" size={16} />
        </summary>
        <div className="co-stack-details-body">
          <StackRail records={unit.records} />
          <div className="co-stack-layers">
            {unit.records.map((rec) => (
              <ContributionCard
                key={rec.id}
                rec={rec}
                reviewOnly={rec.status === 'prepared'}
                reviewState={reviewStateFor(rec, reviewStatus)}
                onFeedback={onFeedback}
                loadDiff={loadDiff}
              />
            ))}
          </div>
        </div>
      </details>

      {blocked > 0 ? (
        <div id={readinessId} className="co-stack-warning" role="status">
          <strong>{blocked} {blocked === 1 ? 'change needs' : 'changes need'} another look</strong>
          <span>Sending is paused until the agent updates the review.</span>
        </div>
      ) : !readiness.ok && readiness.code !== 'settled' ? (
        <div id={readinessId} className="co-stack-warning" role="status">
          <strong>Not ready to send</strong>
          <span>{readiness.message}</span>
        </div>
      ) : null}

      {confirming ? (
        <div
          className="co-stack-confirm"
          role="alertdialog"
          aria-label="Confirm PR stack publish"
          aria-describedby={confirmDescriptionId}
        >
          <strong>Send {ready.length} related {ready.length === 1 ? 'change' : 'changes'} for review?</strong>
          <p id={confirmDescriptionId}>
            This will open the linked pull {ready.length === 1 ? 'request' : 'requests'} on GitHub.
            Nothing is merged automatically.
          </p>
          <details className="co-stack-confirm-details">
            <summary>Technical order</summary>
            <ol>
              {ready.map((rec) => {
                const meta = stackMeta(rec)
                return (
                  <li key={rec.id}>
                    <span>{rec.title || branchOf(rec)}</span>
                    <code>{meta?.baseBranch} → {branchOf(rec)}</code>
                  </li>
                )
              })}
            </ol>
          </details>
          <div className="co-confirm-actions">
            <button ref={keepPrivateRef} type="button" className="co-btn co-btn-sm" disabled={sending} onClick={() => setConfirming(false)}>
              Keep private
            </button>
            <button type="button" className="co-btn co-btn-primary" disabled={sending} onClick={send}>
              {sending ? 'Sending…' : 'Send for review'}
            </button>
          </div>
        </div>
      ) : (
        <div className="co-stack-actions">
          <button
            type="button"
            className="co-icon-btn is-primary"
            disabled={!canSend}
            aria-label={blocked > 0 ? 'Fresh review required before sending' : 'Send related changes for review'}
            title={blocked > 0 ? 'Fresh review required' : 'Send for review'}
            aria-describedby={
              !canSend && (blocked > 0 || readiness.code !== 'settled')
                ? readinessId
                : undefined
            }
            onClick={() => setConfirming(true)}
          >
            <Icon name="send" />
          </button>
          <button
            type="button"
            className="co-icon-btn"
            onClick={feedback}
            aria-label={blocked > 0 ? 'Ask agent to update this review' : 'Give feedback'}
            title={blocked > 0 ? 'Ask agent to update' : 'Give feedback'}
          >
            <Icon name="feedback" />
          </button>
        </div>
      )}
      {note && <p className={note.includes('opened') ? 'co-review-note' : 'co-review-error'}>{note}</p>}
    </article>
  )
}
