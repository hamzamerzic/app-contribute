import test from 'node:test'
import assert from 'node:assert/strict'

import { loadLedger } from '../storage.js'

test('ledger uses JSON content batched into the storage listing', async () => {
  const gets = []
  let listOptions = null
  globalThis.window = {
    mobius: {
      storage: {
        async list(_prefix, options) {
          listOptions = options
          return [
            { name: 'a.json', type: 'file', content: { id: 'a' } },
            { name: 'b.json', type: 'file', content: { id: 'b' } },
            { name: 'proposal.diff', type: 'file' },
          ]
        },
        async get(path) { gets.push(path); return null },
      },
    },
  }

  const result = await loadLedger()
  assert.deepEqual(listOptions, { includeContent: true })
  assert.deepEqual(result.records.map((record) => record.id).sort(), ['a', 'b'])
  assert.deepEqual(gets, [])
})

test('ledger falls back only for entries without batched content', async () => {
  const gets = []
  globalThis.window = {
    mobius: {
      storage: {
        async list() {
          return [
            { name: 'batched.json', type: 'file', content: { id: 'batched' } },
            { name: 'legacy.json', type: 'file' },
          ]
        },
        async get(path) {
          gets.push(path)
          return { id: 'legacy' }
        },
      },
    },
  }

  const result = await loadLedger()
  assert.deepEqual(result.records.map((record) => record.id).sort(), [
    'batched', 'legacy',
  ])
  assert.deepEqual(gets, ['contributions/legacy.json'])
})

test('an offline empty mirror falls back to the assembled feed cache', async () => {
  globalThis.window = {
    mobius: {
      online: false,
      storage: {
        async list() { return [] },
        async get(path) {
          assert.equal(path, 'feed-cache.json')
          return [{ id: 'cached' }]
        },
      },
    },
  }

  assert.deepEqual(await loadLedger(), {
    records: [{ id: 'cached' }],
    fromCache: true,
  })
})
