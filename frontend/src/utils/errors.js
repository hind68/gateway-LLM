export async function deletionErrorMessage(response) {
  if (response.status === 404) return 'Conversation introuvable ou déjà supprimée.'
  if (response.status === 409) return 'Cette conversation ne peut pas être supprimée pour le moment.'
  if (response.status >= 500) return 'Suppression impossible côté serveur. Vérifiez les liens messages/conversation.'
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
    return `${fallback} Le backend est inaccessible ou la requête est bloquée par CORS.`
  }
  return error instanceof Error ? error.message : fallback
}

export function friendlyGenerationError(error) {
  const rawMessage = typeof error === 'string' ? error : error instanceof Error ? error.message : ''
  if (/litellm|stream|streaming|fetch|network|failed/i.test(rawMessage)) {
    return 'Le modèle met trop de temps à répondre ou est indisponible. Veuillez réessayer.'
  }
  return rawMessage.trim() || 'La génération a échoué. Veuillez réessayer.'
}

export function logDevelopmentError(label, payload) {
  if (import.meta.env.DEV) {
    console.error(label, payload)
  }
}
