import { apiFetch, apiFetchResponse } from './client'

export function fetchAttachmentMetadata(id) {
  return apiFetch(`/attachments/${id}`)
}

export async function fetchAttachmentContent(id, options = {}) {
  const response = await apiFetchResponse(`/attachments/${id}/content`, options)
  return {
    blob: await response.blob(),
    contentType: response.headers.get('content-type') || 'application/octet-stream',
  }
}

export function fetchAttachmentInspection(id, options = {}) {
  return apiFetch(`/attachments/${id}/inspection`, options).then(normalizeAttachmentPayload)
}

export function fetchAttachmentSecure(id, options = {}) {
  return apiFetch(`/attachments/${id}/secure`, options).then(normalizeAttachmentPayload)
}

export async function downloadSecureAttachment(id) {
  const response = await apiFetchResponse(`/attachments/${id}/secure/download`)
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const disposition = response.headers.get('content-disposition') || ''
  link.href = url
  link.download = filenameFromDisposition(disposition) || 'document-securise.txt'
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function streamSecureAttachment(conversationId, attachmentId, signal) {
  return apiFetchResponse(`/conversations/${conversationId}/attachments/${attachmentId}/send-secure`, {
    method: 'POST',
    signal,
  })
}

function filenameFromDisposition(disposition) {
  const match = disposition.match(/filename="([^"]+)"/i)
  return match ? match[1] : ''
}

function normalizeAttachmentPayload(payload) {
  if (!payload || typeof payload !== 'object') return payload
  return {
    ...payload,
    attachmentId: payload.attachmentId ?? payload.attachment_id ?? payload.id,
    extractedText: payload.extractedText ?? payload.extracted_text ?? '',
    extractionStatus: payload.extractionStatus ?? payload.extraction_status ?? '',
    maskedText: payload.maskedText ?? payload.masked_text ?? '',
    matches: Array.isArray(payload.matches) ? payload.matches : [],
  }
}
