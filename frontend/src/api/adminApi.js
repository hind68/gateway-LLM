import { apiFetch } from './client'

export async function fetchUsers(token) {
  return apiFetch('/admin/permissions/users', {
    headers: { Authorization: `Bearer ${token}` }
  })
}

export async function fetchGlobalBannedWords(token) {
  return apiFetch('/admin/permissions/banned-words/global', {
    headers: { Authorization: `Bearer ${token}` }
  })
}

export async function addGlobalBannedWord(word, token) {
  return apiFetch('/admin/permissions/banned-words/global', {
    method: 'POST',
    json: { word },
    headers: { Authorization: `Bearer ${token}` }
  })
}

export async function removeGlobalBannedWord(id, token) {
  return apiFetch(`/admin/permissions/banned-words/global/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  })
}

export async function fetchUserRestrictions(userId, token) {
  return apiFetch(`/admin/permissions/llm-restrictions/${userId}`, {
    headers: { Authorization: `Bearer ${token}` }
  })
}

export async function addLlmRestriction(userId, llmModelAlias, token) {
  return apiFetch('/admin/permissions/llm-restrictions', {
    method: 'POST',
    json: { userId, llmModelAlias },
    headers: { Authorization: `Bearer ${token}` }
  })
}

export async function removeLlmRestriction(id, token) {
  return apiFetch(`/admin/permissions/llm-restrictions/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  })
}

export async function fetchUserBannedWords(userId, token) {
  return apiFetch(`/admin/permissions/banned-words/user/${userId}`, {
    headers: { Authorization: `Bearer ${token}` }
  })
}

export async function addUserBannedWord(userId, word, token) {
  return apiFetch('/admin/permissions/banned-words/user', {
    method: 'POST',
    json: { userId, word },
    headers: { Authorization: `Bearer ${token}` }
  })
}

export async function removeUserBannedWord(id, token) {
  return apiFetch(`/admin/permissions/banned-words/user/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  })
}

export async function fetchPatterns(token) {
  return apiFetch('/admin/permissions/patterns', {
    headers: { Authorization: `Bearer ${token}` }
  })
}

export async function addPattern(patternData, token) {
  return apiFetch('/admin/permissions/patterns', {
    method: 'POST',
    json: patternData,
    headers: { Authorization: `Bearer ${token}` }
  })
}

export async function removePattern(name, token) {
  return apiFetch(`/admin/permissions/patterns/${name}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  })
}
export async function fetchRoleRestrictions(roleName, token) {
  return apiFetch(`/admin/permissions/llm-restrictions/role/${roleName}`, {
    headers: { Authorization: `Bearer ${token}` }
  })
}

export async function addRoleLlmRestriction(roleName, llmModelAlias, token) {
  return apiFetch('/admin/permissions/llm-restrictions/role', {
    method: 'POST',
    json: { roleName, llmModelAlias },
    headers: { Authorization: `Bearer ${token}` }
  })
}

export async function removeRoleLlmRestriction(id, token) {
  return apiFetch(`/admin/permissions/llm-restrictions/role/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  })
}

export async function fetchRoleBannedWords(roleName, token) {
  return apiFetch(`/admin/permissions/banned-words/role/${roleName}`, {
    headers: { Authorization: `Bearer ${token}` }
  })
}

export async function addRoleBannedWord(roleName, word, token) {
  return apiFetch('/admin/permissions/banned-words/role', {
    method: 'POST',
    json: { roleName, word },
    headers: { Authorization: `Bearer ${token}` }
  })
}

export async function removeRoleBannedWord(id, token) {
  return apiFetch(`/admin/permissions/banned-words/role/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  })
}
function queryString(params = {}) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, value)
  })
  const serialized = query.toString()
  return serialized ? `?${serialized}` : ''
}

export async function fetchKeycloakUsers(token, search = '') {
  const suffix = search ? `?search=${encodeURIComponent(search)}` : ''
  return apiFetch(`/admin/keycloak/users${suffix}`, { headers: { Authorization: `Bearer ${token}` } })
}

export async function createKeycloakUser(payload, token) {
  return apiFetch('/admin/keycloak/users', { method: 'POST', json: payload, headers: { Authorization: `Bearer ${token}` } })
}

export async function setKeycloakUserEnabled(id, enabled, token) {
  return apiFetch(`/admin/keycloak/users/${encodeURIComponent(id)}/enabled?enabled=${enabled}`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } })
}

export async function fetchKeycloakRoles(token) {
  return apiFetch('/admin/keycloak/roles', { headers: { Authorization: `Bearer ${token}` } })
}
export async function fetchKeycloakUserRoles(id, token) {
  return apiFetch(`/admin/keycloak/users/${encodeURIComponent(id)}/roles`, { headers: { Authorization: `Bearer ${token}` } })
}

export async function setKeycloakUserRoles(id, roles, token) {
  return apiFetch(`/admin/keycloak/users/${encodeURIComponent(id)}/roles`, { method: 'PUT', json: { roles }, headers: { Authorization: `Bearer ${token}` } })
}

export async function fetchAdminProviders(token) {
  return apiFetch('/admin/models/providers', { headers: { Authorization: `Bearer ${token}` } })
}
export async function createAdminProvider(payload, token) {
  return apiFetch('/admin/models/providers', { method: 'POST', json: payload, headers: { Authorization: `Bearer ${token}` } })
}
export async function fetchAdminModels(token) {
  return apiFetch('/admin/models', { headers: { Authorization: `Bearer ${token}` } })
}
export async function createAdminModel(payload, token) {
  return apiFetch('/admin/models', { method: 'POST', json: payload, headers: { Authorization: `Bearer ${token}` } })
}
export async function setAdminModelStatus(id, status, token) {
  return apiFetch(`/admin/models/${id}/status?status=${status}`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } })
}
export async function testAdminModel(id, token) {
  return apiFetch(`/admin/models/${id}/test`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
}
export async function fetchSecurityMetrics(token) {
  return apiFetch('/admin/metrics/security', { headers: { Authorization: `Bearer ${token}` } })
}
export async function updatePattern(name, patternData, token) {
  return apiFetch(`/admin/permissions/patterns/${encodeURIComponent(name)}`, {
    method: 'PUT',
    json: patternData,
    headers: { Authorization: `Bearer ${token}` }
  })
}

export async function fetchAuditLogs(token, params) {
  return apiFetch(`/admin/audit${queryString(params)}`, {
    headers: { Authorization: `Bearer ${token}` }
  })
}
export async function fetchFilteredMessages(token, params) {
  return apiFetch(`/admin/filtered-messages${queryString(params)}`, {
    headers: { Authorization: `Bearer ${token}` }
  })
}
