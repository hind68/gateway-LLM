import { describe, expect, it } from 'vitest'
import { dlpUserMessage } from './dlpErrors'

describe('dlpUserMessage', () => {
  it('formats a blocked Moroccan CIN error without exposing technical fields', () => {
    const message = dlpUserMessage(JSON.stringify({
      code: 'DLP_BLOCKED',
      message: 'Votre message contient une donnée sensible et ne peut pas être envoyé.',
      detectedTypes: ['moroccan_cin'],
      highestSeverity: 'high',
    }))

    expect(message).toBe([
      'Votre message a été bloqué.',
      'Une donnée sensible de type CIN a été détectée.',
      'Supprimez ou masquez cette information, puis réessayez.',
    ].join('\n'))
    expect(message).not.toContain('DLP_BLOCKED')
    expect(message).not.toContain('highestSeverity')
    expect(message).not.toContain('{')
  })

  it('formats several blocked detected types as a French list', () => {
    expect(dlpUserMessage({
      code: 'DLP_BLOCKED',
      detectedTypes: ['moroccan_cin', 'email'],
      highestSeverity: 'high',
    })).toBe([
      'Votre message a été bloqué.',
      'Des données sensibles ont été détectées : CIN et adresse e-mail.',
      'Supprimez ou masquez ces informations, puis réessayez.',
    ].join('\n'))
  })

  it('formats unavailable DLP control without technical details', () => {
    expect(dlpUserMessage({
      code: 'DLP_UNAVAILABLE',
      message: 'backend detail',
    })).toBe([
      'Contrôle de sécurité indisponible.',
      'Votre message n’a pas été envoyé au modèle.',
      'Réessayez dans quelques instants.',
    ].join('\n'))
  })
})
