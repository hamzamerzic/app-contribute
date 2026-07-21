import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const cardSource = readFileSync(new URL('../ui/ContributionCard.jsx', import.meta.url), 'utf8')
const stackSource = readFileSync(new URL('../ui/ContributionStack.jsx', import.meta.url), 'utf8')
const appSource = readFileSync(new URL('../index.jsx', import.meta.url), 'utf8')
const connectionSource = readFileSync(new URL('../ui/ConnectionCard.jsx', import.meta.url), 'utf8')
const themeSource = readFileSync(new URL('../theme.js', import.meta.url), 'utf8')

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

test('the review app does not offer an unreliable contribution-start action', () => {
  for (const source of [appSource, connectionSource]) {
    assert.doesNotMatch(source, /Start a contribution|onStartContribution|onAskAgent/)
  }
  assert.match(appSource, /No contributions to review/)
})

test('top-level tabs share one stable page width', () => {
  assert.match(themeSource, /\.co-page \{[\s\S]*?width: min\(100%, 1120px\)/)
  assert.match(themeSource, /\.co-header,[\s\S]*?\.co-contributions-view[\s\S]*?width: min\(100%, 680px\)/)
  assert.doesNotMatch(themeSource, /\.co-page\.is-sources \{\s*width:/)
})

test('cards use explicit links and detail buttons instead of a clickable container', () => {
  assert.doesNotMatch(cardSource, /handleCardClick|is-clickable/)
  assert.match(cardSource, /className="co-details-toggle"/)
  assert.match(cardSource, /className="co-card-title"/)
})

test('the token form explains an empty submit instead of silently doing nothing', () => {
  assert.match(connectionSource, /Enter a GitHub personal access token\./)
  assert.match(connectionSource, /disabled=\{patSubmitting\}/)
  assert.match(connectionSource, /aria-invalid=\{!!patError\}/)
})
