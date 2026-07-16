import test from 'node:test'
import assert from 'node:assert/strict'

import {
  PROBLEM_HEADLINES,
  STATUS_NARRATION,
  mergeRecordUpdates,
  problemHeadline,
  reconcileLedgerSnapshot,
  statusNarration,
} from '../domain.js'

test('record updates preserve enumerated paths while replacing stale fields', () => {
  const original = [
    { id: 'one', status: 'prepared', path: 'contributions/one.json' },
    { id: 'two', status: 'open', path: 'contributions/two.json' },
  ]
  const next = mergeRecordUpdates(original, [
    { id: 'one', status: 'abandoned', title: 'Updated' },
  ])

  assert.deepEqual(next, [
    {
      id: 'one',
      status: 'abandoned',
      title: 'Updated',
      path: 'contributions/one.json',
    },
    original[1],
  ])
})

test('a slow rescan cannot overwrite a newer submit result', () => {
  const current = [{
    id: 'one', status: 'open', updated_at: '2026-07-15T02:00:02Z',
    path: 'contributions/one.json',
  }]
  const staleSnapshot = [{
    id: 'one', status: 'submitting', updated_at: '2026-07-15T02:00:01Z',
    path: 'contributions/one.json',
  }, {
    id: 'two', status: 'prepared', updated_at: '2026-07-15T02:00:00Z',
  }]
  assert.deepEqual(reconcileLedgerSnapshot(current, staleSnapshot), [
    current[0], staleSnapshot[1],
  ])
})

test('equal timestamps keep a live GitHub status overlay', () => {
  const current = [{ id: 'one', status: 'merged', updated_at: '2026-07-15T02:00:00Z' }]
  const stored = [{ id: 'one', status: 'open', updated_at: '2026-07-15T02:00:00Z' }]
  assert.equal(reconcileLedgerSnapshot(current, stored)[0].status, 'merged')
})

test('status narration leads each lifecycle state with human copy', () => {
  assert.equal(statusNarration({ status: 'prepared' }), 'Waiting for your OK')
  assert.equal(
    statusNarration({ status: 'submitting' }),
    'Publishing — this can take up to a minute',
  )
  assert.equal(
    statusNarration({ status: 'open' }),
    'Sent — maintainers will review it; this can take days',
  )
  assert.equal(statusNarration({ status: 'closed' }), 'Not merged — tap to see why')
  // Every narration key resolves through the helper and stays calm (no shout).
  for (const [status, copy] of Object.entries(STATUS_NARRATION)) {
    assert.equal(statusNarration({ status }), copy)
    assert.ok(copy.length > 0 && !copy.includes('!'))
  }
})

test('an attention record defers to its callout, and unknown states omit the line', () => {
  // needs_attention wins: the attention callout owns that state's copy.
  assert.equal(statusNarration({ status: 'open', needs_attention: true }), '')
  assert.equal(statusNarration({ status: 'no_such_state' }), '')
  assert.equal(statusNarration(null), '')
})

test('problem codes map to short human headlines, unknown falls back to raw', () => {
  assert.equal(
    problemHeadline('branch_moved'),
    'This changed since you reviewed it — ask your agent to refresh it',
  )
  assert.equal(
    problemHeadline('previous_submit_failure'),
    'The last send did not go through — ask your agent to take another look',
  )
  // Unknown / empty / non-string codes return '' so the caller shows the raw
  // backend message unchanged (lenient read).
  assert.equal(problemHeadline('brand_new_backend_code'), '')
  assert.equal(problemHeadline(''), '')
  assert.equal(problemHeadline(undefined), '')
  // Every mapped headline is a non-empty, calm string.
  for (const headline of Object.values(PROBLEM_HEADLINES)) {
    assert.ok(headline.length > 0 && !headline.includes('!'))
  }
})
