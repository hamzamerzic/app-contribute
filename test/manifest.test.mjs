import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const manifest = JSON.parse(readFileSync(new URL('../mobius.json', import.meta.url), 'utf8'))

test('install manifest ships the refresh coordinator imported by the entry point', () => {
  assert.ok(manifest.source_files.includes('refresh.js'))
})

test('install manifest ships the label outcome helper imported by the review card', () => {
  assert.ok(manifest.source_files.includes('labels.js'))
})
