import { useCallback, useEffect, useRef } from 'react'
import { streamConversationMessage } from '../../../api/conversationsApi'
import { streamSecureAttachment as streamSecureAttachmentRequest } from '../../../api/attachmentsApi'
import { friendlyGenerationError } from '../../../utils/errors'
import { dlpUserMessage } from '../utils/dlpErrors'
import { extractSseData, parseJson } from '../utils/sse'

/**
 * Owns the streaming lifecycle for assistant generations.
 *
 * The hook keeps mutable refs for AbortController and the message cache because
 * SSE callbacks can outlive a render. Tokens are applied as soon as their SSE
 * event arrives so the UI keeps a continuous typewriter feel.
 */
export default function useMessageStream({
  activeConversationIdRef,
  loadConversations,
  modelDisplayName,
  onStreamSettled,
  setConversationUiStatus,
  setMessages,
  showError,
}) {
  const generationAbortRef = useRef(null)
  const messageCacheRef = useRef(new Map())
  const localIdCounterRef = useRef(0)

  const updateConversationMessages = useCallback((conversationId, updater) => {
    const currentMessages = messageCacheRef.current.get(conversationId) || []
    const nextMessages = updater(currentMessages)
    messageCacheRef.current.set(conversationId, nextMessages)
    if (activeConversationIdRef.current === conversationId) {
      setMessages(nextMessages)
    }
  }, [activeConversationIdRef, setMessages])

  const appendToken = useCallback((conversationId, assistantId, token) => {
    if (!token) return
    updateConversationMessages(conversationId, (current) =>
      current.map((item) =>
        item.id === assistantId ? { ...item, content: `${item.content}${token}` } : item,
      ),
    )
  }, [updateConversationMessages])

  const getReadyConversationStatus = useCallback((conversationId) => (
    String(activeConversationIdRef.current) === String(conversationId) ? 'idle' : 'completed_unread'
  ), [activeConversationIdRef])

  const handleSseEvent = useCallback((rawEvent, conversationId, localUserId, localAssistantId) => {
    const lines = rawEvent.split('\n')
    const event = lines.find((line) => line.startsWith('event:'))?.slice(6).trim()
    const data = extractSseData(lines, event === 'token')
    const jsonData = event === 'token' ? data : data.trim()

    if (event === 'message') {
      const parsed = parseJson(jsonData)
      if (!parsed) return
      const targetId = parsed.role === 'USER' ? localUserId : localAssistantId
      updateConversationMessages(conversationId, (current) =>
        current.map((item) =>
          item.id === targetId
            ? { ...item, ...parsed, id: targetId, serverId: parsed.id }
            : item,
        ),
      )
    }

    if (event === 'token') {
      appendToken(conversationId, localAssistantId, data)
    }

    if (event === 'done') {
      const parsed = parseJson(jsonData)
      updateConversationMessages(conversationId, (current) =>
        current.map((item) =>
          item.id === localAssistantId
            ? { ...item, serverId: parsed?.messageId || item.serverId, status: 'TERMINE' }
            : item,
        ),
      )
    }

    if (event === 'error') {
      const parsed = parseJson(jsonData)
      const message = dlpUserMessage(parsed || jsonData) || friendlyGenerationError(jsonData)
      updateConversationMessages(conversationId, (current) => {
        if (parsed?.code === 'DLP_BLOCKED') {
          return current
            .map((item) =>
                  item.id === localUserId
                ? {
                    ...item,
                    status: 'DLP_BLOCKED',
                    dlpOriginalText: item.content,
                    dlpMaskedText: parsed.maskedText || '',
                    dlpHighestSeverity: parsed.highestSeverity,
                    dlpDetectedTypes: parsed.detectedTypes || [],
                    dlpMatches: parsed.matches || [],
                    attachments: mergeAttachmentMetadata(parsed.attachments, item.attachments),
                  }
                : item,
            )
            .filter((item) => item.id !== localAssistantId)
        }
        return current.map((item) =>
          item.id === localAssistantId ? { ...item, status: 'ECHEC', content: item.content || message } : item,
        )
      })
      if (activeConversationIdRef.current === conversationId && parsed?.code !== 'DLP_BLOCKED') {
        showError(message)
      }
    }
  }, [activeConversationIdRef, appendToken, showError, updateConversationMessages])

  const nextLocalId = useCallback((prefix) => {
    localIdCounterRef.current += 1
    return `${prefix}-${localIdCounterRef.current}`
  }, [])

  const streamMessage = useCallback(async (conversation, prompt, attachments = []) => {
    const modelName = modelDisplayName(conversation.modelAlias)
    // Optimistic local ids keep the UI stable while the backend persists and returns server ids.
    const localUserId = nextLocalId('local-user')
    const localAssistantId = nextLocalId('local-assistant')
    const abortController = new AbortController()
    let finalConversationStatus = 'idle'
    generationAbortRef.current = abortController
    setConversationUiStatus(conversation.id, 'generating')

    updateConversationMessages(conversation.id, (current) => [
      ...current,
      {
        id: localUserId,
        role: 'USER',
        status: 'TERMINE',
        content: prompt,
        attachments: attachmentPreview(attachments),
        modelAlias: conversation.modelAlias,
        modelDisplayName: modelName,
      },
      {
        id: localAssistantId,
        role: 'ASSISTANT',
        status: 'EN_COURS',
        content: '',
        modelAlias: conversation.modelAlias,
        modelDisplayName: modelName,
      },
    ])

    try {
      const response = await streamConversationMessage(conversation.id, prompt, abortController.signal, attachments)

      if (!response.ok || !response.body) throw new Error('Erreur pendant le streaming LiteLLM')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const events = buffer.split('\n\n')
        buffer = events.pop() || ''
        events.forEach((rawEvent) => handleSseEvent(rawEvent, conversation.id, localUserId, localAssistantId))
      }

      if (buffer) {
        handleSseEvent(buffer, conversation.id, localUserId, localAssistantId)
      }
      await loadConversations()
      finalConversationStatus = getReadyConversationStatus(conversation.id)
    } catch (error) {
      if (abortController.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
        updateConversationMessages(conversation.id, (current) =>
          current
            .map((item) =>
              item.id === localAssistantId ? { ...item, status: 'TERMINE' } : item,
            )
            .filter((item) => item.id !== localAssistantId || item.content.trim()),
        )
        return
      }
      const message = friendlyGenerationError(error)
      updateConversationMessages(conversation.id, (current) =>
        current.map((item) =>
          item.id === localAssistantId ? { ...item, status: 'ECHEC', content: message } : item,
        ),
      )
      if (activeConversationIdRef.current === conversation.id) showError(message)
    } finally {
      setConversationUiStatus(conversation.id, finalConversationStatus)
      if (generationAbortRef.current === abortController) {
        generationAbortRef.current = null
      }
      onStreamSettled?.()
    }
  }, [
    activeConversationIdRef,
    getReadyConversationStatus,
    handleSseEvent,
    loadConversations,
    modelDisplayName,
    nextLocalId,
    onStreamSettled,
    setConversationUiStatus,
    showError,
    updateConversationMessages,
  ])

  const streamSecureAttachment = useCallback(async (conversation, attachment) => {
    if (!conversation?.id || !attachment?.id) return
    const filename = attachment.filename || attachment.name || 'fichier'
    const prompt = `Version sécurisée de ${filename}`
    const modelName = modelDisplayName(conversation.modelAlias)
    const localUserId = nextLocalId('local-user')
    const localAssistantId = nextLocalId('local-assistant')
    const abortController = new AbortController()
    let finalConversationStatus = 'idle'
    generationAbortRef.current = abortController
    setConversationUiStatus(conversation.id, 'generating')

    updateConversationMessages(conversation.id, (current) => [
      ...current,
      {
        id: localUserId,
        role: 'USER',
        status: 'TERMINE',
        content: prompt,
        attachments: [attachment],
        modelAlias: conversation.modelAlias,
        modelDisplayName: modelName,
      },
      {
        id: localAssistantId,
        role: 'ASSISTANT',
        status: 'EN_COURS',
        content: '',
        modelAlias: conversation.modelAlias,
        modelDisplayName: modelName,
      },
    ])

    try {
      const response = await streamSecureAttachmentRequest(conversation.id, attachment.id, abortController.signal)
      if (!response.ok || !response.body) throw new Error('Erreur pendant le streaming LiteLLM')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const events = buffer.split('\n\n')
        buffer = events.pop() || ''
        events.forEach((rawEvent) => handleSseEvent(rawEvent, conversation.id, localUserId, localAssistantId))
      }

      if (buffer) {
        handleSseEvent(buffer, conversation.id, localUserId, localAssistantId)
      }
      await loadConversations()
      finalConversationStatus = getReadyConversationStatus(conversation.id)
    } catch (error) {
      if (abortController.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
        updateConversationMessages(conversation.id, (current) =>
          current
            .map((item) => (item.id === localAssistantId ? { ...item, status: 'TERMINE' } : item))
            .filter((item) => item.id !== localAssistantId || item.content.trim()),
        )
        return
      }
      const message = friendlyGenerationError(error)
      updateConversationMessages(conversation.id, (current) =>
        current.map((item) =>
          item.id === localAssistantId ? { ...item, status: 'ECHEC', content: message } : item,
        ),
      )
      if (activeConversationIdRef.current === conversation.id) showError(message)
    } finally {
      setConversationUiStatus(conversation.id, finalConversationStatus)
      if (generationAbortRef.current === abortController) {
        generationAbortRef.current = null
      }
      onStreamSettled?.()
    }
  }, [
    activeConversationIdRef,
    getReadyConversationStatus,
    handleSseEvent,
    loadConversations,
    modelDisplayName,
    nextLocalId,
    onStreamSettled,
    setConversationUiStatus,
    showError,
    updateConversationMessages,
  ])

  const stopGeneration = useCallback(() => {
    generationAbortRef.current?.abort()
  }, [])

  useEffect(() => () => {
    generationAbortRef.current?.abort()
  }, [])

  return {
    messageCacheRef,
    streamSecureAttachment,
    streamMessage,
    stopGeneration,
  }
}

function attachmentPreview(files) {
  return files.map((file) => ({
    filename: file.name,
    file,
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
  }))
}

function mergeAttachmentMetadata(serverAttachments = [], localAttachments = []) {
  const localByName = new Map(
    (localAttachments || []).map((attachment) => [attachment.filename || attachment.name, attachment]),
  )
  if (!Array.isArray(serverAttachments) || serverAttachments.length === 0) return localAttachments || []
  return serverAttachments.map((attachment) => {
    const local = localByName.get(attachment.filename || attachment.name)
    return local?.file ? { ...attachment, file: local.file } : attachment
  })
}
