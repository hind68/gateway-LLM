export async function deletionErrorMessage(response) {
  if (response.status === 404) return 'Conversation introuvable ou d\u00e9j\u00e0 supprim\u00e9e.'
  if (response.status === 409) return 'Cette conversation ne peut pas \u00eatre supprim\u00e9e pour le moment.'
  if (response.status >= 500) return 'Suppression impossible c\u00f4t\u00e9 serveur. V\u00e9rifiez les liens messages/conversation.'
  return requestStatusMessage(response, 'Impossible de supprimer la conversation.')
}

export async function requestStatusMessage(response, fallback) {
  let details
  try {
    details = await response.text()
  } catch {
    details = ''
  }
  return details?.trim() || `${fallback} Statut HTTP ${response.status}.`
}

export function requestErrorMessage(error, fallback) {
  if (error instanceof TypeError && /fetch/i.test(error.message)) {
    return `${fallback} Le backend est inaccessible ou la requ\u00eate est bloqu\u00e9e par CORS.`
  }
  return error instanceof Error ? error.message : fallback
}

export function friendlyGenerationError(error) {
  if (error?.payload?.code === 'ATTACHMENT_LIMIT_EXCEEDED') {
    const maxFiles = Number(error.payload.maxFiles)
    const receivedFiles = Number(error.payload.receivedFiles)
    if (Number.isFinite(maxFiles) && Number.isFinite(receivedFiles)) {
      return `Vous pouvez joindre jusqu'\u00e0 ${maxFiles} fichiers par message. ${receivedFiles} fichiers ont \u00e9t\u00e9 s\u00e9lectionn\u00e9s.`
    }
    return error.payload.message || 'Trop de pi\u00e8ces jointes.'
  }
  const rawMessage = typeof error === 'string' ? error : error instanceof Error ? error.message : ''
  const clientError = rawMessage.match(/^HTTP 4\d\d\s+(.+)/)
  if (clientError?.[1]) return clientError[1].trim()
  if (/litellm|stream|streaming|fetch|network|failed/i.test(rawMessage)) {
    return 'Le mod\u00e8le met trop de temps \u00e0 r\u00e9pondre ou est indisponible. Veuillez r\u00e9essayer.'
  }
  return rawMessage.trim() || 'La g\u00e9n\u00e9ration a \u00e9chou\u00e9. Veuillez r\u00e9essayer.'
}

export function logDevelopmentError(label, payload) {
  if (import.meta.env.DEV) {
    console.error(label, payload)
  }
}
