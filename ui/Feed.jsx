import { ContributionCard } from './ContributionCard.jsx'

// The grouped feed. domain.groupRecords partitions the ledger into three
// buckets; each renders as a section only when it has rows, so the layout
// tightens around whatever the ledger actually holds:
//
//   Ready to propose — status=prepared, waiting on the owner's go-ahead. The
//                      section hint tells the owner these need a "yes" — nothing
//                      here has gone public.
//   Open             — status draft/open, live on GitHub (refreshed on mount).
//   History          — merged/closed/abandoned and any unknown future status.
export function Feed({ groups }) {
  const { ready, open, history } = groups
  return (
    <>
      {ready.length > 0 && (
        <section className="co-section">
          <h2 className="co-section-title">Ready to propose</h2>
          <p className="co-section-hint">
            Ask your agent to submit these — nothing goes public without your
            go-ahead.
          </p>
          {ready.map((rec) => (
            <ContributionCard key={rec.id} rec={rec} />
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
