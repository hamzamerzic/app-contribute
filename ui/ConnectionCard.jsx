import { useCallback, useEffect, useRef, useState } from 'react'
import { connectPoll, connectStart, connectToken, disconnect } from '../api.js'
import { Icon } from './Icons.jsx'

// The GitHub connection card — the FULL connect flow, owned by this app (the
// platform's connect endpoints accept this app's github_access token). Four
// top-level states off fetchGithubStatus:
//
//   unsupported  — /api/github/status 404s (platform predates GitHub support)
//   unknown      — the probe failed (offline / restarting); render nothing so
//                  the feed still shows from cache
//   connected    — "Connected as <login>" + an inline-confirm Disconnect
//   disconnected — the connect UI: device flow (when device_flow_available) and
//                  a classic-PAT fallback (always)
//
// Race-safety mirrors the shell's GithubAuth.jsx (a generation counter so a
// poll already awaiting its response can't move the state machine after
// cancel / unmount / PAT-success; server-paced interval; expires_in-derived
// attempt cap; the PAT form stays usable while a device flow is pending). We
// copy the pattern, not the code — this app owns its own api.js + CSS.

const TOKEN_CREATE_URL =
  'https://github.com/settings/tokens/new?scopes=public_repo&description=Mobius'

export function ConnectionCard({ conn, token, onChanged }) {
  // Device-flow machine: idle | starting | pending | complete. PAT submission
  // is independent state so the token form works even while a flow is pending.
  const [flow, setFlow] = useState('idle')
  const [flowPurpose, setFlowPurpose] = useState('standard')
  const [userCode, setUserCode] = useState('')
  const [verificationUri, setVerificationUri] = useState('')
  const [deviceError, setDeviceError] = useState('')
  const [pat, setPat] = useState('')
  const [patSubmitting, setPatSubmitting] = useState(false)
  const [patError, setPatError] = useState('')
  const [connectedLogin, setConnectedLogin] = useState('')
  const [justConnected, setJustConnected] = useState(false)
  const [disconnectConfirm, setDisconnectConfirm] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [disconnectError, setDisconnectError] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  // The classic-PAT form is collapsed behind a disclosure when the device flow
  // is available, so the default connect view is just the one-tap button.
  const [patOpen, setPatOpen] = useState(false)
  const patInputRef = useRef(null)
  const pollRef = useRef(null)
  const pollGenRef = useRef(0)

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  // On unmount, bump the generation and clear the interval so any in-flight
  // poll resolves into a no-op.
  useEffect(() => () => {
    pollGenRef.current += 1
    stopPolling()
  }, [stopPolling])

  const finishConnected = useCallback((login) => {
    setFlow('complete')
    setConnectedLogin(login || '')
    setUserCode('')
    setVerificationUri('')
    setPat('')
    setDeviceError('')
    setJustConnected(true)
    setTimeout(() => setJustConnected(false), 3000)
    // Activation conversion — both the device flow and the PAT path funnel
    // through here, so one signal covers the bottom of the connect funnel.
    window.mobius?.signal?.('github_connected')
    // Tell the parent so it re-fetches status and re-runs the live refresh
    // now that GitHub is reachable.
    onChanged?.()
  }, [onChanged])

  const startDeviceFlow = useCallback(async (workflow = false) => {
    setDeviceError('')
    setFlowPurpose(workflow ? 'workflow' : 'standard')
    setFlow('starting')
    window.mobius?.signal?.('github_connect_started', {
      method: 'device',
      workflow,
    })
    pollGenRef.current += 1
    const myGen = pollGenRef.current
    try {
      const res = await connectStart(token, { workflow })
      if (myGen !== pollGenRef.current) return
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        // A 409 means device flow isn't usable (no client id, or GitHub
        // disabled it) — the server message steers to the PAT fallback below.
        setDeviceError(data.detail || 'Could not start GitHub sign-in.')
        setFlow('idle')
        return
      }
      const data = await res.json()
      setUserCode(data.user_code || '')
      setVerificationUri(data.verification_uri || '')
      setFlow('pending')

      stopPolling()
      pollGenRef.current += 1
      const pollGen = pollGenRef.current
      // Tick at GitHub's announced cadence (5s default). The cap is a belt
      // over server-side expiry: the flow expires upstream (expires_in, 900s
      // default) and the poll then reports failed, but a server that somehow
      // never expires must not keep this client polling forever.
      const intervalMs = (data.interval || 5) * 1000
      const maxAttempts =
        Math.ceil(((data.expires_in || 900) * 1000) / intervalMs) + 2
      let attempts = 0
      pollRef.current = setInterval(async () => {
        attempts += 1
        try {
          const r = await connectPoll(token)
          if (pollGen !== pollGenRef.current) return
          if (!r.ok) {
            stopPolling()
            setFlow('idle')
            setDeviceError('Sign-in check failed. Please try again.')
            return
          }
          const s = await r.json()
          if (pollGen !== pollGenRef.current) return
          if (s.status === 'complete') {
            stopPolling()
            finishConnected(s.login)
          } else if (s.status === 'failed') {
            stopPolling()
            setFlow('idle')
            setDeviceError(s.reason === 'access_denied'
              ? 'GitHub sign-in was denied.'
              : 'GitHub sign-in expired. Please try again.')
          } else if (s.status === 'none') {
            // The server no longer knows this flow (restart or a competing
            // flow replaced it) — nothing left to poll.
            stopPolling()
            setFlow('idle')
            setDeviceError('Sign-in session was lost. Please try again.')
          } else if (attempts >= maxAttempts) {
            stopPolling()
            setFlow('idle')
            setDeviceError('Sign-in timed out. Please try again.')
          }
        } catch { /* transient poll error — the next tick retries */ }
      }, intervalMs)
    } catch {
      if (myGen !== pollGenRef.current) return
      setDeviceError('Network error.')
      setFlow('idle')
    }
  }, [token, stopPolling, finishConnected])

  const cancelPending = useCallback(() => {
    pollGenRef.current += 1
    stopPolling()
    setFlow('idle')
    setUserCode('')
    setVerificationUri('')
    setDeviceError('')
  }, [stopPolling])

  const submitPat = useCallback(async (e) => {
    e.preventDefault()
    const value = pat.trim()
    if (!value) {
      setPatError('Enter a GitHub personal access token.')
      patInputRef.current?.focus()
      return
    }
    setPatError('')
    setPatSubmitting(true)
    window.mobius?.signal?.('github_connect_started', { method: 'pat' })
    try {
      const res = await connectToken(token, value)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setPatError(data.detail || 'Could not connect with that token.')
        return
      }
      const data = await res.json()
      // A PAT can land while a device poll is mid-flight — bump the generation
      // so a late poll resolution can't overwrite this success.
      pollGenRef.current += 1
      stopPolling()
      finishConnected(data.login)
    } catch {
      setPatError('Network error.')
    } finally {
      setPatSubmitting(false)
    }
  }, [pat, token, stopPolling, finishConnected])

  const doDisconnect = useCallback(async () => {
    setDisconnectError('')
    setDisconnecting(true)
    try {
      const res = await disconnect(token)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setDisconnectError(data.detail || 'Could not disconnect.')
        return
      }
      setDisconnectConfirm(false)
      setFlow('idle')
      setConnectedLogin('')
      onChanged?.()
    } catch {
      setDisconnectError('Network error.')
    } finally {
      setDisconnecting(false)
    }
  }, [token, onChanged])

  const state = conn?.state

  // No verdict yet / probe failed — the feed still renders from cache.
  if (state === 'unknown') return null

  if (state === 'unsupported') {
    return (
      <div className="co-conn">
        <span className="co-conn-dot is-warn" aria-hidden="true" />
        <div className="co-conn-body">
          <p className="co-conn-title">Platform update needed</p>
          <p className="co-conn-text">
            This Möbius version predates GitHub support. Update Möbius, then
            return here to connect GitHub.
          </p>
        </div>
      </div>
    )
  }

  const isConnected = flow === 'complete' || state === 'connected'
  if (isConnected) {
    const login = connectedLogin || conn?.login || 'your account'
    const workflowEnabled = conn?.scopes?.includes('workflow')
    const workflowFlow = flowPurpose === 'workflow'
    return (
      <div className={'co-conn is-connected' + (settingsOpen ? ' is-open' : '')}>
        <div className="co-conn-summary">
          <span className="co-conn-dot is-ok" aria-hidden="true" />
          <div className="co-conn-body">
            <p className="co-conn-title">
              {justConnected ? 'GitHub connected' : `GitHub · ${login}`}
            </p>
          </div>
          <button
            type="button"
            className="co-icon-btn co-access-btn"
            aria-expanded={settingsOpen}
            aria-label={settingsOpen ? 'Close GitHub settings' : 'GitHub settings'}
            title={settingsOpen ? 'Close settings' : 'GitHub settings'}
            onClick={() => setSettingsOpen((open) => !open)}
          >
            <Icon name="settings" />
          </button>
        </div>

        {settingsOpen && (
          <div className="co-conn-settings">
            <p className="co-conn-hint">
              Reviewed PRs publish through <strong>{login}</strong>. Public actions
              still require your explicit approval.
            </p>
            {workflowEnabled ? (
              <p className="co-conn-hint">
                Workflow access is enabled for reviewed workflow changes and
                safe fast-forwards of stale forks.
              </p>
            ) : (
              <div className="co-conn-device">
                <p className="co-conn-hint">
                  Workflow access is optional. It is only needed for reviewed
                  workflow changes or to safely update a stale fork.
                </p>
                {workflowFlow && flow === 'pending' ? (
                  <>
                    <p className="co-conn-hint">
                      Open{' '}
                      <a href={verificationUri} target="_blank" rel="noopener noreferrer">
                        {verificationUri || 'github.com/login/device'}
                      </a>
                      {' '}and enter this code:
                    </p>
                    <div className="co-conn-code" aria-label="GitHub device code">
                      {userCode}
                    </div>
                    <div className="co-conn-wait">
                      <p className="co-conn-waiting">Waiting for GitHub…</p>
                      <button type="button" className="co-btn co-btn-sm" onClick={cancelPending}>
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <button
                    type="button"
                    className="co-btn co-btn-sm"
                    onClick={() => startDeviceFlow(true)}
                    disabled={workflowFlow && flow === 'starting'}
                  >
                    {workflowFlow && flow === 'starting' ? 'Starting…' : 'Enable workflow access'}
                  </button>
                )}
                {workflowFlow && deviceError && (
                  <p className="co-conn-error" role="status" aria-live="polite">{deviceError}</p>
                )}
              </div>
            )}
            {disconnectError && (
              <p className="co-conn-error" role="status" aria-live="polite">{disconnectError}</p>
            )}
            <div className="co-conn-actions">
              {disconnectConfirm ? (
                <>
                  <button
                    type="button"
                    className="co-btn co-btn-sm"
                    onClick={() => setDisconnectConfirm(false)}
                    disabled={disconnecting}
                  >
                    Keep connected
                  </button>
                  <button
                    type="button"
                    className="co-btn co-btn-sm co-btn-danger"
                    onClick={doDisconnect}
                    disabled={disconnecting}
                  >
                    {disconnecting ? 'Disconnecting…' : 'Disconnect'}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="co-btn co-btn-sm co-btn-danger"
                  onClick={() => { setDisconnectError(''); setDisconnectConfirm(true) }}
                >
                  Disconnect GitHub
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Disconnected — the connect flow. Device flow when the server offers it,
  // classic-PAT fallback always. When the device flow IS available the PAT form
  // is collapsed behind an "Advanced" disclosure so the default view is one tap;
  // when it is the only path, the form stays open as before.
  const deviceFlowAvailable = !!conn?.deviceFlowAvailable
  const patForm = (
    <form className="co-conn-pat" onSubmit={submitPat}>
      <p className="co-conn-hint">
        Paste a <strong>classic</strong> personal access token with the{' '}
        <code>public_repo</code> scope (
        <a href={TOKEN_CREATE_URL} target="_blank" rel="noopener noreferrer">
          create one
        </a>
        ).
      </p>
      <div className="co-conn-form">
        <input
          ref={patInputRef}
          className="co-conn-input"
          type="password"
          name="github-token"
          value={pat}
          onChange={(e) => setPat(e.target.value)}
          placeholder="ghp_…"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={!!patError}
          aria-describedby={patError ? 'co-github-token-error' : undefined}
          aria-label="GitHub personal access token"
        />
        <button
          className="co-btn co-btn-primary co-btn-block"
          type="submit"
          disabled={patSubmitting}
        >
          {patSubmitting ? 'Connecting…' : 'Connect with token'}
        </button>
      </div>
      {patError && (
        <p id="co-github-token-error" className="co-conn-error" role="status" aria-live="polite">
          {patError}
        </p>
      )}
    </form>
  )
  return (
    <div className="co-conn is-column">
      <div className="co-conn-row">
        <span className="co-conn-dot is-accent" aria-hidden="true" />
        <div className="co-conn-body">
          <p className="co-conn-title">Connect GitHub to contribute</p>
          <p className="co-conn-text">
            When your agent improves a Möbius app or the platform, it can share
            that fix upstream so it ships to everyone. Connect your GitHub
            account to turn that on — your agent still asks before every public
            action.
          </p>
        </div>
      </div>

      {deviceFlowAvailable && (
        <div className="co-conn-device">
          {flow === 'pending' ? (
            <>
              <p className="co-conn-hint">
                Open{' '}
                <a href={verificationUri} target="_blank" rel="noopener noreferrer">
                  {verificationUri || 'github.com/login/device'}
                </a>
                {' '}and enter this code:
              </p>
              <div className="co-conn-code" aria-label="GitHub device code">
                {userCode}
              </div>
              <div className="co-conn-wait">
                <p className="co-conn-waiting">Waiting for GitHub…</p>
                <button type="button" className="co-btn co-btn-sm" onClick={cancelPending}>
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              className="co-btn co-btn-primary co-btn-block"
              onClick={() => startDeviceFlow(false)}
              disabled={flow === 'starting'}
            >
              {flow === 'starting' ? 'Starting…' : 'Connect with GitHub'}
            </button>
          )}
          {deviceError && (
            <p className="co-conn-error" role="status" aria-live="polite">{deviceError}</p>
          )}
        </div>
      )}

      {deviceFlowAvailable ? (
        <div className="co-conn-advanced">
          <button
            type="button"
            className="co-conn-advanced-toggle"
            aria-expanded={patOpen}
            onClick={() => setPatOpen((open) => !open)}
          >
            Advanced: use a token instead
          </button>
          {patOpen ? patForm : null}
        </div>
      ) : (
        patForm
      )}
    </div>
  )
}
