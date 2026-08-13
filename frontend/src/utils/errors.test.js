import { describe, expect, it } from 'vitest'
import { friendlyGenerationError } from './errors'

describe('friendlyGenerationError', () => {
  it('shows client validation messages without the HTTP prefix', () => {
    expect(friendlyGenerationError(new Error("HTTP 400 Vous pouvez joindre jusqu'\u00e0 10 fichiers par message.")))
      .toBe("Vous pouvez joindre jusqu'\u00e0 10 fichiers par message.")
  })

  it('shows attachment limit errors from structured backend payloads', () => {
    expect(friendlyGenerationError({
      payload: {
        code: 'ATTACHMENT_LIMIT_EXCEEDED',
        message: "Vous pouvez joindre jusqu'a 10 fichiers par message.",
        maxFiles: 10,
        receivedFiles: 11,
      },
    })).toBe("Vous pouvez joindre jusqu'\u00e0 10 fichiers par message. 11 fichiers ont \u00e9t\u00e9 s\u00e9lectionn\u00e9s.")
  })

  it('keeps the DLP unavailable message for real DLP failures', () => {
    const message = "Contr\u00f4le de s\u00e9curit\u00e9 indisponible. Votre message n'a pas \u00e9t\u00e9 envoy\u00e9 au mod\u00e8le. R\u00e9essayez dans quelques instants."
    expect(friendlyGenerationError(message)).toBe(message)
  })
})
