// Unified-diff parsing for the review card. The renderer stays React-native
// (text nodes, no injected HTML); this parser only classifies git diff lines so
// the UI can show file headers, hunks, line numbers, and additions/deletions.

function cleanDiffPath(path) {
  const raw = String(path || '').trim()
  if (!raw || raw === '/dev/null') return ''
  const unquoted = raw[0] === '"' && raw[raw.length - 1] === '"'
    ? raw.slice(1, -1).replace(/\\"/g, '"')
    : raw
  return unquoted.replace(/^[ab]\//, '')
}

function fileLabel(file) {
  return file.newPath || file.oldPath || file.header || 'Diff'
}

function newFile(header) {
  return {
    header: header || '',
    oldPath: '',
    newPath: '',
    additions: 0,
    deletions: 0,
    rows: [],
  }
}

export function parseUnifiedDiff(input) {
  const text = String(input || '')
  if (!text.trim()) return []

  const rawLines = text.split(/\r?\n/)
  if (rawLines[rawLines.length - 1] === '') rawLines.pop()

  const files = []
  let current = null
  let inHunk = false
  let oldLine = 0
  let newLine = 0

  function ensureFile() {
    if (!current) {
      current = newFile('')
      files.push(current)
    }
    return current
  }

  for (const raw of rawLines) {
    const gitHeader = raw.match(/^diff --git (.+?) (.+)$/)
    if (gitHeader) {
      current = newFile(raw)
      current.oldPath = cleanDiffPath(gitHeader[1])
      current.newPath = cleanDiffPath(gitHeader[2])
      files.push(current)
      inHunk = false
      continue
    }

    if (raw.startsWith('--- ')) {
      ensureFile().oldPath = cleanDiffPath(raw.slice(4))
      continue
    }
    if (raw.startsWith('+++ ')) {
      ensureFile().newPath = cleanDiffPath(raw.slice(4))
      continue
    }

    const hunk = raw.match(/^@@\s+-(\d+)(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s+@@(.*)$/)
    if (hunk) {
      ensureFile().rows.push({
        kind: 'hunk',
        content: raw,
      })
      oldLine = Number(hunk[1]) || 0
      newLine = Number(hunk[2]) || 0
      inHunk = true
      continue
    }

    const file = ensureFile()
    if (!inHunk) {
      if (raw) file.rows.push({ kind: 'meta', content: raw })
      continue
    }

    if (raw.startsWith('\\')) {
      file.rows.push({ kind: 'note', content: raw })
      continue
    }

    const marker = raw[0] || ' '
    const content = raw.length > 0 ? raw.slice(1) : ''
    if (marker === '+') {
      file.additions += 1
      file.rows.push({
        kind: 'add',
        marker,
        oldNumber: '',
        newNumber: newLine++,
        content,
      })
    } else if (marker === '-') {
      file.deletions += 1
      file.rows.push({
        kind: 'del',
        marker,
        oldNumber: oldLine++,
        newNumber: '',
        content,
      })
    } else {
      file.rows.push({
        kind: 'context',
        marker: ' ',
        oldNumber: oldLine++,
        newNumber: newLine++,
        content: marker === ' ' ? content : raw,
      })
    }
  }

  return files.map((file) => ({ ...file, label: fileLabel(file) }))
}
