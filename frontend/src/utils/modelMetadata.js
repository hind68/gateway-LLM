import { LAST_MODEL_STORAGE_KEY } from './storage'

export function selectAvailableModel(models, currentAlias) {
  const savedAlias = localStorage.getItem(LAST_MODEL_STORAGE_KEY)
  if (savedAlias && models.some((model) => model.alias === savedAlias)) return savedAlias
  if (savedAlias) localStorage.removeItem(LAST_MODEL_STORAGE_KEY)
  if (currentAlias && models.some((model) => model.alias === currentAlias)) return currentAlias
  return models[0]?.alias || ''
}

export function cleanModelName(value, alias) {
  const candidate = value || alias
  const names = {
    'secure-gpt': 'GPT',
    'secure-groq': 'Groq',
    'secure-gemini': 'Gemini',
    'secure-mistral': 'Mistral',
    'secure-claude': 'Claude',
  }
  if (names[candidate]) return names[candidate]
  if (candidate?.startsWith?.('secure-')) return names[alias] || candidate.replace(/^secure-/i, '')
  return candidate
    .replace(/^secure[-_\s]*model[-_\s]*/i, '')
    .replace(/^secure[-_\s]*/i, '')
    .replace(/\bGro[kq]\b/g, 'Groq')
    .trim()
}

export function displayConversationTitle(title) {
  return String(title || 'Nouvelle conversation')
    .replace(/^Discussion:\s*/i, '')
    .replace(/^Pi[e\u00e8]ces jointes\s*:\s*/i, '')
    .trim() || 'Nouvelle conversation'
}

export function modelProviderName(alias) {
  const providers = {
    'secure-gpt': 'OpenAI',
    'secure-groq': 'Groq',
    'secure-gemini': 'Google',
    'secure-mistral': 'Mistral',
    'secure-claude': 'Anthropic',
  }
  return providers[alias] || 'Provider'
}

export function modelCardMeta(alias) {
  const metas = {
    'secure-gpt': {
      initials: 'GPT',
      tone: 'tone-openai',
      description: 'Modèle généraliste adapté aux réponses concises, au raisonnement et aux usages quotidiens.',
    },
    'secure-groq': {
      initials: 'GQ',
      tone: 'tone-groq',
      description: 'Modèle rapide pour tester les conversations et obtenir des réponses réactives.',
    },
    'secure-gemini': {
      initials: 'GM',
      tone: 'tone-gemini',
      description: 'Modèle polyvalent pour explorer, reformuler et structurer des idées.',
    },
    'secure-mistral': {
      initials: 'MS',
      tone: 'tone-mistral',
      description: 'Modèle efficace pour les tâches pratiques, les synthèses et les prompts directs.',
    },
    'secure-claude': {
      initials: 'CL',
      tone: 'tone-claude',
      description: 'Modèle orienté rédaction, analyse longue et conversations soignées.',
    },
  }
  return metas[alias] || {
    initials: cleanModelName(alias, alias).slice(0, 2).toUpperCase(),
    tone: 'tone-default',
    description: 'Modèle disponible dans le catalogue Secure LLM Gateway.',
  }
}

export function modelLogoSrc(alias) {
  const logos = {
    'secure-gpt': '/assets/chatgpt-logo.png',
    'secure-groq': '/assets/groq-logo.png',
    'secure-gemini': '/assets/gemini-provider-logo.png',
    'secure-mistral': '/assets/mistral-provider-logo.png',
    'secure-claude': '',
  }
  return logos[alias] || ''
}

export function titleFrom(content) {
  const compact = content
    .replace(/^Pieces jointes\s*:[^\n]*(?:\n|$)/i, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!compact) return 'Nouvelle conversation'
  return `Discussion: ${compact.length > 72 ? `${compact.slice(0, 69)}...` : compact}`
}
