import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import test from 'node:test'

const frontendModules = process.env.MOBIUS_FRONTEND_NODE_MODULES

async function cardRenderer() {
  const esbuildUrl = pathToFileURL(join(frontendModules, 'esbuild', 'lib', 'main.js')).href
  const { build } = await import(esbuildUrl)
  const projectRoot = dirname(fileURLToPath(new URL('../package.json', import.meta.url)))
  const result = await build({
    stdin: {
      contents: `
        import React from 'react'
        import { renderToStaticMarkup } from 'react-dom/server'
        import { ContributionCard } from './ui/ContributionCard.jsx'
        export function renderCard(rec) {
          return renderToStaticMarkup(React.createElement(ContributionCard, { rec }))
        }
      `,
      loader: 'jsx',
      resolveDir: projectRoot,
    },
    bundle: true,
    format: 'cjs',
    platform: 'node',
    nodePaths: [frontendModules],
    write: false,
  })
  const bundledModule = { exports: {} }
  const evaluate = new Function('module', 'exports', 'require', result.outputFiles[0].text)
  evaluate(bundledModule, bundledModule.exports, createRequire(import.meta.url))
  return bundledModule.exports
}

test('open and draft cards expose durable label failures without Send controls', async (t) => {
  if (!frontendModules) {
    t.skip('MOBIUS_FRONTEND_NODE_MODULES is required for component rendering')
    return
  }
  const { renderCard } = await cardRenderer()
  for (const status of ['open', 'draft']) {
    const html = renderCard({
      id: `published-${status}`,
      type: 'pr',
      status,
      title: 'Truthful labels',
      repo: 'mobius-os/app-demo',
      url: 'https://github.com/mobius-os/app-demo/pull/42',
      plan: { labels: ['bug', 'area: ui'] },
      last_submit_labels_requested: ['bug', 'area: ui'],
      last_submit_labels_applied: [],
      last_submit_labels_note: 'GitHub did not confirm these labels were applied.',
    })

    assert.match(html, /Labels need attention/)
    assert.match(html, /Requested/)
    assert.match(html, /Not confirmed/)
    assert.match(html, /GitHub did not confirm these labels were applied\./)
    assert.match(html, /Review labels on GitHub/)
    assert.match(html, /do not send it again/)
    assert.doesNotMatch(html, /Send pull request|Send for review|Contribution actions/)
  }
})

test('fully applied published labels stay compact', async (t) => {
  if (!frontendModules) {
    t.skip('MOBIUS_FRONTEND_NODE_MODULES is required for component rendering')
    return
  }
  const { renderCard } = await cardRenderer()
  const html = renderCard({
    id: 'published-success',
    type: 'pr',
    status: 'open',
    title: 'Truthful labels',
    repo: 'mobius-os/app-demo',
    url: 'https://github.com/mobius-os/app-demo/pull/42',
    plan: { labels: ['bug', 'area: ui'] },
    last_submit_labels_requested: ['bug', 'area: ui'],
    last_submit_labels_applied: ['bug', 'area: ui'],
  })

  assert.match(html, /Labels applied/)
  assert.match(html, /bug/)
  assert.match(html, /area: ui/)
  assert.doesNotMatch(html, /Labels need attention|Requested|do not send it again/)
})
