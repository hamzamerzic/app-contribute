import test from 'node:test'
import assert from 'node:assert/strict'

import { mergeRecordUpdates, reconcileLedgerSnapshot } from '../domain.js'

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
