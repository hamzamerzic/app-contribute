// Same-origin fetch helpers for the platform's GitHub surface. The GitHub
// token never reaches this app: /api/github/* holds it server-side, and the
// manifest's github_access permission is what lets this app's token through —
// including the connect endpoints, which the platform gates to accept an app
// token that declares github_access. Read helpers degrade to a quiet fallback
// so the feed still renders from the ledger when GitHub is unreachable; the
// connect helpers return the raw Response so the connection card can branch
// on res.ok and surface the server's error detail verbatim.

function authHeaders(token) {
  return { Authorization: 'Bearer ' + token }
}

// Resolves the connection card's state and carries the fields the connect
// flow needs (device_flow_available, login). 404 means the platform predates
// the GitHub surface entirely — a distinct, actionable message.
export async function fetchGithubStatus(token) {
  try {
    const r = await fetch('/api/github/status', { headers: authHeaders(token) })
    if (r.status === 404) return { state: 'unsupported' }
    if (!r.ok) return { state: 'unknown' }
    const s = await r.json()
    return {
      state: s.connected ? 'connected' : 'disconnected',
      connected: !!s.connected,
      login: s.login || '',
      deviceFlowAvailable: !!s.device_flow_available,
      scopes: Array.isArray(s.scopes) ? s.scopes : [],
      tokenSource: s.token_source || null,
    }
  } catch {
    // Network failure (offline, backend restarting) — not a platform verdict.
    return { state: 'unknown' }
  }
}

// POSTs one read-only GraphQL document; returns response.data or null.
// Callers leave records stale on null — the refresh is best-effort polish,
// and GitHub returns null nodes (not errors) for anything inaccessible.
export async function fetchLiveStates(token, query) {
  try {
    const r = await fetch('/api/github/graphql', {
      method: 'POST',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    })
    if (!r.ok) return null
    const body = await r.json()
    return body && typeof body === 'object' ? body.data || null : null
  } catch {
    return null
  }
}

// Device flow: start it (returns {user_code, verification_uri, interval,
// expires_in}) and poll it (returns {status: none|pending|complete|failed,
// login?, reason?}). The server paces polling — it answers "pending" without
// an upstream call when a poll arrives before GitHub's interval allows one —
// so the caller just ticks at the announced interval and never handles
// slow_down itself.
export function connectStart(token) {
  return fetch('/api/github/connect/start', {
    method: 'POST',
    headers: authHeaders(token),
  })
}

export function connectPoll(token) {
  return fetch('/api/github/connect/poll', {
    method: 'POST',
    headers: authHeaders(token),
  })
}

// PAT fallback: exchange a classic personal access token for the stored
// credential. On rejection the server's detail (fine-grained token,
// missing scope) is human-readable — surface it verbatim.
export function connectToken(token, pat) {
  return fetch('/api/github/connect/token', {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: pat }),
  })
}

export function disconnect(token) {
  return fetch('/api/github/connect', {
    method: 'DELETE',
    headers: authHeaders(token),
  })
}
