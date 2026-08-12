import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import useAutoScroll from './useAutoScroll'
import useMessageStream from './useMessageStream'
import { logDevelopmentError } from '../../../utils/errors'
import { focusTextareaOnNextFrame, shouldFocusComposer } from '../utils/composerFocus'
import { ACCEPTED_ATTACHMENT_EXTENSIONS } from '../utils/attachmentFiles'

export const MAX_ATTACHMENTS = Number.POSITIVE_INFINITY
export { ACCEPTED_ATTACHMENT_EXTENSIONS }

const GO_BOTTOM_GAP = 12
const GO_BOTTOM_HEIGHT = 32

/**
 * Groups the chat surface state that is independent from conversation CRUD.
 *
 * The streaming hook remains here because it owns the token buffer and the
 * AbortController used by the stop button. `activeConversationIdRef` is passed
 * from the conversation orchestration layer so stream completion can still
 * distinguish the active thread from a background completion.
 */
export default function useChatUi({
  activeConversationIdRef,
  activeModelAlias,
  isGenerating,
  loadConversations,
  modelDisplayName,
  setConversationUiStatus,
  showError,
}) {
  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const [copiedKey, setCopiedKey] = useState('')
  const [attachments, setAttachments] = useState([])
  const [isComposerMaxed, setIsComposerMaxed] = useState(false)
  const [isComposerTransitioning, setIsComposerTransitioning] = useState(false)
  const [goBottomTop, setGoBottomTop] = useState(null)

  const textareaRef = useRef(null)
  const composerRef = useRef(null)
  const composerBeforeRectRef = useRef(null)
  const composerTimerRef = useRef(null)
  const shouldRestoreComposerFocusRef = useRef(false)

  const hasActiveMessages = messages.length > 0
  const canSend = Boolean(activeModelAlias && (draft.trim() || attachments.length > 0) && !isGenerating)
  const {
    bottomRef,
    goToBottom,
    isLastBlockVisible,
    messagesRef,
    onMessagesScroll,
    setIsLastBlockVisible,
    shouldAutoScrollRef,
  } = useAutoScroll(messages)

  const {
    messageCacheRef,
    stopGeneration,
    streamSecureAttachment,
    streamMessage,
  } = useMessageStream({
    activeConversationIdRef,
    loadConversations,
    modelDisplayName,
    onStreamSettled: () => {
      if (!shouldRestoreComposerFocusRef.current) return
      if (!shouldFocusComposer({
        activeElement: document.activeElement,
        composer: composerRef.current,
        textarea: textareaRef.current,
      })) {
        return
      }
      focusTextareaOnNextFrame(textareaRef.current)
    },
    setConversationUiStatus,
    setMessages,
    showError,
  })

  const resizeTextarea = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    const nextHeight = Math.min(textarea.scrollHeight, 150)
    textarea.style.height = `${nextHeight}px`
    setIsComposerMaxed(textarea.scrollHeight > 150)
  }, [])

  useLayoutEffect(() => {
    const element = composerRef.current
    const before = composerBeforeRectRef.current
    if (!element || !before) return

    const after = element.getBoundingClientRect()
    const deltaX = before.left - after.left
    const deltaY = before.top - after.top
    composerBeforeRectRef.current = null

    if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) return

    setIsComposerTransitioning(true)
    element.animate(
      [
        { transform: `translate(${deltaX}px, ${deltaY}px)` },
        { transform: 'translate(0, 0)' },
      ],
      {
        duration: 340,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    )

    if (composerTimerRef.current) {
      window.clearTimeout(composerTimerRef.current)
    }
    composerTimerRef.current = window.setTimeout(() => setIsComposerTransitioning(false), 360)
  }, [hasActiveMessages])

  useEffect(() => {
    resizeTextarea()
  }, [draft, resizeTextarea])

  useLayoutEffect(() => {
    if (!hasActiveMessages) {
      const frame = window.requestAnimationFrame(() => setGoBottomTop(null))
      return () => window.cancelAnimationFrame(frame)
    }

    const composer = composerRef.current
    const chatMain = composer?.closest('.chat-main')
    if (!composer || !chatMain) return undefined

    let frame = 0

    function updateGoBottomTop() {
      frame = 0
      const composerRect = composer.getBoundingClientRect()
      const mainRect = chatMain.getBoundingClientRect()
      const nextTop = Math.max(12, Math.round(composerRect.top - mainRect.top - GO_BOTTOM_GAP - GO_BOTTOM_HEIGHT))
      setGoBottomTop((current) => (current === nextTop ? current : nextTop))
    }

    function scheduleUpdate() {
      if (frame) return
      frame = window.requestAnimationFrame(updateGoBottomTop)
    }

    scheduleUpdate()

    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(scheduleUpdate)
    observer?.observe(composer)
    observer?.observe(chatMain)
    window.addEventListener('resize', scheduleUpdate)

    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      observer?.disconnect()
      window.removeEventListener('resize', scheduleUpdate)
    }
  }, [attachments.length, draft, hasActiveMessages, isComposerMaxed])

  useEffect(() => () => {
    if (composerTimerRef.current) {
      window.clearTimeout(composerTimerRef.current)
    }
  }, [])

  useEffect(() => {
    function handlePointerDown(event) {
      if (!shouldRestoreComposerFocusRef.current) return
      if (composerRef.current?.contains(event.target)) return
      shouldRestoreComposerFocusRef.current = false
    }

    document.addEventListener('pointerdown', handlePointerDown, true)
    return () => document.removeEventListener('pointerdown', handlePointerDown, true)
  }, [])

  const rememberComposerFocusIntent = useCallback(() => {
    shouldRestoreComposerFocusRef.current = shouldFocusComposer({
      activeElement: document.activeElement,
      composer: composerRef.current,
      textarea: textareaRef.current,
    })
  }, [])

  const restoreComposerFocusSoon = useCallback(() => {
    if (!shouldRestoreComposerFocusRef.current) return
    focusTextareaOnNextFrame(textareaRef.current)
  }, [])

  const handleKeyDown = useCallback((event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      if (isGenerating) return
      event.currentTarget.form?.requestSubmit()
    }
  }, [isGenerating])

  const addAttachments = useCallback((fileList) => {
    const incoming = Array.from(fileList || [])
    const accepted = []
    for (const file of incoming) {
      const extension = `.${file.name.split('.').pop() || ''}`.toLowerCase()
      if (!ACCEPTED_ATTACHMENT_EXTENSIONS.includes(extension)) {
        showError(`Fichier non supporte : ${file.name}`)
        continue
      }
      accepted.push(file)
    }
    setAttachments((current) => {
      const existingKeys = new Set(current.map(fileKey))
      const uniqueAccepted = accepted.filter((file) => !existingKeys.has(fileKey(file)))
      return [...current, ...uniqueAccepted]
    })
  }, [showError])

  const removeAttachment = useCallback((index) => {
    setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))
  }, [])

  const clearAttachments = useCallback(() => setAttachments([]), [])

  const onCopy = useCallback(async (text) => {
    if (!text) return false
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch (error) {
      logDevelopmentError('clipboard failed', error)
      showError('Impossible de copier le contenu.')
      return false
    }
  }, [showError])

  return {
    bottomRef,
    canSend,
    attachments,
    addAttachments,
    clearAttachments,
    composerBeforeRectRef,
    composerRef,
    copiedKey,
    draft,
    goToBottom,
    goBottomTop,
    handleKeyDown,
    hasActiveMessages,
    isComposerMaxed,
    isComposerTransitioning,
    isLastBlockVisible,
    messageCacheRef,
    messages,
    messagesRef,
    onCopy,
    onMessagesScroll,
    setCopiedKey,
    setDraft,
    setAttachments,
    setIsLastBlockVisible,
    setMessages,
    shouldAutoScrollRef,
    rememberComposerFocusIntent,
    restoreComposerFocusSoon,
    stopGeneration,
    streamSecureAttachment,
    streamMessage,
    removeAttachment,
    textareaRef,
  }
}

function fileKey(file) {
  return `${file.name || ''}:${file.size || 0}:${file.type || ''}`
}
