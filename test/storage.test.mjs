import test from 'node:test'
import assert from 'node:assert/strict'

import { abandonPrepared, loadLedger, restoreAbandoned } from '../storage.js'

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
  assert.deepEqual(result.omitted, [])
})

test('ledger isolates entries without batched content without request fan-out', async () => {
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
        async get(path) { gets.push(path); return { id: 'legacy' } },
      },
    },
  }

  const result = await loadLedger()
  assert.deepEqual(result.records.map((record) => record.id), ['batched'])
  assert.deepEqual(result.omitted, ['contributions/legacy.json'])
  assert.deepEqual(gets, [])
})

test('ledger keeps a bounded compatibility path for metadata-only runtimes', async () => {
  const gets = []
  globalThis.window = {
    mobius: {
      storage: {
        async list() {
          return [
            { name: 'a.json', path: 'contributions/a.json', type: 'file', size: 120 },
            { name: 'b.json', path: 'contributions/b.json', type: 'file', size: 180 },
          ]
        },
        async get(path) {
          gets.push(path)
          return { id: path.endsWith('a.json') ? 'a' : 'b' }
        },
      },
    },
  }

  const result = await loadLedger()
  assert.deepEqual(result.records.map((record) => record.id), ['a', 'b'])
  assert.deepEqual(result.omitted, [])
  assert.deepEqual(gets, ['contributions/a.json', 'contributions/b.json'])
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
    omitted: [],
  })
})

test('500 missing-content entries never become 500 fallback GETs', async () => {
  let gets = 0
  globalThis.window = {
    mobius: {
      storage: {
        async list() {
          return Array.from({ length: 500 }, (_, index) => ({
            name: `${index}.json`,
            path: `contributions/${index}.json`,
            type: 'file',
          }))
        },
        async get() { gets += 1; return null },
      },
    },
  }

  const result = await loadLedger()
  assert.equal(result.records.length, 0)
  assert.equal(result.omitted.length, 500)
  assert.equal(gets, 0)
})

test('dismissal uses the runtime CAS version and never blind-writes', async () => {
  const writes = []
  globalThis.window = {
    mobius: {
      online: true,
      storage: {
        async _getWithVersion(path, format) {
          assert.equal(path, 'contributions/safe.json')
          assert.equal(format, 'json')
          return { value: { id: 'safe', status: 'prepared' }, version: 'v7' }
        },
        async durableWrite(path, value, options) {
          writes.push({ path, value, options })
        },
      },
    },
  }

  const result = await abandonPrepared({ rec: { id: 'safe' } })
  assert.equal(result.ok.status, 'abandoned')
  assert.deepEqual(writes.map(({ path, value, options }) => ({
    path, status: value.status, options,
  })), [{
    path: 'contributions/safe.json',
    status: 'abandoned',
    options: { ifMatch: 'v7' },
  }])
})

test('dismissal retries one CAS conflict against the newly read record', async () => {
  let reads = 0
  let writes = 0
  globalThis.window = {
    mobius: {
      online: true,
      storage: {
        async _getWithVersion() {
          reads += 1
          return {
            value: { id: 'race', status: 'prepared', revision: reads },
            version: `v${reads}`,
          }
        },
        async durableWrite(_path, value, options) {
          writes += 1
          if (writes === 1) throw Object.assign(new Error('changed'), { code: 'conflict' })
          assert.equal(value.revision, 2)
          assert.deepEqual(options, { ifMatch: 'v2' })
        },
      },
    },
  }

  const result = await abandonPrepared({ rec: { id: 'race' } })
  assert.equal(result.ok.status, 'abandoned')
  assert.equal(reads, 2)
  assert.equal(writes, 2)
})

test('restore refuses to write when a CAS version is unavailable', async () => {
  let writes = 0
  globalThis.window = {
    mobius: {
      online: true,
      storage: {
        async _getWithVersion() {
          return { value: { id: 'unsafe', status: 'abandoned' }, version: null }
        },
        async durableWrite() { writes += 1 },
      },
    },
  }

  const result = await restoreAbandoned({ rec: { id: 'unsafe' } })
  assert.equal(result.error, 'Safe storage updates are unavailable.')
  assert.equal(writes, 0)
})
