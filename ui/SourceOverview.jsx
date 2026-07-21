import { projectOverview } from '../source-map.js'
import { Icon } from './Icons.jsx'

const PREVIEW_LIMIT = 4

// The opening view stays intentionally sparse: this component receives only
// projects with a meaningful local/upstream position and renders nothing when
// that list is empty. Each row is one explicit route into the full Projects
// detail rather than a card with hidden click behavior.
export function SourceOverview({ projects, onOpen, onViewAll }) {
  if (!projects?.length) return null
  const visible = projects.slice(0, PREVIEW_LIMIT)
  const hidden = projects.length - visible.length
  return (
    <section className="co-overview" aria-labelledby="co-overview-title">
      <div className="co-overview-head">
        <div>
          <h2 id="co-overview-title">Changes to look at</h2>
          <p>Local work and shared updates that may need your attention.</p>
        </div>
        <span>{projects.length}</span>
      </div>
      <div className="co-overview-list">
        {visible.map((project) => {
          const status = projectOverview(project)
          return (
            <button
              type="button"
              className="co-overview-row"
              key={project.key}
              onClick={() => onOpen(project.key)}
              aria-label={`${project.name}: ${status.label}. View details`}
            >
              <span className={'co-overview-dot tone-' + status.tone} aria-hidden="true" />
              <span className="co-overview-name">{project.name}</span>
              <span className="co-overview-status">
                <strong>{status.label}</strong>
                <small>{status.detail}</small>
              </span>
              <Icon name="right" size={16} />
            </button>
          )
        })}
      </div>
      {hidden > 0 ? (
        <button type="button" className="co-overview-all" onClick={onViewAll}>
          View {hidden} more in Projects
          <Icon name="right" size={15} />
        </button>
      ) : null}
    </section>
  )
}
