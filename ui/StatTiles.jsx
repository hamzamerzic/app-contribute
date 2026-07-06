import React from 'react'

// The three headline counts. Values wear text tokens (not status colors) so
// the tiles read identically in any theme; the feed's group labels carry
// the semantics.
export function StatTiles({ stats }) {
  const tiles = [
    { label: 'Merged', value: stats.merged },
    { label: 'Open', value: stats.open },
    { label: 'Ready', value: stats.ready },
  ]
  return (
    <div className="co-tiles">
      {tiles.map((tile) => (
        <div key={tile.label} className="co-tile">
          <div className="co-tile-value">{tile.value}</div>
          <div className="co-tile-label">{tile.label}</div>
        </div>
      ))}
    </div>
  )
}
