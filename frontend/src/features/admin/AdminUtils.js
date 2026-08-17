export const ADMIN_NAV_ITEMS = [
  { id: 'overview', label: "Vue d'ensemble", icon: 'grid' },
  { id: 'security', label: 'Sécurité', icon: 'shield' },
  { id: 'models', label: 'Modèles', icon: 'spark' },
  { id: 'users', label: 'Utilisateurs', icon: 'users' },
  { id: 'roles', label: 'Rôles', icon: 'key' },
  { id: 'audit', label: "Journal d'audit", icon: 'activity' },
]

export function formatKicker(value) {
  const text = String(value || '').trim().toLocaleLowerCase('fr-FR')
  if (!text) return ''
  const sentence = text.charAt(0).toLocaleUpperCase('fr-FR') + text.slice(1)
  return sentence.replace(/\bdlp\b/gi, 'DLP').replace(/\bapi\b/gi, 'API')
}

export function formatAction(value) {
  const labels = { ADD: 'Ajout', CREATE: 'Création', DELETE: 'Suppression', UPDATE: 'Modification', ENABLE: 'Activation', DISABLE: 'Désactivation', BLOCKED: 'Bloqué', REDACTED: 'Masqué', MASKED: 'Masqué' }
  return labels[String(value || '').toUpperCase()] || String(value || 'Événement').replaceAll('_', ' ').toLowerCase()
}

export function formatEntity(value) {
  const labels = { UserLlmRestriction: 'Restriction de modèle', USER_LLM_RESTRICTION: 'Restriction de modèle', USER_BANNED_WORD: 'Mot banni utilisateur', GLOBAL_BANNED_WORD: 'Mot banni global', LLM_MODEL: 'Modèle', PROVIDER: 'Fournisseur', DLP_PATTERN: 'Pattern DLP' }
  return labels[value] || String(value || 'Ressource').replaceAll('_', ' ')
}
