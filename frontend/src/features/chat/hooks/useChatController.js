import { useCallback, useEffect } from 'react'
import { fetchConversation, fetchConversationMessages } from '../../../api/conversationsApi'
import { friendlyGenerationError } from '../../../utils/errors'
import { ACTIVE_CONVERSATION_STORAGE_KEY, clearActiveConversationId, saveLastModel } from '../../../utils/storage'

/**
 * Coordinates workflows that intentionally cross feature boundaries.
 *
 * Conversations own records and server mutations; chat owns messages, cache,
 * composer state and SSE streaming. This controller keeps those two domains
 * explicit without mutable render-time bridges.
 */
export default function useChatController({
  chat,
  conversations,
  models,
  navigation,
  feedback,
}) {
  const { state, actions, dialogs, status } = conversations
  const {
    composerBeforeRectRef,
    composerRef,
    messageCacheRef,
    shouldAutoScrollRef,
  } = chat
  const { activeConversationRestoreRef } = status

  const openConversation = useCallback(async (conversation) => {
    try {
      actions.openConversationRecord(conversation)
      chat.setIsLastBlockVisible(true)
      shouldAutoScrollRef.current = true
      // Cache messages by conversation id so switching threads is cheap and
      // preserves the existing local history behavior.
      const cachedMessages = messageCacheRef.current.get(conversation.id)
      if (cachedMessages) {
        chat.setMessages(cachedMessages)
        navigation.closeSidePanelOnMobile()
        return
      }
      const nextMessages = await fetchConversationMessages(conversation.id)
      messageCacheRef.current.set(conversation.id, nextMessages)
      chat.setMessages(nextMessages)
      navigation.closeSidePanelOnMobile()
    } catch {
      feedback.showError('Impossible de reprendre cette conversation.')
    }
  }, [actions, chat, feedback, messageCacheRef, navigation, shouldAutoScrollRef])

  const newConversation = useCallback((modelAlias = models.selectedModel) => {
    actions.newConversationRecord(modelAlias)
    chat.setMessages([])
    chat.setDraft('')
    chat.setIsLastBlockVisible(true)
    shouldAutoScrollRef.current = true
  }, [actions, chat, models.selectedModel, shouldAutoScrollRef])

  const sendMessage = useCallback(async (event) => {
    event.preventDefault()
    if (status.isGenerating) {
      return
    }
    const prompt = chat.draft.trim()
    const attachments = chat.attachments || []
    if (!prompt && attachments.length === 0) {
      feedback.showError('Le message ne peut pas être vide.')
      return
    }

    feedback.clearChatError()
    chat.rememberComposerFocusIntent()
    if (!chat.hasActiveMessages && composerRef.current) {
      composerBeforeRectRef.current = composerRef.current.getBoundingClientRect()
    }
    chat.setDraft('')
    if (attachments.length > 0) {
      chat.clearAttachments()
    }
    chat.restoreComposerFocusSoon()
    chat.setIsLastBlockVisible(true)
    shouldAutoScrollRef.current = true

    try {
      const conversation = await actions.ensureConversation(prompt)
      void chat.streamMessage(conversation, prompt, attachments)
    } catch (error) {
      if (attachments.length > 0) {
        chat.setAttachments(attachments)
      }
      feedback.showError(friendlyGenerationError(error))
      chat.restoreComposerFocusSoon()
    }
  }, [actions, chat, composerBeforeRectRef, composerRef, feedback, shouldAutoScrollRef, status.isGenerating])

  const sendSecureMessage = useCallback((maskedText) => {
    const prompt = String(maskedText || '').trim()
    if (!prompt || status.isGenerating || !state.activeConversation) return
    feedback.clearChatError()
    chat.setIsLastBlockVisible(true)
    shouldAutoScrollRef.current = true
    void chat.streamMessage(state.activeConversation, prompt)
  }, [chat, feedback, shouldAutoScrollRef, state.activeConversation, status.isGenerating])

  const archiveConversation = useCallback(async (conversation = state.activeConversation) => {
    const result = await actions.archiveConversationRecord(conversation)
    if (result.wasActive) {
      chat.setMessages([])
    }
  }, [actions, chat, state.activeConversation])

  const confirmDeleteConversation = useCallback(async () => {
    const result = await actions.confirmDeleteConversationRecord()
    if (result.wasActive) {
      chat.setMessages([])
    }
  }, [actions, chat])

  const selectModel = useCallback(async (alias) => {
    navigation.setIsModelMenuOpen(false)
    if (status.isGenerating) return
    if (!state.activeConversation) {
      models.setSelectedModel(alias)
      saveLastModel(alias)
      return
    }
    if (state.activeConversation.modelAlias === alias) return
    if (chat.messages.length === 0) {
      models.setSelectedModel(alias)
      saveLastModel(alias)
      actions.setActiveConversationModelAlias(alias)
      return
    }
    dialogs.setModelDecision({ alias })
  }, [actions, chat.messages.length, dialogs, models, navigation, state.activeConversation, status.isGenerating])

  const continueWithModel = useCallback(async (alias) => {
    await actions.changeConversationModel(alias)
  }, [actions])

  const openNewConversationWithModel = useCallback(async (alias) => {
    newConversation(alias)
    dialogs.setModelDecision(null)
  }, [dialogs, newConversation])

  useActiveConversationRestoreController({
    activeConversationRestoreRef,
    conversations,
    openConversation,
  })

  return {
    archiveConversation,
    confirmDeleteConversation,
    continueWithModel,
    deleteConversation: actions.requestDeleteConversation,
    newConversation,
    openConversation,
    openNewConversationWithModel,
    selectModel,
    sendMessage,
    sendSecureMessage,
  }
}

function useActiveConversationRestoreController({ activeConversationRestoreRef, conversations, openConversation }) {
  const { state } = conversations

  useEffect(() => {
    if (
      activeConversationRestoreRef.current ||
      !state.hasLoadedHistory ||
      state.showArchived ||
      state.search.trim() ||
      state.modelFilter
    ) {
      return
    }

    async function restoreActiveConversation() {
      const savedId = localStorage.getItem(ACTIVE_CONVERSATION_STORAGE_KEY)
      activeConversationRestoreRef.current = true
      if (!savedId) return

      let conversation = state.conversations.find((item) => String(item.id) === savedId)
      if (!conversation) {
        try {
          conversation = await fetchConversation(savedId)
        } catch {
          clearActiveConversationId()
          return
        }
      }

      if (conversation.status === 'ARCHIVEE') {
        clearActiveConversationId()
        return
      }

      await openConversation(conversation)
    }

    void restoreActiveConversation()
  }, [activeConversationRestoreRef, openConversation, state.conversations, state.hasLoadedHistory, state.modelFilter, state.search, state.showArchived])
}
