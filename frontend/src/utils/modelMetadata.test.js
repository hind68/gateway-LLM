import { describe, expect, it } from 'vitest'
import { titleFrom } from './modelMetadata'

describe('modelMetadata titleFrom', () => {
  it('ignores attachment metadata when generating a conversation title', () => {
    expect(titleFrom('Pieces jointes: test.docx')).toBe('Nouvelle conversation')
    expect(titleFrom('Pieces jointes: test.docx\nRésume ce contrat @finance')).toBe('Discussion: Résume ce contrat @finance')
  })
})
