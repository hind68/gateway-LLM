import { useCallback, useEffect, useRef, useState } from 'react'
import {
  archiveConversationRequest,
  changeConversationModelRequest,
  createConversationRequest,
  deleteConversationRequest,
  fetchConversations,
  renameConversationRequest,
  restoreConversationRequest,
} from '../../../api/conversationsApi'
import { logDevelopmentError, requestErrorMessage } from '../../../utils/errors'
import { displayConversationTitle, titleFrom } from '../../../utils/modelMetadata'
import { clearActiveConversationId, saveActiveConversationId, saveLastModel } from '../../../utils/storage'
import useConversationStatus from './useConversationStatus'

/**
 * Owns conversation state and server mutations that do not require chat UI
 * state. Cross-domain workflows such as opening messages, first send and
 * clearing cached messages are coordinated by `useChatController`.
 */
export default function useConversations({
  selectedModel,
  setSelectedModel,
  navigation,
  feedback,
}) {
  const [modelFilter, setModelFilter] = useState('')
  const [search, setSearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [conversations, setConversations] = useState([])
  const [activeConversation, setActiveConversation] = useState(null)
  const [historyError, setHistoryError] = useState('')
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [modelDecision, setModelDecision] = useState(null)
  const [pendingDeleteConversation, setPendingDeleteConversation] = useState(null)
  const [editingConversationId, setEditingConversationId] = useState(null)
  const [editingTitle, setEditingTitle] = useState('')

  const activeConversationRestoreRef = useRef(false)
  const activeConversationIdRef = useRef(null)

  const {
    conversationUiStatus,
    conversationUiStatusRef,
    generatingConversationId,
    isGenerating,
    markConversationRead,
    setConversationUiStatus,
  } = useConversationStatus({ setConversations })

  const closeMenus = useCallback(() => {
    navigation.closeTransientMenus()
  }, [navigation])

  const loadConversations = useCallback(async () => {
    setIsLoadingHistory(true)
    try {
      const data = await fetchConversations({ modelFilter, search, showArchived })
      const rawContent = Array.isArray(data) ? data : Array.isArray(data.content) ? data.content : []
      const content = rawContent.map((conversation) => ({
        ...conversation,
        uiStatus: conversationUiStatusRef.current[String(conversation.id)] || 'idle',
      }))
      setConversations(content)
      setHistoryError('')
      return content
    } catch {
      setHistoryError('Impossible de charger l’historique.')
      return []
    } finally {
      setHasLoadedHistory(true)
      setIsLoadingHistory(false)
    }
  }, [conversationUiStatusRef, modelFilter, search, showArchived])

  useEffect(() => {
    // The history list is synchronized with the server whenever filters change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadConversations()
  }, [loadConversations])

  useEffect(() => {
    activeConversationIdRef.current = activeConversation?.id || null
  }, [activeConversation?.id])

  const openConversationRecord = useCallback((conversation) => {
    feedback.clearChatError()
    navigation.closeTransientMenus()
    activeConversationIdRef.current = conversation.id
    setActiveConversation(conversation)
    markConversationRead(conversation.id)
    setSelectedModel(conversation.modelAlias)
    saveLastModel(conversation.modelAlias)
    saveActiveConversationId(conversation.id)
    navigation.setActiveView('chat')
  }, [feedback, markConversationRead, navigation, setSelectedModel])

  const newConversationRecord = useCallback((modelAlias = selectedModel) => {
    activeConversationIdRef.current = null
    setActiveConversation(null)
    feedback.clearChatError()
    clearActiveConversationId()
    navigation.closeTransientMenus()
    setSelectedModel(modelAlias)
    saveLastModel(modelAlias)
    navigation.closeSidePanelOnMobile()
  }, [feedback, navigation, selectedModel, setSelectedModel])

  const createConversation = useCallback(async (modelAlias, title) => {
    const conversation = { ...(await createConversationRequest(modelAlias, title)), uiStatus: 'idle' }
    activeConversationIdRef.current = conversation.id
    setActiveConversation(conversation)
    markConversationRead(conversation.id)
    setSelectedModel(conversation.modelAlias)
    saveLastModel(conversation.modelAlias)
    saveActiveConversationId(conversation.id)
    setConversations((current) => [conversation, ...current.filter((item) => item.id !== conversation.id)])
    return conversation
  }, [markConversationRead, setSelectedModel])

  const ensureConversation = useCallback(async (prompt) => {
    if (activeConversation) return activeConversation
    // A conversation is created only on first send, keeping empty drafts out of history.
    return createConversation(selectedModel, titleFrom(prompt))
  }, [activeConversation, createConversation, selectedModel])

  const renameConversation = useCallback((conversation = activeConversation) => {
    if (!conversation || isGenerating) return
    setEditingConversationId(conversation.id)
    setEditingTitle(displayConversationTitle(conversation.title))
    closeMenus()
  }, [activeConversation, closeMenus, isGenerating])

  const saveInlineRename = useCallback(async (conversation) => {
    const title = editingTitle.trim()
    if (!conversation || isGenerating) return
    if (!title || title === displayConversationTitle(conversation.title)) {
      setEditingConversationId(null)
      setEditingTitle('')
      return
    }

    try {
      const updated = await renameConversationRequest(conversation.id, title)
      setActiveConversation((current) => (current?.id === updated.id ? { ...updated, uiStatus: current.uiStatus } : current))
      setConversations((current) => current.map((item) => (item.id === updated.id ? { ...updated, uiStatus: item.uiStatus } : item)))
      setEditingConversationId(null)
      setEditingTitle('')
      closeMenus()
    } catch {
      feedback.showError('Impossible de renommer la conversation.')
    }
  }, [closeMenus, editingTitle, feedback, isGenerating])

  const archiveConversationRecord = useCallback(async (conversation = activeConversation) => {
    if (!conversation || isGenerating) return { wasActive: false }
    try {
      await archiveConversationRequest(conversation.id)
      setConversations((current) => current.filter((item) => item.id !== conversation.id))
      const wasActive = activeConversation?.id === conversation.id
      if (wasActive) {
        activeConversationIdRef.current = null
        setActiveConversation(null)
      }
      clearActiveConversationId(conversation.id)
      closeMenus()
      await loadConversations()
      return { wasActive }
    } catch {
      feedback.showError('Impossible d’archiver la conversation.')
      return { wasActive: false }
    }
  }, [activeConversation, closeMenus, feedback, isGenerating, loadConversations])

  const restoreConversation = useCallback(async (conversation) => {
    if (!conversation || isGenerating) return
    try {
      const updated = await restoreConversationRequest(conversation.id)
      setConversations((current) => current.filter((item) => item.id !== updated.id))
      if (activeConversation?.id === updated.id) {
        setActiveConversation(updated)
        setSelectedModel(updated.modelAlias)
        saveLastModel(updated.modelAlias)
        saveActiveConversationId(updated.id)
      }
      closeMenus()
      feedback.showNotice('Conversation désarchivée.')
      await loadConversations()
    } catch (error) {
      feedback.showError(requestErrorMessage(error, 'Impossible de désarchiver la conversation.'))
    }
  }, [activeConversation, closeMenus, feedback, isGenerating, loadConversations, setSelectedModel])

  const requestDeleteConversation = useCallback(async (conversation = activeConversation) => {
    if (!conversation || isGenerating) return
    if (!conversation.id) {
      feedback.showError('Impossible de supprimer cette conversation: identifiant manquant.')
      logDevelopmentError('delete conversation missing id', conversation)
      return
    }
    setPendingDeleteConversation(conversation)
    closeMenus()
  }, [activeConversation, closeMenus, feedback, isGenerating])

  const confirmDeleteConversationRecord = useCallback(async () => {
    const conversation = pendingDeleteConversation
    if (!conversation || isGenerating) return { wasActive: false }
    try {
      await deleteConversationRequest(conversation.id)
      setConversations((current) => current.filter((item) => item.id !== conversation.id))
      const wasActive = activeConversation?.id === conversation.id
      if (wasActive) {
        activeConversationIdRef.current = null
        setActiveConversation(null)
      }
      clearActiveConversationId(conversation.id)
      closeMenus()
      setPendingDeleteConversation(null)
      feedback.showNotice('Conversation supprimée.')
      await loadConversations()
      return { wasActive }
    } catch (error) {
      feedback.showError(requestErrorMessage(error, 'Impossible de supprimer la conversation.'))
      return { wasActive: false }
    }
  }, [activeConversation, closeMenus, feedback, isGenerating, loadConversations, pendingDeleteConversation])

  const changeConversationModel = useCallback(async (alias) => {
    if (!activeConversation) return null
    try {
      const updated = await changeConversationModelRequest(activeConversation.id, alias)
      activeConversationIdRef.current = updated.id
      setActiveConversation(updated)
      setSelectedModel(updated.modelAlias)
      saveLastModel(updated.modelAlias)
      saveActiveConversationId(updated.id)
      setConversations((current) => current.map((item) => (item.id === updated.id ? updated : item)))
      setModelDecision(null)
      return updated
    } catch (error) {
      feedback.showError(requestErrorMessage(error, 'Impossible de changer le modèle.'))
      return null
    }
  }, [activeConversation, feedback, setSelectedModel])

  const setActiveConversationModelAlias = useCallback((alias) => {
    setActiveConversation((current) => (current ? { ...current, modelAlias: alias } : current))
  }, [])

  return {
    state: {
      activeConversation,
      conversations,
      hasLoadedHistory,
      historyError,
      isLoadingHistory,
      modelFilter,
      search,
      showArchived,
    },
    filters: {
      setModelFilter,
      setSearch,
      setShowArchived,
    },
    editing: {
      editingConversationId,
      editingTitle,
      setEditingConversationId,
      setEditingTitle,
    },
    dialogs: {
      modelDecision,
      pendingDeleteConversation,
      setModelDecision,
      setPendingDeleteConversation,
    },
    actions: {
      archiveConversationRecord,
      changeConversationModel,
      confirmDeleteConversationRecord,
      createConversation,
      ensureConversation,
      loadConversations,
      newConversationRecord,
      openConversationRecord,
      renameConversation,
      requestDeleteConversation,
      restoreConversation,
      saveInlineRename,
      setActiveConversationModelAlias,
    },
    status: {
      activeConversationIdRef,
      activeConversationRestoreRef,
      conversationUiStatus,
      generatingConversationId,
      isGenerating,
      markConversationRead,
      setConversationUiStatus,
    },
  }
}
