import { describe, expect, it } from 'vitest'
import { normalizeSensitiveSpans, splitMaskedTextByPlaceholders, splitTextBySpans } from './dlpViews'

describe('dlp view helpers', () => {
  it('preserves multiline code indentation and highlights placeholders', () => {
    const text = 'String apiKey = "[OPENAI_API_KEY_1]";\n  String cin = "[MOROCCAN_CIN_1]";'
    const parts = splitMaskedTextByPlaceholders(text, ['[OPENAI_API_KEY_1]', '[MOROCCAN_CIN_1]'])

    expect(parts.map((part) => part.text).join('')).toBe(text)
    expect(parts.filter((part) => part.kind === 'mark').map((part) => part.text))
      .toEqual(['[OPENAI_API_KEY_1]', '[MOROCCAN_CIN_1]'])
  })

  it('highlights original text at the public offsets and skips overlaps', () => {
    const text = 'abc SECRET xyz'
    const spans = normalizeSensitiveSpans(text, [
      { type: 'secret', start: 4, end: 10, placeholder: '[SECRET_1]' },
      { type: 'overlap', start: 5, end: 8, placeholder: '[OVERLAP_1]' },
    ])
    const parts = splitTextBySpans(text, spans)

    expect(parts.map((part) => part.text).join('')).toBe(text)
    expect(parts.filter((part) => part.kind === 'mark')).toHaveLength(1)
    expect(parts.find((part) => part.kind === 'mark').text).toBe('SECRET')
  })
})
