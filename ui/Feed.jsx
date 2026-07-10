import { ContributionCard } from './ContributionCard.jsx'

// The grouped feed. domain.groupRecords partitions the ledger into three
// buckets; each renders as a section only when it has rows, so the layout
// tightens around whatever the ledger actually holds:
//
//   Ready for review — status=prepared, waiting on the owner's go-ahead. These
//                      cards carry the review flow (expand the staged plan,
//                      Send/Feedback/Dismiss), so only this group gets the
//                      submit + dismiss handlers.
//   Open             — status submitting/draft/open: live on GitHub, or in
//                      flight to it (refreshed on mount + daily). Cards may
//                      still return to the source chat when GitHub activity
//                      needs agent follow-up.
//   History          — merged/closed/commented/abandoned and any unknown
//                      future status.
export function Feed({ groups, onSend, onFeedback, onDismiss, loadDiff }) {
  const { ready, open, history } = groups
  return (
    <>
      {ready.length > 0 && (
        <section className="co-section">
          <h2 className="co-section-title">Ready for review</h2>
          <p className="co-section-hint">
            Review exactly what would go public. Sending a PR publishes it to
            GitHub directly; feedback returns to the source chat.
          </p>
          {ready.map((rec) => (
            <ContributionCard
              key={rec.id}
              rec={rec}
              onSend={onSend}
              onFeedback={onFeedback}
              onDismiss={onDismiss}
              loadDiff={loadDiff}
            />
          ))}
        </section>
      )}

      {open.length > 0 && (
        <section className="co-section">
          <h2 className="co-section-title">Open</h2>
          {open.map((rec) => (
            <ContributionCard key={rec.id} rec={rec} onFeedback={onFeedback} />
          ))}
        </section>
      )}

      {history.length > 0 && (
        <section className="co-section">
          <h2 className="co-section-title">History</h2>
          {history.map((rec) => (
            <ContributionCard key={rec.id} rec={rec} />
          ))}
        </section>
      )}
    </>
  )
}
