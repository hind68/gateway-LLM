import ReactMarkdown from 'react-markdown'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { normalizeAssistantMarkdown } from './markdown'

describe('normalizeAssistantMarkdown', () => {
  it('normalizes standard and malformed headings before Markdown rendering', () => {
    expect(renderMarkdown('# Title')).toContain('<h1>Title</h1>')
    expect(renderMarkdown('#Title')).toContain('<h1>Title</h1>')
    expect(renderMarkdown('\\# Title')).toContain('<h1>Title</h1>')
    expect(renderMarkdown('## Subtitle')).toContain('<h2>Subtitle</h2>')
    expect(renderMarkdown('\\### Subtitle')).toContain('<h3>Subtitle</h3>')
  })

  it('preserves include directives outside headings', () => {
    expect(normalizeAssistantMarkdown('#include <stdio.h>')).toBe('#include <stdio.h>')
    expect(normalizeAssistantMarkdown('\\#include <stdio.h>')).toBe('\\#include <stdio.h>')
  })

  it('does not modify include directives inside fenced code blocks', () => {
    const code = ['```c', '#include <stdio.h>', 'int main(void) { return 0; }', '```'].join('\n')
    expect(normalizeAssistantMarkdown(code)).toBe(code)
  })

  it('does not modify code inside an unfinished fenced block while streaming', () => {
    const partialCode = ['```c', '#include <stdio.h>'].join('\n')
    expect(normalizeAssistantMarkdown(partialCode)).toBe(partialCode)
  })

  it('handles partial streamed heading tokens without corrupting incomplete markers', () => {
    expect(normalizeAssistantMarkdown('#')).toBe('#')
    expect(normalizeAssistantMarkdown('# ')).toBe('# ')
    expect(normalizeAssistantMarkdown('# T')).toBe('# T')
    expect(normalizeAssistantMarkdown('#Title')).toBe('# Title')
    expect(normalizeAssistantMarkdown('\\#')).toBe('\\#')
    expect(normalizeAssistantMarkdown('\\# ')).toBe('\\# ')
    expect(normalizeAssistantMarkdown('\\# T')).toBe('# T')
  })
})

function renderMarkdown(content) {
  return renderToStaticMarkup(
    <ReactMarkdown>
      {normalizeAssistantMarkdown(content)}
    </ReactMarkdown>,
  )
}
