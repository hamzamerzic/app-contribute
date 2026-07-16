import assert from 'node:assert/strict'
import test from 'node:test'
import {
  blockedReviewCount,
  indexReviewStatus,
  reviewStateFor,
  summarizeReviewStatus,
} from '../review.js'

test('indexes only recognized review verdicts', () => {
  const indexed = indexReviewStatus({
    generated_at: '2026-07-15T02:00:00Z',
    records: [
      { id: 'good', state: 'ready', code: 'ready', message: 'Exact.' },
      { id: 'stale', state: 'needs_refresh', code: 'branch_moved', message: 'Moved.' },
      { id: 'future', state: 'maybe' },
      null,
    ],
  })
  assert.deepEqual(Object.keys(indexed.byId), ['good', 'stale'])
  assert.equal(indexed.checkedAt, '2026-07-15T02:00:00Z')
})

test('keeps a persisted submit failure visible on an older platform', () => {
  const state = reviewStateFor({
    id: 'old', status: 'prepared', last_submit_error: 'Branch changed.',
  }, { state: 'unsupported', byId: {} })
  assert.equal(state.state, 'needs_refresh')
  assert.equal(state.code, 'previous_submit_failure')
})

test('summarizes ready, blocked, and unchecked reviews', () => {
  const records = [
    { id: 'a', status: 'prepared' },
    { id: 'b', status: 'prepared' },
    { id: 'c', status: 'prepared' },
    { id: 'open', status: 'open' },
  ]
  const review = indexReviewStatus({ records: [
    { id: 'a', state: 'ready' },
    { id: 'b', state: 'needs_refresh', message: 'Moved.' },
  ] })
  assert.deepEqual(summarizeReviewStatus(records, review), {
    total: 3, ready: 1, needsRefresh: 1, unchecked: 1,
  })
  assert.equal(blockedReviewCount(records, review), 1)
})
