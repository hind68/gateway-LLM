import keycloak from '../keycloak'

const DEFAULT_API_BASE_URL = '/api'

export const API_BASE_URL = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL)

export class ApiError extends Error {
  constructor(message, { status, details } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

export async function apiFetch(path, options = {}) {
  const response = await apiFetchResponse(path, options)
  return parseResponseBody(response)
}

export async function apiFetchResponse(path, options = {}) {
  try {
    await keycloak.updateToken(30)
  } catch (error) {
    keycloak.login()
    throw new ApiError('Unauthorized', { status: 401 })
  }

  const response = await fetch(buildApiUrl(path), prepareOptions(options))
  
  if (response.status === 401) {
    keycloak.login()
    throw new ApiError('Unauthorized', { status: 401 })
  }
  
  if (!response.ok) {
    throw await createApiError(response)
  }
  
  return response
}

function prepareOptions(options) {
  const { json, headers, body, ...rest } = options
  const nextHeaders = new Headers(headers)
  let nextBody = body

  if (json !== undefined) {
    nextBody = JSON.stringify(json)
    if (!nextHeaders.has('Content-Type')) {
      nextHeaders.set('Content-Type', 'application/json')
    }
  }

  if (keycloak.token) {
    nextHeaders.set('Authorization', `Bearer ${keycloak.token}`)
  }

  return {
    ...rest,
    headers: nextHeaders,
    body: nextBody,
  }
}

function buildApiUrl(path) {
  const normalizedPath = String(path || '')
  if (/^https?:\/\//i.test(normalizedPath)) return normalizedPath
  return `${API_BASE_URL}/${normalizedPath.replace(/^\/+/, '')}`
}

function normalizeBaseUrl(value) {
  return String(value || DEFAULT_API_BASE_URL).replace(/\/+$/, '') || DEFAULT_API_BASE_URL
}

async function createApiError(response) {
  const details = await readErrorDetails(response)
  const suffix = details ? ` ${details}` : ''
  return new ApiError(`HTTP ${response.status}${suffix}`, {
    status: response.status,
    details,
  })
}

async function readErrorDetails(response) {
  const contentType = response.headers.get('content-type') || ''
  try {
    if (contentType.includes('application/json')) {
      const payload = await response.json()
      if (typeof payload === 'string') return payload
      return payload?.message || payload?.error || JSON.stringify(payload)
    }
    return (await response.text()).trim()
  } catch {
    return ''
  }
}

async function parseResponseBody(response) {
  if (response.status === 204) return undefined
  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    return response.json()
  }
  if (contentType.includes('text/html')) {
    throw new ApiError(`HTTP ${response.status} Unexpected HTML response`, {
      status: response.status,
      details: 'Unexpected HTML response',
    })
  }
  const text = await response.text()
  return text || undefined
}