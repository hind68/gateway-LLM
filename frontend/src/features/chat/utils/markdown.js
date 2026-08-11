export function detectTextDirection(text) {
  const rtlMatches = text.match(/[\u0590-\u05ff\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff\ufb50-\ufdff\ufe70-\ufeff]/g) || []
  const ltrMatches = text.match(/[A-Za-z\u00c0-\u024f]/g) || []
  return rtlMatches.length > ltrMatches.length ? 'rtl' : 'ltr'
}

export function normalizeMarkdownCodeFences(content) {
  return String(content || '').replace(/^```([^\s`]+)(.*)$/gm, (line, rawLanguage, rest) => {
    const language = String(rawLanguage || '').trim()
    const stickyFence = splitStickyFenceLanguage(language, rest || '')
    if (stickyFence) {
      return `\`\`\`${stickyFence.language}\n${stickyFence.code}`.trimEnd()
    }

    const normalized = normalizeCodeLanguage(language)
    if (normalized !== 'text' && normalized !== language.toLowerCase()) {
      return `\`\`\`${normalized}${rest || ''}`
    }
    return line
  })
}

export function normalizeAssistantMarkdown(content) {
  let isCodeBlock = false
  return String(content || '')
    .split('\n')
    .map((line) => {
      if (/^\s*```/.test(line)) {
        isCodeBlock = !isCodeBlock
        return line
      }

      if (isCodeBlock) return line

      return normalizeMarkdownHeading(line)
    })
    .join('\n')
}

function normalizeMarkdownHeading(line) {
  if (/^\s{0,3}\\?#include\b/i.test(line)) return line

  return line.replace(/^(\s{0,3})(\\?)(#{1,6})(?:\s+(?=\S)|(?=[^\s#]))(.*)$/, (_match, indent, escape, hashes, text) => (
    `${indent}${hashes} ${text}`
  ))
}

function splitStickyFenceLanguage(language, rest) {
  const value = String(language || '')
  const lower = value.toLowerCase()
  const candidates = [
    { language: 'cpp', match: /^cpp(#include)/i, prefixLength: 3 },
    { language: 'c', match: /^c(#include)/i, prefixLength: 1 },
    { language: 'java', match: /^java(import|package|public|class)/i, prefixLength: 4 },
    { language: 'python', match: /^python(from|import|def|class)/i, prefixLength: 6 },
  ]
  const candidate = candidates.find((item) => item.match.test(lower))
  if (!candidate) return null

  return {
    language: candidate.language,
    code: `${value.slice(candidate.prefixLength)}${rest}`,
  }
}

export function normalizeCodeLanguage(language) {
  const value = String(language || '').trim().toLowerCase()
  if (!value || value === 'code' || value === 'text') return 'text'

  const aliases = {
    c99: 'c',
    c11: 'c',
    cpp: 'cpp',
    'c++': 'cpp',
    'c#': 'csharp',
    csharp: 'csharp',
    cs: 'csharp',
    js: 'javascript',
    ts: 'typescript',
    sh: 'bash',
    shell: 'bash',
    zsh: 'bash',
    html: 'markup',
    htm: 'markup',
    xml: 'markup',
    py: 'python',
    yml: 'yaml',
    ps1: 'powershell',
    dockerfile: 'docker',
  }

  if (aliases[value]) return aliases[value]
  if (value.startsWith('c#include')) return 'c'
  if (value.startsWith('cpp#include')) return 'cpp'

  return supportedCodeLanguages.has(value) ? value : 'text'
}

const supportedCodeLanguages = new Set([
  'bash',
  'c',
  'cpp',
  'csharp',
  'css',
  'docker',
  'go',
  'java',
  'javascript',
  'json',
  'jsx',
  'kotlin',
  'markdown',
  'markup',
  'php',
  'powershell',
  'python',
  'rust',
  'sql',
  'tsx',
  'typescript',
  'yaml',
])

/**
 * Keeps copied/generated code blocks readable even when the LLM omits a language tag.
 * The detection is intentionally heuristic and local to presentation; it never changes content.
 */
export function detectCodeLanguage(code, declaredLanguage) {
  const declared = normalizeCodeLanguage(declaredLanguage)
  if (declared !== 'text') return declared

  const source = String(code || '').trim()
  if (!source) return 'text'
  const lower = source.toLowerCase()

  if (/^\s*[{[]/.test(source)) {
    try {
      JSON.parse(source)
      return 'json'
    } catch {
      // Keep checking other languages.
    }
  }

  if (/#include\s*[<"]/.test(source) && /using\s+namespace\s+std|std::|cout\s*<</.test(source)) return 'cpp'
  if (/#include\s*[<"]/.test(source)) return 'c'
  if (/console\.writeline|using\s+system|namespace\s+\w+\s*{|static\s+void\s+main\s*\(/i.test(source)) return 'csharp'
  if (/public\s+static\s+void\s+main\s*\(|system\.out\.println|import\s+java\./i.test(source)) return 'java'
  if (/import\s+react|from\s+['"]react['"]|<[A-Z][\w.]*[\s>]|className=|<\/[A-Z][\w.]*>/i.test(source)) return 'jsx'
  if (/\binterface\s+\w+|:\s*(string|number|boolean|unknown|any)\b|type\s+\w+\s*=/.test(source)) return 'typescript'
  if (/^\s*(def|class)\s+\w+|^\s*from\s+\w+\s+import\s+|^\s*import\s+\w+/m.test(source)) return 'python'
  if (/\b(select|insert\s+into|update|delete\s+from|create\s+table|alter\s+table)\b[\s\S]*(\bfrom\b|\bvalues\b|\bset\b|\()/i.test(source)) return 'sql'
  if (/^\s*<!doctype html|<html[\s>]|<\/?[a-z][\w:-]*(\s+[^>]*)?>/i.test(source)) return 'markup'
  if (/^\s*[\w.#:[\]-]+\s*{[\s\S]*:\s*[^;]+;[\s\S]*}/.test(source)) return 'css'
  if (/^\s*(function|const|let|var)\s+\w+|=>|console\.log/i.test(source)) return 'javascript'
  if (/^\s*FROM\s+\S+|^\s*RUN\s+|^\s*COPY\s+|^\s*CMD\s+/im.test(source)) return 'docker'
  if (/^\s*package\s+main|fmt\.Println|func\s+\w+\s*\(/m.test(source)) return 'go'
  if (/^\s*fn\s+\w+\s*\(|println!\s*\(|let\s+mut\s+/m.test(source)) return 'rust'
  if (/^\s*fun\s+\w+\s*\(|println\s*\(|val\s+\w+\s*=|var\s+\w+\s*=/m.test(source)) return 'kotlin'
  if (/<\?php|\becho\s+['"]|\$\w+\s*=/.test(lower)) return 'php'

  return 'text'
}

export function formatLanguageName(language) {
  const normalized = normalizeCodeLanguage(language)
  const names = {
    bash: 'Bash',
    c: 'C',
    cpp: 'C++',
    csharp: 'C#',
    css: 'CSS',
    docker: 'Dockerfile',
    go: 'Go',
    java: 'Java',
    javascript: 'JavaScript',
    json: 'JSON',
    jsx: 'JSX',
    kotlin: 'Kotlin',
    markdown: 'Markdown',
    markup: 'HTML',
    php: 'PHP',
    powershell: 'PowerShell',
    python: 'Python',
    rust: 'Rust',
    sql: 'SQL',
    text: 'Code',
    tsx: 'TSX',
    typescript: 'TypeScript',
    yaml: 'YAML',
  }
  return names[normalized] || 'Code'
}

export function hashText(value) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0
  }
  return Math.abs(hash).toString(36)
}
