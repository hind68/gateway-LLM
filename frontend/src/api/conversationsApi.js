import { apiFetch, apiFetchResponse } from './client'

export async function fetchConversations({ modelFilter, search, showArchived }) {
  const params = new URLSearchParams({ page: '0', size: '30' })
  if (modelFilter) params.set('modelAlias', modelFilter)
  if (search.trim()) params.set('search', search.trim())
  if (showArchived) params.set('archived', 'true')

  return apiFetch(`/conversations?${params}`)
}

export async function fetchConversation(conversationId) {
  return apiFetch(`/conversations/${conversationId}`)
}

export async function fetchConversationMessages(conversationId) {
  return apiFetch(`/conversations/${conversationId}/messages`)
}

export async function createConversationRequest(modelAlias, title) {
  return apiFetch('/conversations', {
    method: 'POST',
    json: { modelAlias, title },
  })
}

export async function renameConversationRequest(conversationId, title) {
  return apiFetch(`/conversations/${conversationId}`, {
    method: 'PATCH',
    json: { title },
  })
}

export async function archiveConversationRequest(conversationId) {
  return apiFetch(`/conversations/${conversationId}`, { method: 'DELETE' })
}

export async function restoreConversationRequest(conversationId) {
  return apiFetch(`/conversations/${conversationId}/restore`, { method: 'PATCH' })
}

export async function deleteConversationRequest(conversationId) {
  return apiFetch(`/conversations/${conversationId}/permanent`, { method: 'DELETE' })
}

export async function changeConversationModelRequest(conversationId, modelAlias) {
  return apiFetch(`/conversations/${conversationId}/model`, {
    method: 'PATCH',
    json: { modelAlias },
  })
}

export function streamConversationMessage(conversationId, content, signal, files = []) {
  if (files.length > 0 || !content.trim()) {
    const formData = new FormData()
    if (content.trim()) formData.append('content', content)
    files.forEach((file) => formData.append('files', file))
    return apiFetchResponse(`/conversations/${conversationId}/messages/stream-with-files`, {
      method: 'POST',
      body: formData,
      signal,
    })
  }
  return apiFetchResponse(`/conversations/${conversationId}/messages/stream`, {
    method: 'POST',
    json: { content },
    signal,
  })
}
