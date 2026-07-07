import { ContributionCard } from './ContributionCard.jsx'

// The grouped feed. domain.groupRecords partitions the ledger into three
// buckets; each renders as a section only when it has rows, so the layout
// tightens around whatever the ledger actually holds:
//
//   Ready to propose — status=prepared, waiting on the owner's go-ahead. These
//                      cards carry the review flow (expand the staged plan,
//                      Approve/Dismiss), so only this group gets the handlers.
//   Open             — status submitting/draft/open: live on GitHub, or in
//                      flight to it (refreshed on mount + daily).
//   History          — merged/closed/commented/abandoned and any unknown
//                      future status.
export function Feed({ groups, onApprove, onDismiss, loadDiff }) {
  const { ready, open, history } = groups
  return (
    <>
      {ready.length > 0 && (
        <section className="co-section">
          <h2 className="co-section-title">Ready to propose</h2>
          <p className="co-section-hint">
            Review and approve these — nothing goes public without your
            go-ahead.
          </p>
          {ready.map((rec) => (
            <ContributionCard
              key={rec.id}
              rec={rec}
              onApprove={onApprove}
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
