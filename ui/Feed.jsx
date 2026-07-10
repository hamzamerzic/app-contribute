import { ContributionCard } from './ContributionCard.jsx'

// The grouped feed. domain.groupRecords partitions the ledger into three
// buckets; each renders as a section only when it has rows, so the layout
// tightens around whatever the ledger actually holds:
//
//   Ready for review — status=prepared, waiting on the owner's go-ahead. These
//                      cards carry the review flow (expand the staged plan,
//                      Approve/Feedback/Dismiss), so only this group gets the
//                      handlers.
//   Open             — status submitting/draft/open: live on GitHub, or in
//                      flight to it (refreshed on mount + daily).
//   History          — merged/closed/commented/abandoned and any unknown
//                      future status.
export function Feed({ groups, onApprove, onFeedback, onDismiss, loadDiff }) {
  const { ready, open, history } = groups
  return (
    <>
      {ready.length > 0 && (
        <section className="co-section">
          <h2 className="co-section-title">Ready for review</h2>
          <p className="co-section-hint">
            Open a card to review the prepared work. PR cards can be approved
            for direct draft submission; other records return to chat.
          </p>
          {ready.map((rec) => (
            <ContributionCard
              key={rec.id}
              rec={rec}
              onApprove={onApprove}
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
            <ContributionCard key={rec.id} rec={rec} />
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
