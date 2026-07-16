// Ledger storage layer. contributions/<id>.json is written by the agent
// (from chat turns) and by job.sh (the daily refresh); this app has TWO
// writers of its own — the read-side feed cache (feed-cache.json, there
// only to serve the next offline open) and the Dismiss button, which
// CAS-flips a prepared record to abandoned to avoid clobbering a concurrent
// submit claim. Dismissal is ONLINE-ONLY (CAS needs a live version read),
// which is why the manifest declares offline writes "none". The assembled
// feed is also cached to feed-cache.json for the next offline open.

const FEED_CACHE = 'feed-cache.json'
const RECORD_PREFIX = 'contributions/'

export async function loadLedger() {
  // The platform pages include-content listings at its byte-budget boundary,
  // so every valid contribution record arrives in the listing itself. Never
  // fall back to one GET per entry: a malformed/oversized record is isolated
  // and reported to the UI instead of turning one refresh into an unbounded
  // request fan-out.
  const entries = await window.mobius.storage.list(RECORD_PREFIX, {
    includeContent: true,
  })
  if (
    entries === null
    || (entries.length === 0 && window.mobius.online === false)
  ) {
    const cached = await window.mobius.storage.get(FEED_CACHE)
    return { records: cached || [], fromCache: true, omitted: [] }
  }
  const records = []
  const omitted = []
  for (const entry of entries) {
    if (entry.type !== 'file' || !entry.name.endsWith('.json')) continue
    if (!Object.prototype.hasOwnProperty.call(entry, 'content')) {
      omitted.push(entry.path || RECORD_PREFIX + entry.name)
      continue
    }
    const rec = entry.content
    // `path` rides along so subscriptions and the Dismiss CAS write address
    // the actual file even if its name ever drifts from rec.id. It only
    // reaches this app's own feed cache — dismissal writes start from a
    // fresh server read, so the field never lands in the ledger files.
    if (rec && typeof rec === 'object' && rec.id) {
      records.push({ ...rec, path: entry.path || RECORD_PREFIX + entry.name })
    } else {
      omitted.push(entry.path || RECORD_PREFIX + entry.name)
    }
  }
  return { records, fromCache: false, omitted }
}

export async function cacheFeed(records) {
  try {
    await window.mobius.storage.set(FEED_CACHE, records)
  } catch {
    // The cache only improves the next offline open; never let it fail a load.
  }
}

// The staged full diff sits beside its record as raw text. null = absent
// (a comment-only plan, or a v1 record) or unreadable — the card shows a
// quiet "no diff stored" either way.
export async function loadFullDiff(rec) {
  try {
    return await window.mobius.storage.getText(RECORD_PREFIX + rec.id + '.diff')
  } catch {
    return null
  }
}

// Drop and Undrop are the SAME guarded status flip in opposite directions, so
// they share one CAS engine. The runtime's durableWrite({ifMatch}) and
// _getWithVersion pairing is the same guarded path useDocument uses, so it
// keeps the mirror and subscribers coherent. A 412 means someone else (the
// agent claiming it, another tab) won the race: re-read once and retry only if
// the record is still in the expected `from` status. There is intentionally no
// blind-write fallback: losing concurrency safety must never be an availability
// strategy.
//
// Outcomes: {ok: rec} flipped | {conflict: rec|null} changed under us |
// {gone: true} record vanished | {error: string} ('offline' when the
// network verdict says so).
async function casFlipStatus({ rec, from, to }) {
  const path = rec.path || RECORD_PREFIX + rec.id + '.json'
  const s = window.mobius && window.mobius.storage
  if (!s || typeof s.durableWrite !== 'function' ||
      typeof s._getWithVersion !== 'function') {
    return { error: 'Safe storage updates are unavailable.' }
  }
  for (let attempt = 0; attempt < 2; attempt++) {
    let current = null
    let version = null
    try {
      const loaded = await s._getWithVersion(path, 'json')
      current = loaded.value
      version = loaded.version
    } catch (err) {
      if (window.mobius && window.mobius.online === false) return { error: 'offline' }
      return { error: String((err && err.message) || err) }
    }
    if (!current || typeof current !== 'object') return { gone: true }
    if (current.status !== from) return { conflict: current }
    if (!version) {
      return { error: 'Safe storage updates are unavailable.' }
    }
    const next = {
      ...current,
      status: to,
      updated_at: new Date().toISOString(),
    }
    try {
      await s.durableWrite(path, next, { ifMatch: version })
      return { ok: next }
    } catch (err) {
      if (err && err.code === 'conflict') continue // durableWrite's 412
      if (window.mobius && window.mobius.online === false) return { error: 'offline' }
      return { error: String((err && err.message) || err) }
    }
  }
  // Two straight 412s: the record keeps changing — treat as a conflict and
  // let the caller refresh the feed rather than fight for the write.
  return { conflict: null }
}

// Drop = CAS-flip a still-`prepared` record to `abandoned`.
export async function abandonPrepared({ appId, token, rec }) {
  return casFlipStatus({ appId, token, rec, from: 'prepared', to: 'abandoned' })
}

// Undrop = the reverse: CAS-flip a `abandoned` record back to `prepared` so it
// returns to Ready for review (the plan, diff blob, and branch are untouched by
// a drop, so a restored record is fully reviewable/sendable again).
export async function restoreAbandoned({ appId, token, rec }) {
  return casFlipStatus({ appId, token, rec, from: 'abandoned', to: 'prepared' })
}
