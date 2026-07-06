import { STATUS_LABELS, TYPE_LABELS, timeAgo } from '../domain.js'

// One ledger row. The title links to the PR/issue when a url is present (a
// prepared record has none yet), the status chip carries the group's identity
// in color, and the meta line reads type · repo#number · updated-time. Every
// field is optional-tolerant — the ledger is written by the agent and cron, so
// a missing summary or repo just drops that piece rather than breaking layout.
export function ContributionCard({ rec }) {
  const status = rec.status || 'prepared'
  const statusLabel = STATUS_LABELS[status] || status
  const typeLabel = TYPE_LABELS[rec.type] || rec.type || 'Contribution'
  const when = timeAgo(rec.updated_at || rec.created_at)

  // repo, optionally with a #number; both tolerate absence.
  let where = rec.repo || ''
  if (where && rec.number) where += ' #' + rec.number
  const meta = [typeLabel, where, when].filter(Boolean)

  const title = rec.title || where || 'Untitled contribution'
  const hasLink =
    typeof rec.url === 'string' && rec.url.startsWith('https://github.com/')

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
    </div>
  )
}
