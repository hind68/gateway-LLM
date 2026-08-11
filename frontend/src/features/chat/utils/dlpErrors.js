import { parseJson } from './sse'

const TYPE_LABELS = {
  moroccan_cin: 'CIN',
  ma_cin: 'CIN',
  alphanumeric_identifier: 'identifiant alphanumérique',
  email: 'adresse e-mail',
  phone_number: 'numéro de téléphone',
  moroccan_phone: 'numéro de téléphone',
  iban: 'IBAN',
  ma_iban: 'IBAN',
  moroccan_iban: 'IBAN',
  rib: 'RIB',
  ma_rib: 'RIB',
  moroccan_rib: 'RIB',
  credit_card: 'numéro de carte bancaire',
  openai_api_key: 'clé API OpenAI',
  github_token: 'token GitHub',
  jwt_token: 'jeton JWT',
  private_key: 'clé privée',
  hardcoded_password: 'mot de passe',
  ip_address: 'adresse IP',
}

export function dlpUserMessage(value) {
  const payload = typeof value === 'string' ? parseJson(value) : value
  if (!payload || typeof payload !== 'object') return null

  if (payload.code === 'DLP_UNAVAILABLE') {
    return [
      'Contrôle de sécurité indisponible.',
      'Votre message n’a pas été envoyé au modèle.',
      'Réessayez dans quelques instants.',
    ].join('\n')
  }

  if (payload.code !== 'DLP_BLOCKED') return null

  const labels = uniqueLabels(payload.detectedTypes)
  const detectionLine = labels.length === 0
    ? 'Une donnée sensible a été détectée.'
    : labels.length === 1
      ? `Une donnée sensible de type ${labels[0]} a été détectée.`
      : `Des données sensibles ont été détectées : ${joinFrenchList(labels)}.`
  const instruction = labels.length > 1
    ? 'Supprimez ou masquez ces informations, puis réessayez.'
    : 'Supprimez ou masquez cette information, puis réessayez.'

  return [
    'Votre message a été bloqué.',
    detectionLine,
    instruction,
  ].join('\n')
}

function uniqueLabels(types) {
  if (!Array.isArray(types)) return []
  return [...new Set(
    types
      .map((type) => TYPE_LABELS[type])
      .filter(Boolean),
  )]
}

function joinFrenchList(labels) {
  if (labels.length <= 1) return labels[0] || ''
  if (labels.length === 2) return `${labels[0]} et ${labels[1]}`
  return `${labels.slice(0, -1).join(', ')} et ${labels.at(-1)}`
}
