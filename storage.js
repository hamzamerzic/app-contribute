// Ledger storage layer. contributions/<id>.json is written by the agent
// (from chat turns) and by job.sh (the daily refresh); this app has TWO
// writers of its own — the read-side feed cache (feed-cache.json, there
// only to serve the next offline open) and the Dismiss button, which
// CAS-flips a prepared record to abandoned so it can never clobber a
// concurrent agent claim or submit. Dismissal is ONLINE-ONLY (CAS needs a
// live version read), which is why the manifest declares offline writes
// "none". storage.list() has no offline mirror, so the last assembled feed
// is also cached to feed-cache.json — get() DOES mirror offline — and used
// when enumeration fails; that cache is what makes offline reads honest.

const FEED_CACHE = 'feed-cache.json'
const RECORD_PREFIX = 'contributions/'

export async function loadLedger() {
  const entries = await window.mobius.storage.list(RECORD_PREFIX)
  if (entries === null) {
    const cached = await window.mobius.storage.get(FEED_CACHE)
    return { records: cached || [], fromCache: true }
  }
  const records = []
  await Promise.all(entries
    .filter((e) => e.type !== 'dir' && e.name.endsWith('.json'))
    .map(async (e) => {
      const path = RECORD_PREFIX + e.name
      const rec = await window.mobius.storage.get(path)
      // `path` rides along so subscriptions and the Dismiss CAS write address
      // the actual file even if its name ever drifts from rec.id. It only
      // reaches this app's own feed cache — dismissal writes start from a
      // fresh server read, so the field never lands in the ledger files.
      if (rec && typeof rec === 'object' && rec.id) records.push({ ...rec, path })
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

// Dismiss = CAS-flip a still-`prepared` record to `abandoned`. Two paths to
// the same If-Match semantics: the runtime's own CAS surface
// (durableWrite({ifMatch}) + _getWithVersion — the same guarded pairing
// useDocument uses) keeps the local mirror and subscribers coherent, so
// prefer it; on an older runtime without it, fall back to raw authenticated
// fetch against the app's own storage path. Either way a 412 means someone
// (the agent claiming it, another tab) won the race: re-read once and retry
// only if the record is still `prepared`.
//
// Outcomes: {ok: rec} flipped | {conflict: rec|null} changed under us |
// {gone: true} record vanished | {error: string} ('offline' when the
// network verdict says so).
export async function abandonPrepared({ appId, token, rec }) {
  const path = rec.path || RECORD_PREFIX + rec.id + '.json'
  const s = window.mobius && window.mobius.storage
  const runtimeCas = !!(s && typeof s.durableWrite === 'function' &&
    typeof s._getWithVersion === 'function')
  for (let attempt = 0; attempt < 2; attempt++) {
    let current = null
    let version = null
    try {
      if (runtimeCas) {
        const loaded = await s._getWithVersion(path, 'json')
        current = loaded.value
        version = loaded.version
      } else {
        const r = await fetch('/api/storage/apps/' + appId + '/' + path, {
          headers: {
            Authorization: 'Bearer ' + token,
            'x-mobius-version': '1',   // opts the read into the ETag header
          },
        })
        if (r.status === 404) return { gone: true }
        if (!r.ok) return { error: 'read failed (' + r.status + ')' }
        current = await r.json()
        version = r.headers.get('ETag')
      }
    } catch (err) {
      if (window.mobius && window.mobius.online === false) return { error: 'offline' }
      return { error: String((err && err.message) || err) }
    }
    if (!current || typeof current !== 'object') return { gone: true }
    if (current.status !== 'prepared') return { conflict: current }
    if (!version) {
      // Platform-skew fallback: the version read SUCCEEDED but carried no
      // ETag — this backend predates storage CAS, so the PUT below is
      // unconditioned. Tighten the race window the only way available:
      // re-read immediately before the blind write and require the record
      // is still `prepared`.
      let recheck = null
      try {
        if (runtimeCas) {
          recheck = (await s._getWithVersion(path, 'json')).value
        } else {
          const r = await fetch('/api/storage/apps/' + appId + '/' + path, {
            headers: { Authorization: 'Bearer ' + token },
          })
          if (r.status === 404) return { gone: true }
          if (!r.ok) return { error: 'read failed (' + r.status + ')' }
          recheck = await r.json()
        }
      } catch (err) {
        if (window.mobius && window.mobius.online === false) return { error: 'offline' }
        return { error: String((err && err.message) || err) }
      }
      if (!recheck || typeof recheck !== 'object') return { gone: true }
      if (recheck.status !== 'prepared') return { conflict: recheck }
      current = recheck
    }
    const next = {
      ...current,
      status: 'abandoned',
      updated_at: new Date().toISOString(),
    }
    try {
      if (runtimeCas) {
        await s.durableWrite(path, next, version ? { ifMatch: version } : {})
      } else {
        const headers = {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
        }
        if (version) headers['If-Match'] = version
        const r = await fetch('/api/storage/apps/' + appId + '/' + path, {
          method: 'PUT',
          headers,
          body: JSON.stringify(next),
        })
        if (r.status === 412) continue // lost the race — re-read and re-check
        if (!r.ok) return { error: 'write failed (' + r.status + ')' }
      }
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
