import { describe, expect, it } from 'vitest'
import { displayConversationTitle, titleFrom } from './modelMetadata'

describe('modelMetadata titleFrom', () => {
  it('ignores attachment metadata when generating a conversation title', () => {
    expect(titleFrom('Pieces jointes: test.docx')).toBe('Nouvelle conversation')
    expect(titleFrom('Pieces jointes: test.docx\nRésume ce contrat @finance')).toBe('Discussion: Résume ce contrat @finance')
  })
})

describe('modelMetadata displayConversationTitle', () => {
  it('hides attachment prefixes when displaying conversation titles', () => {
    expect(displayConversationTitle('Pieces jointes: facture.pdf')).toBe('facture.pdf')
    expect(displayConversationTitle('Discussion: Pi\u00e8ces jointes : contrat.pdf')).toBe('contrat.pdf')
  })
})
