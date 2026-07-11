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

// Parse the tail of `git diff --stat` into structured counts. The summary line
// ("N files changed, A insertions(+), B deletions(-)") is authoritative for the
// totals — that is what the collapsed card's diffline and the file-list header
// show. The per-file rows ("path | N +++--") give per-file paths with an
// APPROXIMATE add/del split recovered from the bar characters; git scales the
// bar, so the split is exact only for small files. The file list uses those
// rows solely as a fallback when the full .diff blob is missing, which is why
// approximate is honest enough. Returns null when nothing parses.
export function parseDiffStat(input) {
  const text = String(input || '')
  if (!text.trim()) return null

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+$/, ''))
    .filter((line) => line.trim())

  const files = []
  let totalFiles = 0
  let additions = 0
  let deletions = 0
  let sawSummary = false

  for (const line of lines) {
    // The summary line carries the authoritative totals and has no " | "
    // column, which distinguishes it from a file row whose name happens to
    // contain the words "files changed".
    const summary = line.match(/(\d+)\s+files?\s+changed/)
    if (summary && !line.includes('|')) {
      totalFiles = Number(summary[1]) || 0
      const ins = line.match(/(\d+)\s+insertions?\(\+\)/)
      const del = line.match(/(\d+)\s+deletions?\(-\)/)
      additions = ins ? Number(ins[1]) : 0
      deletions = del ? Number(del[1]) : 0
      sawSummary = true
      continue
    }

    // A per-file row: "<path> | <count> <bar>" or "<path> | Bin ...".
    const row = line.match(/^(.*\S)\s+\|\s+(.+)$/)
    if (!row) continue
    const path = row[1].trim()
    const rest = row[2].trim()
    if (/^Bin\b/.test(rest)) {
      files.push({ path, additions: 0, deletions: 0, binary: true })
      continue
    }
    const num = rest.match(/^(\d+)/)
    if (!num) continue
    const total = Number(num[1]) || 0
    const plus = (rest.match(/\+/g) || []).length
    const minus = (rest.match(/-/g) || []).length
    let add = 0
    let rem = 0
    if (total > 0 && plus + minus > 0) {
      add = Math.round((total * plus) / (plus + minus))
      rem = total - add
    } else if (total > 0) {
      add = total // no bar to split on — attribute the whole to additions
    }
    files.push({ path, additions: add, deletions: rem, binary: false })
  }

  if (!sawSummary && files.length === 0) return null
  if (!sawSummary) {
    totalFiles = files.length
    additions = files.reduce((acc, f) => acc + f.additions, 0)
    deletions = files.reduce((acc, f) => acc + f.deletions, 0)
  } else if (totalFiles === 0) {
    totalFiles = files.length
  }
  return { totalFiles, additions, deletions, files }
}
