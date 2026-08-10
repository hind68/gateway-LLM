const PLACEHOLDER_PATTERN = /\[[A-Z0-9_]+]/g

export function normalizeSensitiveSpans(text, matches = []) {
  const length = text.length
  const sorted = [...matches]
    .filter((match) => Number.isInteger(match.start) && Number.isInteger(match.end))
    .map((match) => ({
      ...match,
      start: Math.max(0, Math.min(match.start, length)),
      end: Math.max(0, Math.min(match.end, length)),
    }))
    .filter((match) => match.end > match.start)
    .sort((left, right) => left.start - right.start || (right.end - right.start) - (left.end - left.start))

  const result = []
  let cursor = 0
  sorted.forEach((match) => {
    if (match.start < cursor) return
    result.push(match)
    cursor = match.end
  })
  return result
}

export function splitTextBySpans(text, spans) {
  const parts = []
  let cursor = 0
  spans.forEach((span) => {
    if (span.start > cursor) {
      parts.push({ kind: 'text', text: text.slice(cursor, span.start) })
    }
    parts.push({ kind: 'mark', text: text.slice(span.start, span.end), match: span })
    cursor = span.end
  })
  if (cursor < text.length) {
    parts.push({ kind: 'text', text: text.slice(cursor) })
  }
  return parts
}

export function splitMaskedTextByPlaceholders(text, placeholders = []) {
  const known = new Set(placeholders.filter(Boolean))
  const parts = []
  let cursor = 0
  for (const match of text.matchAll(PLACEHOLDER_PATTERN)) {
    const value = match[0]
    const start = match.index
    if (start > cursor) {
      parts.push({ kind: 'text', text: text.slice(cursor, start) })
    }
    parts.push({ kind: known.size === 0 || known.has(value) ? 'mark' : 'text', text: value })
    cursor = start + value.length
  }
  if (cursor < text.length) {
    parts.push({ kind: 'text', text: text.slice(cursor) })
  }
  return parts
}
