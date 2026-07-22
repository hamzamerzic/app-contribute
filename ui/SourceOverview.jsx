import { Icon } from './Icons.jsx'

// Contributions is the approval inbox; project-by-project source detail has a
// dedicated tab. Keep this cross-link to one quiet row so real approvals and
// blockers stay above the fold on a phone.
export function SourceOverview({ projects, onViewAll }) {
  if (!projects?.length) return null
  const count = projects.length
  return (
    <button type="button" className="co-overview" onClick={onViewAll}>
      <span className="co-overview-mark" aria-hidden="true" />
      <span className="co-overview-copy">
        <strong>{count} {count === 1 ? 'project has' : 'projects have'} changes</strong>
        <small>Review local and shared source updates in Projects</small>
      </span>
      <Icon name="right" size={16} />
    </button>
  )
}
