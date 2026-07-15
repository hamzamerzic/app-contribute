import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const cardSource = readFileSync(new URL('../ui/ContributionCard.jsx', import.meta.url), 'utf8')
const stackSource = readFileSync(new URL('../ui/ContributionStack.jsx', import.meta.url), 'utf8')

test('send actions keep a visible label instead of relying on the icon alone', () => {
  assert.match(cardSource, /sending \? 'Sending…' : 'Send'/)
  assert.match(stackSource, /<span>Send<\/span>/)
})

test('single and stacked sends expose elapsed progress to assistive technology', () => {
  for (const source of [cardSource, stackSource]) {
    assert.match(source, /role="status" aria-live="polite"/)
    assert.match(source, /sendElapsed/)
  }
})
