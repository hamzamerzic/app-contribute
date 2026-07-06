// Ledger read layer. contributions/<id>.json is written by the agent (from
// chat turns) and by job.sh (the daily refresh); this app only reads it.
// storage.list() has no offline mirror, so the last assembled feed is also
// cached to feed-cache.json — get() DOES mirror offline — and used when
// enumeration fails. That cache is what makes the manifest's offline
// "reads: true" honest.

const FEED_CACHE = 'feed-cache.json'

export async function loadLedger() {
  const entries = await window.mobius.storage.list('contributions/')
  if (entries === null) {
    const cached = await window.mobius.storage.get(FEED_CACHE)
    return { records: cached || [], fromCache: true }
  }
  const records = []
  await Promise.all(entries
    .filter((e) => e.type !== 'dir' && e.name.endsWith('.json'))
    .map(async (e) => {
      const rec = await window.mobius.storage.get('contributions/' + e.name)
      if (rec && typeof rec === 'object' && rec.id) records.push(rec)
    }))
  return { records, fromCache: false }
}

export async function cacheFeed(records) {
  try {
    await window.mobius.storage.set(FEED_CACHE, records)
  } catch {
    // The cache only improves the next offline open; never let it fail a load.
  }
}
