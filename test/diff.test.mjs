import assert from 'node:assert/strict'
import test from 'node:test'
import { parseUnifiedDiff } from '../diff.js'

test('parseUnifiedDiff groups files, hunks, and line numbers', () => {
  const files = parseUnifiedDiff(`diff --git a/src/a.js b/src/a.js
index 111..222 100644
--- a/src/a.js
+++ b/src/a.js
@@ -1,3 +1,4 @@
 const a = 1
-const b = 2
+const b = 3
+const c = 4
 export { a, b }
`)

  assert.equal(files.length, 1)
  assert.equal(files[0].label, 'src/a.js')
  assert.equal(files[0].additions, 2)
  assert.equal(files[0].deletions, 1)
  assert.deepEqual(
    files[0].rows
      .filter((row) => row.kind === 'add' || row.kind === 'del')
      .map((row) => [row.kind, row.oldNumber, row.newNumber, row.content]),
    [
      ['del', 2, '', 'const b = 2'],
      ['add', '', 2, 'const b = 3'],
      ['add', '', 3, 'const c = 4'],
    ],
  )
})

test('parseUnifiedDiff handles new files and no-newline notes', () => {
  const files = parseUnifiedDiff(`diff --git a/dev/null b/notes.md
--- /dev/null
+++ b/notes.md
@@ -0,0 +1,2 @@
+# Notes
+Body
\\ No newline at end of file`)

  assert.equal(files[0].oldPath, '')
  assert.equal(files[0].newPath, 'notes.md')
  assert.equal(files[0].rows.at(-1).kind, 'note')
})
